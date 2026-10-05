import assert from "node:assert/strict";
import test from "node:test";
import { authRequest } from "../client/src/lib/authRequest";

test("auth request preserves credentials on outages and clears only unauthorized sessions", async () => {
  const originalFetch = globalThis.fetch;
  let cleared = 0;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "Database temporarily unavailable" }), { status: 503 });
    await assert.rejects(authRequest("/api/auth/me", {}, () => cleared++), /Database temporarily unavailable/);
    assert.equal(cleared, 0);
    for (const status of [401, 403]) {
      globalThis.fetch = async () => new Response(null, { status });
      assert.equal(await authRequest("/api/auth/me", {}, () => cleared++), null);
    }
    assert.equal(cleared, 2);
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 1 }));
    assert.deepEqual(await authRequest("/api/auth/me", {}, () => cleared++), { id: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("auth request deadlines cover stalled fetch and stalled response bodies", async () => {
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | null | undefined;
  let cleared = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      signal = options?.signal;
      return await new Promise<Response>(() => {});
    };
    await assert.rejects(authRequest("/api/auth/me", {}, () => cleared++, 10), /timed out/);
    assert.equal(signal?.aborted, true);
    globalThis.fetch = async () => ({
      ok: true, status: 200, json: () => new Promise(() => {}),
    }) as Response;
    await assert.rejects(authRequest("/api/auth/me", {}, () => cleared++, 10), /timed out/);
    assert.equal(cleared, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});