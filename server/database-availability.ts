import type { Request, RequestHandler, Response } from "express";

export const DATABASE_UNAVAILABLE_MESSAGE =
  "Database temporarily unavailable. Please try again shortly.";

export class DatabaseUnavailableError extends Error {
  readonly status = 503;
  readonly statusCode = 503;
  readonly code = "DATABASE_UNAVAILABLE";

  constructor() {
    super(DATABASE_UNAVAILABLE_MESSAGE);
    this.name = "DatabaseUnavailableError";
  }
}

export function databaseUnavailableError(): DatabaseUnavailableError {
  return new DatabaseUnavailableError();
}

// Log driver codes only, never connection strings or driver error messages.
export function databaseDiagnosticCode(error: unknown): string {
  const seen = new Set<unknown>();
  let candidate = error;
  for (let depth = 0; depth < 8; depth++) {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) break;
    seen.add(candidate);
    const details = candidate as { code?: unknown; cause?: unknown };
    if (typeof details.code === "string" && /^[A-Z0-9_]{2,64}$/.test(details.code)) {
      return details.code;
    }
    candidate = details.cause;
  }
  return "UNKNOWN_DATABASE_ERROR";
}

/**
 * Classify known driver reasons without logging the raw message, which can
 * contain database usernames, endpoints, queries, or connection credentials.
 * In particular SQLSTATE XX000 alone cannot distinguish a pooler lockout.
 */
export function databaseDiagnosticReason(error: unknown): string {
  const seen = new Set<unknown>();
  let candidate = error;
  for (let depth = 0; depth < 8; depth++) {
    if (!candidate || typeof candidate !== "object" || seen.has(candidate)) break;
    seen.add(candidate);
    const details = candidate as { message?: unknown; cause?: unknown };
    if (typeof details.message === "string") {
      const message = details.message.toLowerCase();
      if (message.includes("circuit breaker open")) return "POOLER_CIRCUIT_BREAKER_OPEN";
      if (message.includes("tenant or user not found")) return "POOLER_TENANT_NOT_FOUND";
      if (message.includes("failed to retrieve database credentials")) return "POOLER_CREDENTIAL_LOOKUP_FAILED";
      if (message.includes("password authentication failed")) return "AUTHENTICATION_REJECTED";
    }
    candidate = details.cause;
  }
  if (databaseDiagnosticCode(error) === "28P01") return "AUTHENTICATION_REJECTED";
  return "UNCLASSIFIED";
}

export function isDatabaseFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { name?: unknown; code?: unknown; cause?: unknown };
  if (candidate.name === "DatabaseUnavailableError") {
    return true;
  }

  if (typeof candidate.code === "string") {
    // PostgreSQL connection/resource failures and common transport errors
    // surfaced by postgres.js. Other SQLSTATEs (for example a uniqueness
    // violation) are query errors, not proof that the database is unavailable.
    if (/^(08|53|57|58|XX)/i.test(candidate.code)) return true;
    if (/^(ECONN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|ERR_SOCKET|EAI_AGAIN|ENOTFOUND|CONNECTION_|CONNECT_TIMEOUT)/.test(candidate.code)) {
      return true;
    }
  }

  if (candidate.name === "PostgresError" && typeof candidate.code !== "string") return true;
  return candidate.cause !== error && isDatabaseFailure(candidate.cause);
}

export interface DatabaseOperationGateOptions<TClient> {
  initialClient: TClient;
  createClient: () => TClient | Promise<TClient>;
  closeClient: (client: TClient) => Promise<unknown>;
  maxPending?: number;
  timeoutMs?: number;
  isDatabaseFailure?: (error: unknown) => boolean;
}

/**
 * Bounds admitted operations and enforces a deadline by destroying the client
 * before returning a timeout. A timed-out client's late errors are associated
 * with that client identity, never with a replacement client.
 */
export class DatabaseOperationGate<TClient> {
  private currentClient: TClient | undefined;
  private pending = 0;
  private generation = 0;
  private recoveryPromise: Promise<void> | undefined;
  private creationPromise: Promise<void> | undefined;
  private readonly createClient: DatabaseOperationGateOptions<TClient>["createClient"];
  private readonly closeClient: DatabaseOperationGateOptions<TClient>["closeClient"];
  private readonly maxPending: number;
  private readonly timeoutMs: number;
  private readonly databaseFailure: (error: unknown) => boolean;

  constructor(options: DatabaseOperationGateOptions<TClient>) {
    this.currentClient = options.initialClient;
    this.createClient = options.createClient;
    this.closeClient = options.closeClient;
    this.maxPending = options.maxPending ?? 12;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.databaseFailure = options.isDatabaseFailure ?? isDatabaseFailure;
  }

  get pendingOperations(): number {
    return this.pending;
  }

  run<TResult>(operation: (client: TClient) => Promise<TResult>): Promise<TResult> {
    if (this.pending >= this.maxPending) {
      return Promise.reject(databaseUnavailableError());
    }
    this.pending += 1;

    let leasedClient: TClient | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const operationPromise = (async () => {
      const client = await this.getClient();
      // Work that expired while waiting for recovery must never execute later.
      if (expired) throw databaseUnavailableError();
      leasedClient = client;
      try {
        return await operation(client);
      } catch (error) {
        if (this.databaseFailure(error)) this.invalidate(client);
        throw error;
      }
    })();

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        expired = true;
        // invalidate() synchronously detaches this client and invokes close
        // before this request is allowed to time out.
        if (leasedClient !== undefined) this.invalidate(leasedClient);
        reject(databaseUnavailableError());
      }, this.timeoutMs);
    });

    return Promise.race([operationPromise, timeoutPromise]).finally(() => {
      if (timeout) clearTimeout(timeout);
      this.pending -= 1;
    });
  }

  private async getClient(): Promise<TClient> {
    if (this.currentClient !== undefined) return this.currentClient;
    if (this.recoveryPromise) await this.recoveryPromise;
    if (this.currentClient !== undefined) return this.currentClient;

    if (!this.creationPromise) {
      let creation: Promise<void>;
      creation = Promise.resolve()
        .then(() => this.createClient())
        .then(async (client) => {
          if (this.currentClient === undefined) {
            this.currentClient = client;
          } else {
            await this.closeClient(client).catch(() => undefined);
          }
        })
        .finally(() => {
          if (this.creationPromise === creation) this.creationPromise = undefined;
        });
      this.creationPromise = creation;
    }

    await this.creationPromise;
    if (this.currentClient === undefined) throw databaseUnavailableError();
    return this.currentClient;
  }

  private invalidate(client: TClient): void {
    if (this.currentClient !== client) return;
    this.currentClient = undefined;
    const generation = ++this.generation;

    let finishRecovery!: () => void;
    const recovery = new Promise<void>((resolve) => { finishRecovery = resolve; });
    this.recoveryPromise = recovery;
    void (async () => {
      try {
        // postgres.js end({ timeout: 0 }) destroys connections and rejects
        // in-flight work; always create a fresh client after teardown settles.
        await this.closeClient(client);
      } catch {
        // The old client is detached regardless; do not reuse it.
      }

      try {
        const replacement = await this.createClient();
        if (this.generation === generation && this.currentClient === undefined) {
          this.currentClient = replacement;
        } else {
          await this.closeClient(replacement);
        }
      } catch {
        // Leave the gate unavailable; a later admitted operation can retry.
      } finally {
        if (this.recoveryPromise === recovery) this.recoveryPromise = undefined;
        finishRecovery();
      }
    })();
  }
}

export class DatabaseAvailability {
  private probeInFlight: Promise<boolean> | undefined;
  private available = false;
  private cacheExpiresAt = Number.NEGATIVE_INFINITY;
  private statusGeneration = 0;

  constructor(
    private readonly probe: () => Promise<unknown>,
    private readonly options: {
      successTtlMs?: number;
      failureTtlMs?: number;
      now?: () => number;
    } = {},
  ) {}

  get isCurrentlyAvailable(): boolean {
    return this.available;
  }

  markUnavailable(): void {
    this.statusGeneration += 1;
    this.available = false;
    this.cacheExpiresAt = this.now() + this.failureTtlMs;
  }

  async check(): Promise<boolean> {
    if (this.now() < this.cacheExpiresAt) return this.available;
    if (this.probeInFlight) return this.probeInFlight;

    const generation = this.statusGeneration;
    let inFlight: Promise<boolean>;
    inFlight = Promise.resolve()
      .then(() => this.probe())
      .then(() => {
        if (this.statusGeneration !== generation) return this.available;
        this.available = true;
        this.cacheExpiresAt = this.now() + this.successTtlMs;
        return this.available;
      })
      .catch(() => {
        if (this.statusGeneration !== generation) return this.available;
        this.available = false;
        this.cacheExpiresAt = this.now() + this.failureTtlMs;
        return this.available;
      })
      .finally(() => {
        if (this.probeInFlight === inFlight) this.probeInFlight = undefined;
      });
    this.probeInFlight = inFlight;
    return inFlight;
  }

  private get successTtlMs(): number {
    return Math.max(0, this.options.successTtlMs ?? 1_000);
  }

  private get failureTtlMs(): number {
    return Math.max(0, this.options.failureTtlMs ?? 250);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}

export function isDatabaseGateExempt(req: Pick<Request, "originalUrl">, exemptPaths: readonly string[]): boolean {
  const path = req.originalUrl.split("?")[0];
  return exemptPaths.includes(path);
}

export function createDatabaseAvailabilityMiddleware(
  availability: DatabaseAvailability,
  exemptPaths: readonly string[] = [],
): RequestHandler {
  return (req: Request, res: Response, next) => {
    if (isDatabaseGateExempt(req, exemptPaths)) return next();

    void availability.check().then((isAvailable) => {
      if (!isAvailable) {
        res.status(503).json({ message: DATABASE_UNAVAILABLE_MESSAGE });
        return;
      }
      next();
    }).catch(next);
  };
}