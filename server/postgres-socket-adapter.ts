import net from "node:net";
import type { Socket } from "node:net";

export interface PostgresSocketOptions {
  host: string[];
  port: number[];
  path?: string;
  connect_timeout?: number;
}

/**
 * Supplies and tracks the underlying TCP sockets for one postgres.js client.
 * Destroying these sockets hard-aborts both plain and TLS-wrapped connections.
 */
export class TrackedPostgresSockets {
  private readonly sockets = new Set<Socket>();
  private endpointIndex = 0;
  private destroyed = false;

  readonly createSocket = (options: PostgresSocketOptions): Promise<Socket> => {
    if (this.destroyed) {
      return Promise.reject(new Error("Postgres socket tracker has been destroyed."));
    }

    // postgres.js removes listeners from the original socket when it wraps
    // that socket for TLS, so prune already-destroyed underlying sockets here
    // as well as removing sockets through their close event when available.
    for (const tracked of this.sockets) {
      if (tracked.destroyed) this.sockets.delete(tracked);
    }

    const socket = new net.Socket();
    this.sockets.add(socket);
    socket.once("close", () => this.sockets.delete(socket));

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let rejectConnection: (error: Error) => void;
      let resolveConnection: () => void;
      rejectConnection = (error) => {
        if (timer) clearTimeout(timer);
        socket.removeListener("connect", resolveConnection);
        socket.removeListener("error", rejectConnection);
        this.sockets.delete(socket);
        socket.destroy();
        reject(error);
      };
      resolveConnection = () => {
        if (timer) clearTimeout(timer);
        socket.removeListener("error", rejectConnection);
        resolve(socket);
      };

      const connectTimeout = Math.max(1, options.connect_timeout ?? 5) * 1_000;
      timer = setTimeout(() => {
        rejectConnection(Object.assign(new Error("Postgres socket connection timed out."), {
          code: "CONNECT_TIMEOUT",
        }));
      }, connectTimeout);
      socket.once("error", rejectConnection);
      socket.once("connect", resolveConnection);

      if (options.path) {
        socket.connect(options.path);
        return;
      }

      const hostCount = options.host.length;
      const portCount = options.port.length;
      if (hostCount === 0 || portCount === 0) {
        rejectConnection(new Error("Postgres socket requires a host and port."));
        return;
      }

      const endpointCount = Math.max(hostCount, portCount);
      const endpoint = this.endpointIndex++ % endpointCount;
      const host = options.host[endpoint % hostCount];
      const port = options.port[endpoint % portCount];
      // postgres.js uses socket.host when upgrading the underlying socket to TLS.
      Object.assign(socket, { host, port });
      socket.connect(port, host);
    });
  };

  get trackedSocketCount(): number {
    return this.sockets.size;
  }

  destroyAll(): void {
    this.destroyed = true;
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
  }
}