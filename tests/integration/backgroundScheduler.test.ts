import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("Supabase trigger validates Vault and installs 32 daily ticks without duplicating schedules", async () => {
  const db = new PGlite();
  try {
    // External extensions are represented at their SQL boundary; the shipped
    // trigger, validation, permission statements and scheduling SQL run unchanged.
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA vault; CREATE SCHEMA net; CREATE SCHEMA cron;
      CREATE TABLE vault.decrypted_secrets(name text primary key, decrypted_secret text);
      CREATE TABLE net.requests(url text, headers jsonb, timeout_ms integer);
      CREATE FUNCTION net.http_get(url text, headers jsonb, timeout_milliseconds integer)
      RETURNS bigint LANGUAGE sql AS 'INSERT INTO net.requests VALUES ($1,$2,$3); SELECT 1::bigint';
      CREATE TABLE cron.jobs(name text primary key, schedule text, command text);
      CREATE FUNCTION cron.schedule(name text, schedule text, command text)
      RETURNS bigint LANGUAGE sql AS 'INSERT INTO cron.jobs VALUES ($1,$2,$3) ON CONFLICT(name) DO UPDATE SET schedule=excluded.schedule, command=excluded.command; SELECT 1::bigint';`);
    const script = fs.readFileSync("supabase/sql/schedule_vercel_background.sql", "utf8")
      .replace(/^CREATE EXTENSION.*$/gm, "");
    await assert.rejects(db.exec(script), /Missing Vault configuration/);
    await db.exec("ROLLBACK");
    await db.query("INSERT INTO vault.decrypted_secrets VALUES ($1,$2),($3,$4)", [
      "libretax_background_url", "https://example.test", "libretax_cron_secret", "a".repeat(40),
    ]);
    await db.exec(script); await db.exec(script);
    const jobs = (await db.query<any>("SELECT * FROM cron.jobs")).rows;
    assert.equal(jobs.length, 4);
    assert.equal((await db.query("SELECT * FROM net.requests")).rows.length, 0);
    const times: number[] = [];
    for (let hour = 0; hour < 24; hour++) for (const job of jobs) {
      const [minute, hours] = job.schedule.split(" ");
      const [range, step] = hours.split("/");
      const start = range === "*" ? 0 : Number(range.split("-")[0]);
      if (hour >= start && (hour - start) % Number(step) === 0) times.push(hour * 60 + Number(minute));
    }
    times.sort((a,b) => a-b);
    assert.equal(times.length, 32);
    times.forEach((time,i) => assert.equal((times[(i+1)%32] + (i===31 ? 1440 : 0))-time, 45));
    await db.exec("SELECT public.trigger_libretax_background()");
    const request = (await db.query<any>("SELECT * FROM net.requests")).rows[0];
    assert.equal(request.url, "https://example.test/api/cron/background");
    assert.equal(request.headers.Authorization, "Bearer " + "a".repeat(40));
    assert.equal(request.timeout_ms, 300000);
    const permission = (await db.query<any>("SELECT has_function_privilege('anon','trigger_libretax_background()','EXECUTE') AS allowed")).rows[0];
    assert.equal(permission.allowed, false);
    assert.equal("crons" in JSON.parse(fs.readFileSync("vercel.json", "utf8")), false);
  } finally { await db.close(); }
});
