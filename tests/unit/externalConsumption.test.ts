import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyExternalError } from "../../src/lib/errors/externalErrorClassification";
import { auditExternalConsumption } from "../../scripts/audit-external-consumption";

describe("Sprint 8 — External Consumption & Error Classification Tests", () => {
  it("runs the external consumption audit successfully", () => {
    const audit = auditExternalConsumption();
    assert.equal(audit.passed, true);
    assert.deepEqual(audit.errors, []);
  });

  it("classifies 401/403 and invalid_grant as non-retryable permanent auth errors (fail-fast)", () => {
    const err401 = { status: 401, message: "Unauthorized token" };
    const res401 = classifyExternalError(err401);
    assert.equal(res401.isRetryable, false);
    assert.equal(res401.isPermanentAuth, true);
    assert.equal(res401.category, "auth");

    const errGrant = { error: "invalid_grant", message: "The provided authorization grant is invalid" };
    const resGrant = classifyExternalError(errGrant);
    assert.equal(resGrant.isRetryable, false);
    assert.equal(resGrant.isPermanentAuth, true);
  });

  it("classifies 429 rate limit errors as retryable with backoff", () => {
    const err429 = { status: 429, error: "rate_limit_exceeded" };
    const res429 = classifyExternalError(err429);
    assert.equal(res429.isRetryable, true);
    assert.equal(res429.isPermanentAuth, false);
    assert.equal(res429.category, "rate_limit");
  });

  it("classifies 5xx upstream server errors as retryable", () => {
    const err502 = { status: 502, message: "Bad Gateway from MercadoLibre" };
    const res502 = classifyExternalError(err502);
    assert.equal(res502.isRetryable, true);
    assert.equal(res502.category, "server_error");

    const err500 = { status: 500, message: "Internal Server Error" };
    const res500 = classifyExternalError(err500);
    assert.equal(res500.isRetryable, true);
    assert.equal(res500.category, "server_error");
  });

  it("classifies network timeouts and connection aborts as retryable", () => {
    const timeoutErr = { code: "ETIMEDOUT", message: "connect ETIMEDOUT 127.0.0.1" };
    const resTimeout = classifyExternalError(timeoutErr);
    assert.equal(resTimeout.isRetryable, true);
    assert.equal(resTimeout.category, "timeout");

    const abortErr = new DOMException("The user aborted a request.", "AbortError");
    const resAbort = classifyExternalError(abortErr);
    assert.equal(resAbort.isRetryable, true);
    assert.equal(resAbort.category, "timeout");
  });
});
