import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET as liveGet } from "@/app/api/health/live/route";
import { GET as readyGet } from "@/app/api/health/ready/route";

describe("Health Check Endpoints (/api/health/live & /api/health/ready)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("live endpoint returns 200 with status 'ok' and no version/commit leak", async () => {
    const res = await liveGet();
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.status, "ok");
    // Assert no internal versions, commits, or sensitive info are leaked
    assert.equal(data.version, undefined);
    assert.equal(data.commit, undefined);
    assert.equal(data.timestamp, undefined);
    assert.match(res.headers.get("Cache-Control") || "", /no-store/);
  });

  it("ready endpoint returns 401 when HEALTHCHECK_TOKEN is not configured", async () => {
    delete process.env.HEALTHCHECK_TOKEN;
    const req = new Request("http://localhost:3000/api/health/ready");
    const res = await readyGet(req);
    const data = await res.json();

    assert.equal(res.status, 401);
    assert.equal(data.status, "not_ready");
    assert.match(res.headers.get("Cache-Control") || "", /no-store/);
  });

  it("ready endpoint returns 401 when token header is invalid or missing", async () => {
    process.env.HEALTHCHECK_TOKEN = "valid-secret-token";
    
    // No auth header
    const req1 = new Request("http://localhost:3000/api/health/ready");
    const res1 = await readyGet(req1);
    assert.equal(res1.status, 401);

    // Wrong auth header
    const req2 = new Request("http://localhost:3000/api/health/ready", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res2 = await readyGet(req2);
    assert.equal(res2.status, 401);
  });

  it("ready endpoint returns 200 or 503 safely without leaking database internal errors", async () => {
    process.env.HEALTHCHECK_TOKEN = "valid-secret-token";
    const req = new Request("http://localhost:3000/api/health/ready", {
      headers: { "x-healthcheck-token": "valid-secret-token" },
    });
    const res = await readyGet(req);
    const data = await res.json();

    assert.ok(res.status === 200 || res.status === 503);
    assert.ok(data.status === "ready" || data.status === "not_ready");
    // Ensure no error stack trace or internal Postgres schema is leaked
    assert.equal(data.error, undefined);
    assert.equal(data.message, undefined);
    assert.match(res.headers.get("Cache-Control") || "", /no-store/);
  });
});
