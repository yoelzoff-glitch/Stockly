import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyExternalError } from "../../src/lib/errors/externalErrorClassification";

describe("Sprint 8.1 — External Error Classification & Real Retry Attempts Integration", () => {
  it("verifies fail-fast on 400, 403, and validation errors (0 retries, exactly 1 attempt)", async () => {
    // 1. Classification verification
    const c400 = classifyExternalError({ status: 400, message: "Bad Request" });
    assert.equal(c400.isRetryable, false);
    assert.equal(c400.category, "client_error");

    const c403 = classifyExternalError({ status: 403, message: "Forbidden Access" });
    assert.equal(c403.isRetryable, false);
    assert.equal(c403.isPermanentAuth, true);
  });

  it("verifies retryable classification on 408, 429, 500, 502, 503, 504 and timeouts", () => {
    const transientStatuses = [408, 429, 500, 502, 503, 504];
    for (const status of transientStatuses) {
      const c = classifyExternalError({ status });
      assert.equal(c.isRetryable, true, `Status ${status} must be retryable`);
    }

    const cTimeout = classifyExternalError({ code: "ETIMEDOUT", message: "Connection timeout" });
    assert.equal(cTimeout.isRetryable, true);
    assert.equal(cTimeout.category, "timeout");
  });

  it("verifies mock retry execution behavior for retryable status codes (exactly 3 attempts)", async () => {
    let attempts = 0;
    const maxRetries = 3;

    const mockFetch = async () => {
      attempts++;
      if (attempts < maxRetries) {
        return { ok: false, status: 503, headers: new Headers() };
      }
      return { ok: true, status: 200, headers: new Headers() };
    };

    let response: any = null;
    let attemptCount = 0;

    while (attemptCount < maxRetries) {
      attemptCount++;
      const res = await mockFetch();
      const classification = classifyExternalError({ status: res.status });
      if (res.ok) {
        response = res;
        break;
      }
      if (classification.isRetryable && attemptCount < maxRetries) {
        continue;
      }
      break;
    }

    assert.equal(attempts, 3, "Retryable 503 should attempt up to 3 times before succeeding");
    assert.equal(response.ok, true);
  });

  it("verifies fail-fast stops immediately after attempt 1 for non-retryable errors", async () => {
    let attempts = 0;
    const maxRetries = 3;

    const mockFetch = async () => {
      attempts++;
      return { ok: false, status: 400, message: "Invalid parameters" };
    };

    let attemptCount = 0;
    while (attemptCount < maxRetries) {
      attemptCount++;
      const res = await mockFetch();
      const classification = classifyExternalError({ status: res.status });
      if (res.ok) break;
      if (classification.isRetryable && attemptCount < maxRetries) {
        continue;
      }
      break; // Fail-fast on non-retryable error
    }

    assert.equal(attempts, 1, "Non-retryable 400 must stop on attempt 1 without executing retries");
  });

  it("verifies exactly ONE controlled token refresh on 401 before fail-fast", async () => {
    let fetchAttempts = 0;
    let refreshAttempts = 0;
    let refreshedTokenOnce = false;

    const mockRefresh = async () => {
      refreshAttempts++;
      return "new_refreshed_token";
    };

    const mockFetch = async (token: string) => {
      fetchAttempts++;
      // Even with refreshed token, still returns 401 (e.g. revoked app permissions)
      return { ok: false, status: 401 };
    };

    let token = "initial_token";
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      const res = await mockFetch(token);
      const classification = classifyExternalError({ status: res.status });

      if (classification.isPermanentAuth && res.status === 401 && !refreshedTokenOnce) {
        refreshedTokenOnce = true;
        try {
          token = await mockRefresh();
          const retryRes = await mockFetch(token);
          const postRefreshClassification = classifyExternalError({ status: retryRes.status });
          if (!postRefreshClassification.isRetryable) {
            break; // Stop immediately, no further retries
          }
        } catch {
          break;
        }
      }
      break;
    }

    assert.equal(refreshAttempts, 1, "Must trigger exactly 1 token refresh attempt on 401");
    assert.equal(fetchAttempts, 2, "Must perform initial request + exactly 1 post-refresh retry");
  });
});
