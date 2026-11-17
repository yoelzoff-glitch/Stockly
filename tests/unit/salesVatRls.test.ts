import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

test("VAT migration enforces tenant isolation, active profiles and admin-only writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role;
      CREATE SCHEMA private;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE public.tenants (id uuid PRIMARY KEY);
      CREATE TABLE public.meli_accounts (id uuid PRIMARY KEY);
      INSERT INTO public.tenants VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
      CREATE FUNCTION private.current_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT current_setting('test.tenant')::uuid $$;
      CREATE FUNCTION private.current_profile_is_active() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.active')::boolean $$;
      CREATE FUNCTION private.has_tenant_role(roles text[]) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role') = ANY(roles) $$;
      GRANT USAGE ON SCHEMA private TO authenticated;
    `);
    await db.exec(readFileSync(resolve("supabase/migrations/20261116000000_sales_vat_settings.sql"), "utf8"));
    await db.exec(readFileSync(resolve("supabase/migrations/20261116000001_vat_reconciliations.sql"), "utf8"));
    await db.exec(readFileSync(resolve("supabase/migrations/20261116000002_meli_vat_reports.sql"), "utf8"));
    await db.exec(`
      SET ROLE authenticated;
      SET test.tenant = '00000000-0000-0000-0000-000000000001';
      SET test.active = 'true';
      SET test.role = 'owner';
      INSERT INTO sales_vat_settings (tenant_id, enabled) VALUES ('00000000-0000-0000-0000-000000000001', true);
    `);
    await assert.rejects(db.exec("INSERT INTO sales_vat_settings (tenant_id) VALUES ('00000000-0000-0000-0000-000000000002')"), /row-level security/);
    await assert.rejects(db.exec("UPDATE sales_vat_settings SET rate = -1"), /check constraint/);
    await db.exec("SET test.role = 'member'");
    assert.equal((await db.query("SELECT * FROM sales_vat_settings")).rows.length, 1);
    assert.equal((await db.query("UPDATE sales_vat_settings SET enabled = false RETURNING *")).rows.length, 0);
    await db.exec("SET test.tenant = '00000000-0000-0000-0000-000000000002'");
    assert.equal((await db.query("SELECT * FROM sales_vat_settings")).rows.length, 0);
    await assert.rejects(db.exec("INSERT INTO sales_vat_settings (tenant_id) VALUES ('00000000-0000-0000-0000-000000000002')"), /row-level security/);
    await db.exec("SET test.role = 'admin'");
    await db.exec("INSERT INTO sales_vat_settings (tenant_id) VALUES ('00000000-0000-0000-0000-000000000002')");
    await db.exec("SET test.active = 'false'");
    assert.equal((await db.query("SELECT * FROM sales_vat_settings")).rows.length, 0);
    assert.equal((await db.query("UPDATE sales_vat_settings SET enabled = true RETURNING *")).rows.length, 0);
    await db.exec("SET test.active = 'true'");
    await db.exec(`INSERT INTO vat_reconciliations (tenant_id, month, "values", updated_by)
      VALUES ('00000000-0000-0000-0000-000000000002', '2026-11', '{"month":"2026-11"}', auth.uid())`);
    await assert.rejects(db.exec(`INSERT INTO vat_reconciliations (tenant_id, month, "values", updated_by)
      VALUES ('00000000-0000-0000-0000-000000000001', '2026-11', '{"month":"2026-11"}', auth.uid())`), /row-level security/);
    await db.exec("SET test.role = 'member'");
    assert.equal((await db.query("SELECT * FROM vat_reconciliations")).rows.length, 1);
    assert.equal((await db.query("UPDATE vat_reconciliations SET revision = 2 RETURNING *")).rows.length, 0);
    await db.exec("SET test.tenant = '00000000-0000-0000-0000-000000000001'");
    assert.equal((await db.query("SELECT * FROM vat_reconciliations")).rows.length, 0);
    await assert.rejects(db.exec("INSERT INTO meli_vat_reports DEFAULT VALUES"), /permission denied/);
  } finally {
    await db.close();
  }
});
