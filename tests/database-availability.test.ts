import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import {
  createDatabaseAvailabilityMiddleware,
  DATABASE_UNAVAILABLE_MESSAGE,
  DatabaseAvailability,
  DatabaseOperationGate,
  DatabaseUnavailableError,
  databaseDiagnosticCode,
  databaseUnavailableError,
  isDatabaseFailure,
} from "../server/database-availability";
import { TrackedPostgresSockets } from "../server/postgres-socket-adapter";

test("database diagnostics expose only safe driver codes, including nested causes", () => {
  assert.equal(databaseDiagnosticCode({ cause: { code: "28P01", message: "private credentials" } }), "28P01");
  assert.equal(databaseDiagnosticCode({ code: "postgres://private-credentials", message: "private" }), "UNKNOWN_DATABASE_ERROR");
  const circular: any = {};
  circular.cause = circular;
  assert.equal(databaseDiagnosticCode(circular), "UNKNOWN_DATABASE_ERROR");
});

test("database availability probe recovers after connectivity returns", async () => {
  let connected = false;
  const availability = new DatabaseAvailability(async () => {
    if (!connected) throw Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });
  }, { failureTtlMs: 0 });

  assert.equal(await availability.check(), false);
  assert.equal(availability.isCurrentlyAvailable, false);

  connected = true;
  assert.equal(await availability.check(), true);
  assert.equal(availability.isCurrentlyAvailable, true);
});

test("concurrent checks share one probe and database failures are sanitized", async () => {
  let probes = 0;
  const availability = new DatabaseAvailability(async () => {
    probes += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  assert.deepEqual(await Promise.all([availability.check(), availability.check()]), [true, true]);
  assert.equal(probes, 1);

  const unavailable = databaseUnavailableError();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.message, DATABASE_UNAVAILABLE_MESSAGE);
  assert.equal(isDatabaseFailure(unavailable), true);
  assert.equal(isDatabaseFailure(Object.assign(new Error("query failed"), { code: "08006" })), true);
  assert.equal(isDatabaseFailure(Object.assign(new Error("duplicate key"), { code: "23505" })), false);
  assert.equal(isDatabaseFailure(new Error("application validation failed")), false);
});

test("availability caches probe results using an injectable clock", async () => {
  let now = 100;
  let probeCount = 0;
  let shouldFail = false;
  const availability = new DatabaseAvailability(
    async () => {
      probeCount += 1;
      if (shouldFail) throw new Error("offline");
    },
    { successTtlMs: 50, failureTtlMs: 10, now: () => now },
  );

  assert.equal(await availability.check(), true);
  assert.equal(await availability.check(), true);
  assert.equal(probeCount, 1);

  now = 150;
  assert.equal(await availability.check(), true);
  assert.equal(probeCount, 2);

  shouldFail = true;
  now = 200;
  assert.equal(await availability.check(), false);
  assert.equal(await availability.check(), false);
  assert.equal(probeCount, 3);

  shouldFail = false;
  now = 210;
  assert.equal(await availability.check(), true);
  assert.equal(probeCount, 4);
});

test("hung operation times out only after client teardown and safely ignores late old-client errors", async () => {
  type Client = { generation: number };
  let created = 0;
  let closed = 0;
  let rejectHung!: (error: Error) => void;
  const gate = new DatabaseOperationGate<Client>({
    initialClient: { generation: 1 },
    createClient: () => ({ generation: ++created + 1 }),
    closeClient: async (client) => {
      closed += 1;
      if (client.generation === 1) {
        // Model postgres.js rejecting a query after end({ timeout: 0 }) has
        // destroyed its connection. The rejection must remain handled.
        setTimeout(() => rejectHung(Object.assign(new Error("closed"), { code: "CONNECTION_DESTROYED" })), 0);
      }
    },
    maxPending: 1,
    timeoutMs: 20,
  });

  const hungQuery = gate.run(
    () => new Promise<never>((_resolve, reject) => { rejectHung = reject; }),
  );
  await assert.rejects(hungQuery, DatabaseUnavailableError);
  assert.equal(closed, 1);
  assert.equal(gate.pendingOperations, 0);

  assert.equal(
    await gate.run(async (client) => client.generation),
    2,
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(closed, 1, "a late error from generation 1 must not close generation 2");
});

test("probe-style operation gate rejects saturation and recovers after cancellation", async () => {
  type Client = { id: number };
  let created = 0;
  let closed = 0;
  let cancelProbe!: (error: Error) => void;
  const gate = new DatabaseOperationGate<Client>({
    initialClient: { id: 1 },
    createClient: () => ({ id: ++created + 1 }),
    closeClient: async () => {
      closed += 1;
      cancelProbe(Object.assign(new Error("probe client destroyed"), { code: "CONNECTION_DESTROYED" }));
    },
    maxPending: 1,
    timeoutMs: 20,
  });

  const hungProbe = gate.run(
    () => new Promise<string>((_resolve, reject) => { cancelProbe = reject; }),
  );
  await assert.rejects(gate.run(async () => "unexpected"), DatabaseUnavailableError);
  await assert.rejects(hungProbe, DatabaseUnavailableError);
  assert.equal(closed, 1);

  // The dedicated probe pool is recreated and available for the next probe.
  assert.equal(await gate.run(async (client) => `probe-${client.id}`), "probe-2");
});

test("bounded operation gate refuses excess pending work", async () => {
  const gate = new DatabaseOperationGate<{ id: number }>({
    initialClient: { id: 1 },
    createClient: () => ({ id: 2 }),
    closeClient: async () => undefined,
    maxPending: 2,
    timeoutMs: 100,
  });
  const releases: Array<(value: number) => void> = [];
  const first = gate.run(() => new Promise<number>((resolve) => releases.push(resolve)));
  const second = gate.run(() => new Promise<number>((resolve) => releases.push(resolve)));

  assert.equal(gate.pendingOperations, 2);
  await assert.rejects(gate.run(async () => 3), DatabaseUnavailableError);
  releases.forEach((resolve, index) => resolve(index));
  assert.deepEqual(await Promise.all([first, second]), [0, 1]);
  assert.equal(gate.pendingOperations, 0);
});

test("tracked postgres socket connects with provided endpoint and hard-destroys locally", async () => {
  const listener = net.createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });

  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const tracker = new TrackedPostgresSockets();
  try {
    const socket = await tracker.createSocket({
      host: ["127.0.0.1"],
      port: [address.port],
    });
    assert.equal(socket.remotePort, address.port);
    assert.equal(tracker.trackedSocketCount, 1);

    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    tracker.destroyAll();
    await closed;
    assert.equal(tracker.trackedSocketCount, 0);
  } finally {
    tracker.destroyAll();
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  }
});

test("API middleware returns sanitized 503s and permits explicit non-database exemptions", async () => {
  const availability = new DatabaseAvailability(async () => {
    throw new Error("private connection detail");
  });
  const middleware = createDatabaseAvailabilityMiddleware(availability, [
    "/api/stripe/labor-day-trial/invite",
  ]);

  const makeResponse = () => {
    const result: { statusCode?: number; body?: unknown } = {};
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    const response = {
      status(code: number) {
        result.statusCode = code;
        return this;
      },
      json(body: unknown) {
        result.body = body;
        finish();
        return this;
      },
    };
    return { response, result, done, finish };
  };

  const blocked = makeResponse();
  let blockedNext = false;
  middleware(
    { originalUrl: "/api/users" } as any,
    blocked.response as any,
    (() => { blockedNext = true; }) as any,
  );
  await blocked.done;
  assert.equal(blockedNext, false);
  assert.equal(blocked.result.statusCode, 503);
  assert.deepEqual(blocked.result.body, { message: DATABASE_UNAVAILABLE_MESSAGE });

  const exempt = makeResponse();
  let exemptNext = false;
  middleware(
    { originalUrl: "/api/stripe/labor-day-trial/invite?campaign=private" } as any,
    exempt.response as any,
    (() => { exemptNext = true; exempt.finish(); }) as any,
  );
  await exempt.done;
  assert.equal(exemptNext, true);
  assert.equal(exempt.result.statusCode, undefined);
});