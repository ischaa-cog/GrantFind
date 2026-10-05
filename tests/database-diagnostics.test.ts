import assert from "node:assert/strict";
import test from "node:test";
import { databaseDiagnosticReason } from "../server/database-availability";

test("database diagnostics distinguish generic pooler errors without exposing raw details", () => {
  const samples = [
    ["FATAL: Circuit breaker open: too many authentication failures", "POOLER_CIRCUIT_BREAKER_OPEN"],
    ["Tenant or user not found", "POOLER_TENANT_NOT_FOUND"],
    ["Failed to retrieve database credentials after multiple attempts", "POOLER_CREDENTIAL_LOOKUP_FAILED"],
    ['password authentication failed for user "private-example"', "AUTHENTICATION_REJECTED"],
    ["unrecognized failure with postgresql://user:private-password@private-host/db", "UNCLASSIFIED"],
  ];
  for (const [message, expected] of samples) {
    assert.equal(databaseDiagnosticReason({ code: "XX000", message }), expected);
  }
  assert.equal(databaseDiagnosticReason({ code: "28P01" }), "AUTHENTICATION_REJECTED");
});

test("database diagnostics handle wrapped, missing, and cyclic errors safely", () => {
  assert.equal(databaseDiagnosticReason(new Error("wrapper", {
    cause: new Error("Circuit breaker open"),
  })), "POOLER_CIRCUIT_BREAKER_OPEN");
  assert.equal(databaseDiagnosticReason(null), "UNCLASSIFIED");
  assert.equal(databaseDiagnosticReason("secret raw text"), "UNCLASSIFIED");
  assert.equal(databaseDiagnosticReason({ message: 123 }), "UNCLASSIFIED");
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(databaseDiagnosticReason(cyclic), "UNCLASSIFIED");
});