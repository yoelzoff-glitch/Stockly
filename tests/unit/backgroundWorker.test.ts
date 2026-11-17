import { test } from "node:test";
import assert from "node:assert/strict";
import { executeJob } from "../../src/lib/background/worker";
import { jobDefinitions, usesVercelJobs } from "../../src/lib/background/registry";
import { scheduleBucket } from "../../src/lib/background/queue";
import { GET } from "../../src/app/api/cron/background/route";
import { intervalBucket, VERCEL_INTERVAL_MINUTES } from "../../src/lib/background/policy";
import { productCronDecision, markProductCatalogDirty } from "../../src/services/meli/productCoalescer";
import { RetryAfterError } from "inngest";

function fixture(handler: (context: any) => Promise<any>) {
  jobDefinitions.set("test-worker", { id: "test-worker", triggers: [], handler });
  const job: any = { id: "job", function_id: "test-worker", event: { name: "test", data: {} },
    lease_owner: "owner", status: "running", attempts: 1, max_attempts: 3, steps: {} };
  let writes = 0;
  const client: any = { from: () => ({ update: (values: any) => {
    const filters: any = {};
    const query: any = { eq: (key: string, value: any) => { filters[key] = value; return query; }, select: () => query,
      maybeSingle: async () => {
        if (Object.entries(filters).some(([k,v]) => job[k] !== v)) return { data: null, error: null };
        Object.assign(job, structuredClone(values)); writes++; return { data: { id: job.id }, error: null };
      } };
    return query;
  } }) };
  return { job, client, writes: () => writes };
}

test("completed steps survive a failure and are not re-executed on retry", async () => {
  let first = 0, second = 0;
  const f = fixture(async ({ step }) => {
    assert.equal(await step.run("first", async () => { first++; return 42; }), 42);
    await step.run("second", async () => { second++; if (second === 1) throw new Error("temporary outage"); });
  });
  assert.equal(await executeJob(f.job, "owner", Date.now() + 10000, f.client), "retrying");
  Object.assign(f.job, { lease_owner: "owner", status: "running", attempts: 2 });
  assert.equal(await executeJob(f.job, "owner", Date.now() + 10000, f.client), "completed");
  assert.equal(first, 1); assert.equal(second, 2);
});

test("sleep yields durably without spending retries or waiting in the function", async () => {
  let ran = false;
  const f = fixture(async ({ step }) => { await step.sleep("coalesce", "45s"); ran = true; });
  assert.equal(await executeJob(f.job, "owner", Date.now() + 10000, f.client), "yielded");
  assert.equal(f.job.status, "pending"); assert.equal(f.job.attempts, 0); assert.equal(ran, false);
  f.job.steps["sleep:coalesce"].resumeAt = Date.now() - 1;
  Object.assign(f.job, { lease_owner: "owner", status: "running", attempts: 1 });
  assert.equal(await executeJob(f.job, "owner", Date.now() + 10000, f.client), "completed");
  assert.equal(ran, true);
});

test("time budget preserves pending work and permanent failures terminate", async () => {
  let ran = false;
  const f = fixture(async ({ step }) => step.run("work", async () => { ran = true; throw new Error("bad data"); }));
  assert.equal(await executeJob(f.job, "owner", Date.now() - 1, f.client), "yielded");
  assert.equal(ran, false);
  Object.assign(f.job, { lease_owner: "owner", status: "running", attempts: 3 });
  assert.equal(await executeJob(f.job, "owner", Date.now() + 10000, f.client), "failed");
});

test("schedule buckets tolerate delayed and duplicate cron invocations", () => {
  const now = new Date("2026-11-17T09:07:58Z");
  assert.equal(scheduleBucket("*/5 * * * *", now), "2026-11-17T09:05:00.000Z");
  assert.equal(scheduleBucket("*/15 * * * *", now), "2026-11-17T09:00:00.000Z");
  assert.equal(scheduleBucket("0 */4 * * *", now), "2026-11-17T08:00:00.000Z");
  assert.equal(scheduleBucket("0 4 * * *", new Date("2026-11-17T02:00Z")), "2026-11-16T04:00:00.000Z");
});

test("Vercel is default; cron fails closed with absent/incorrect secret", async () => {
  const oldProvider = process.env.LIBRETAX_BACKGROUND_PROVIDER, oldSecret = process.env.CRON_SECRET;
  try {
    delete process.env.LIBRETAX_BACKGROUND_PROVIDER; delete process.env.CRON_SECRET;
    assert.equal(usesVercelJobs(), true);
    assert.equal((await GET(new Request("https://example.test/api/cron/background", { headers: { authorization: "Bearer undefined" } }))).status, 401);
    process.env.CRON_SECRET = "test-secret";
    assert.equal((await GET(new Request("https://example.test/api/cron/background"))).status, 401);
    process.env.LIBRETAX_BACKGROUND_PROVIDER = "inngest";
    const response = await GET(new Request("https://example.test/api/cron/background", { headers: { authorization: "Bearer test-secret" } }));
    assert.equal(response.status, 200); assert.equal((await response.json()).skipped, true);
  } finally {
    if (oldProvider === undefined) delete process.env.LIBRETAX_BACKGROUND_PROVIDER; else process.env.LIBRETAX_BACKGROUND_PROVIDER = oldProvider;
    if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
  }
});

test("budget uses real 45-minute buckets across midnight and daily history", () => {
  const buckets = new Set<string>();
  for (let minute = 0; minute < 1440; minute++) {
    buckets.add(intervalBucket(45, new Date(Date.UTC(2026, 10, 17, 0, minute))));
  }
  assert.equal(buckets.size, 32);
  assert.equal(VERCEL_INTERVAL_MINUTES["orders-deep-reconciliation"], 1440);
  assert.equal(VERCEL_INTERVAL_MINUTES["cleanup-zombie-users"], 1440);
});

test("catalog dirty flag keeps updates; clean catalogs skip only within the safety window", async () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  assert.equal(productCronDecision({ products_dirty: false, last_full_sync_at: "2026-11-17T11:00:00Z" }, now).skip, true);
  assert.equal(productCronDecision({ products_dirty: true, last_full_sync_at: "2026-11-17T11:00:00Z" }, now).skip, false);
  assert.equal(productCronDecision({ products_dirty: false, last_full_sync_at: "2026-11-17T06:00:00Z" }, now).skip, false);
  assert.equal(productCronDecision(null, now).skip, false);
  let writes = 0;
  const client: any = { from: () => ({ upsert: async (row: any) => {
    writes++; assert.equal(row.products_dirty, true);
    assert.equal(row.tenant_id, "ana"); assert.equal(Object.hasOwn(row, "sync_in_progress"), false);
    return { error: null };
  } }) };
  await markProductCatalogDirty("ana", client);
  assert.equal(writes, 1, "no read before marking dirty");
  await assert.rejects(markProductCatalogDirty("ana", { from: () => ({ upsert: async () => ({ error: { message: "DB unavailable" } }) }) } as any), /DB unavailable/);
});

test("retry-after errors honor provider delay without immediate retry loops", async () => {
  const before = Date.now();
  const f = fixture(async () => { throw new RetryAfterError("rate limit", "10m"); });
  assert.equal(await executeJob(f.job, "owner", before + 10000, f.client), "retrying");
  assert.ok(Date.parse(f.job.available_at) >= before + 600000);
});
