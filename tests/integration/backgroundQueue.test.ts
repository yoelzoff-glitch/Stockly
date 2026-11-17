import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Vercel queue: durable claims, concurrency, priority, crash recovery and permissions", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
    await db.exec(fs.readFileSync("supabase/migrations/20261117000000_vercel_background_jobs.sql", "utf8"));
    const insert = (key: string, concurrency: string, priority: number) => db.query(
      "INSERT INTO background_jobs(dedupe_key,function_id,event,concurrency_key,priority) VALUES ($1,'test','{}',$2,$3) ON CONFLICT (dedupe_key) DO NOTHING", [key, concurrency, priority]);
    await insert("history", "history", 30);
    await insert("sale1", "orders:ana", 0);
    await insert("sale2", "orders:ana", 0);
    await insert("sale1", "orders:ana", 0);
    assert.equal((await db.query("SELECT * FROM background_jobs")).rows.length, 3);
    const claim = async (who = owner) => (await db.query<any>("SELECT * FROM claim_background_job($1)", [who])).rows[0];
    const first = await claim();
    assert.equal(first.dedupe_key, "sale1", "live sales precede history");
    const second = await claim(other);
    assert.equal(second.dedupe_key, "history", "same tenant/function cannot overlap");
    assert.equal(await claim(), undefined);
    await db.query("UPDATE background_jobs SET lease_expires_at=now()-interval '1 second',steps=$2 WHERE id=$1", [first.id, '{"saved":{"done":true,"value":42}}']);
    const recovered = await claim(other);
    assert.equal(recovered.id, first.id);
    assert.equal(recovered.attempts, 2);
    assert.equal(recovered.steps.saved.value, 42, "resume keeps completed steps");
    const staleWrite = await db.query("UPDATE background_jobs SET status='completed' WHERE id=$1 AND lease_owner=$2 RETURNING id", [first.id, owner]);
    assert.equal(staleWrite.rows.length, 0, "stale owner cannot finish a reclaimed job");
    await db.query("UPDATE background_jobs SET attempts=max_attempts,lease_expires_at=now()-interval '1 second' WHERE id=$1", [first.id]);
    assert.equal((await claim()).dedupe_key, "sale2");
    assert.equal((await db.query<any>("SELECT status FROM background_jobs WHERE id=$1", [first.id])).rows[0].status, "failed");
    const permissions = (await db.query<any>(`SELECT
      has_table_privilege('authenticated','background_jobs','SELECT') AS read,
      has_function_privilege('anon','claim_background_job(uuid,uuid)','EXECUTE') AS claim,
      has_function_privilege('service_role','claim_background_job(uuid,uuid)','EXECUTE') AS service`)).rows[0];
    assert.deepEqual(permissions, { read: false, claim: false, service: true });
  } finally { await db.close(); }
});

test("budget migration caps global concurrency and excludes maintenance from webhooks", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;");
    for (const migration of ["20261117000000_vercel_background_jobs", "20261117000001_background_budget"]) {
      await db.exec(fs.readFileSync(`supabase/migrations/${migration}.sql`, "utf8"));
    }
    await db.exec(`INSERT INTO background_jobs(dedupe_key,function_id,event,concurrency_key,priority) VALUES
      ('cron','cron','{"name":"inngest/scheduled.timer"}','cron',1),
      ('history','repair','{"name":"meli/orders.repair.requested"}','history',30);`);
    const live = () => db.query<any>("SELECT * FROM claim_background_job($1,null,true)", [owner]);
    assert.equal((await live()).rows.length, 0, "webhook must not start maintenance, even high-priority dispatchers");
    await db.exec(`INSERT INTO background_jobs(dedupe_key,function_id,event,concurrency_key,priority) VALUES
      ('sale1','orders','{"name":"meli/orders.updated"}','orders:a',0),
      ('sale2','orders','{"name":"meli/orders.updated"}','orders:b',0),
      ('sale3','orders','{"name":"meli/orders.updated"}','orders:c',0);`);
    assert.equal((await live()).rows.length, 1);
    assert.equal((await live()).rows.length, 1);
    assert.equal((await live()).rows.length, 0, "global maximum is two even for distinct tenants");
    await db.exec("UPDATE background_jobs SET status='completed' WHERE dedupe_key IN ('sale1','sale2','sale3','cron')");
    const history = (await db.query<any>("SELECT * FROM claim_background_job($1)", [owner])).rows[0];
    assert.equal(history.dedupe_key, "history");
    await db.exec(`INSERT INTO background_jobs(dedupe_key,function_id,event,concurrency_key,priority) VALUES
      ('other-history','repair','{"name":"meli/orders.repair.requested"}','other-history',30),
      ('sale4','orders','{"name":"meli/orders.updated"}','orders:d',0);`);
    assert.equal((await live()).rows[0].dedupe_key, "sale4", "maintenance reserves room for live work");
    const permissions = (await db.query<any>("SELECT has_function_privilege('authenticated','claim_background_job(uuid,uuid,boolean)','EXECUTE') AS allowed")).rows[0];
    assert.equal(permissions.allowed, false);
  } finally { await db.close(); }
});
