import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

describe("Sprint 12.1 Real Database Integration: dailySummary Deduplication & 42P10 Prevention", () => {
  const dbUrl = process.env.DATABASE_URL_TEST;
  if (!dbUrl) {
    // Only run when disposable test database is active
    return;
  }

  let sql: postgres.Sql;
  const tenantId = "00000000-0000-0000-0000-000000000099";

  before(async () => {
    sql = postgres(dbUrl, { max: 1 });
    await sql`SET CLIENT_ENCODING TO 'UTF8'`;

    // Apply canonical fixture and Sprint 12 migration
    const schemaSql = fs.readFileSync(path.resolve(__dirname, "../fixtures/testSchema.sql"), "utf-8");
    await sql.unsafe(schemaSql);

    const sprint12Sql = fs.readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20260912000000_sprint12_notifications_center.sql"),
      "utf-8"
    );
    await sql.unsafe(sprint12Sql);

    // Create test tenant
    await sql`
      INSERT INTO public.tenants (id, name, slug, plan, status, notifications_watermark_at)
      VALUES (${tenantId}::uuid, 'Daily Summary Store', 'daily-summary-store', 'pro', 'active', now())
      ON CONFLICT (id) DO NOTHING
    `;

    // Clean any previous alerts for this tenant
    await sql`DELETE FROM public.alerts WHERE tenant_id = ${tenantId}::uuid`;
  });

  after(async () => {
    if (sql) {
      await sql`DELETE FROM public.alerts WHERE tenant_id = ${tenantId}::uuid`;
      await sql`DELETE FROM public.alerts WHERE tenant_id = '00000000-0000-0000-0000-000000000098'::uuid`;
      await sql.end();
    }
  });

  test("Verificación 42P10: La sintaxis de PostgREST ON CONFLICT (tenant_id, dedupe_key) sin predicado falla con 42P10", async () => {
    const dedupeKey = `tenant:${tenantId}:cache:daily_summary`;
    
    // Simular lo que PostgREST genera cuando se hace .upsert(..., { onConflict: "tenant_id,dedupe_key" })
    let postgrestError: any = null;
    try {
      await sql`
        INSERT INTO public.alerts (tenant_id, title, body, dedupe_key)
        VALUES (${tenantId}::uuid, 'Test PostgREST', 'Body', ${dedupeKey}::text)
        ON CONFLICT (tenant_id, dedupe_key)
        DO UPDATE SET body = EXCLUDED.body
      `;
    } catch (err: any) {
      postgrestError = err;
    }

    assert.ok(postgrestError, "Debe fallar porque el índice es parcial (WHERE dedupe_key IS NOT NULL)");
    assert.equal(postgrestError.code, "42P10", "El código de error debe ser exactamente 42P10 (invalid_column_reference / no unique constraint matching)");
  });

  test("Ejecución 1: RPC upsert_alert_dedupe inserta el resumen inicial", async () => {
    const dedupeKey = `tenant:${tenantId}:cache:daily_summary`;
    const initialBody = "Ventas hoy: $150.000. Top producto: Mate Imperial. 2 productos con stock critico.";

    const [row1] = await sql`
      SELECT * FROM public.upsert_alert_dedupe(
        ${tenantId}::uuid,
        'daily_summary_archived'::text,
        'activity'::text,
        'info'::text,
        'system'::text,
        'Resumen Diario - 07/09/2026'::text,
        ${initialBody}::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        ${dedupeKey}::text,
        'archived'::text,
        true::boolean,
        '{}'::jsonb
      )
    `;

    assert.ok(row1.id);
    assert.equal(row1.body, initialBody);
    assert.equal(row1.status, "archived");
    assert.equal(row1.is_read, true);
    assert.equal(row1.dedupe_key, dedupeKey);

    const rowsCount = await sql`
      SELECT count(*)::int as count FROM public.alerts
      WHERE tenant_id = ${tenantId}::uuid AND dedupe_key = ${dedupeKey}
    `;
    assert.equal(rowsCount[0].count, 1, "Debe existir exactamente 1 fila tras la primera ejecución");
  });

  test("Ejecución 2: Segunda ejecución actualiza la MISMA fila sin error 42P10 y permanece exactamente 1 fila", async () => {
    const dedupeKey = `tenant:${tenantId}:cache:daily_summary`;
    const updatedBody = "Ventas hoy: $210.000. Top producto: Mate Imperial. 1 producto con stock critico (actualizado).";

    // Obtener el ID original
    const [beforeRow] = await sql`
      SELECT id, body, updated_at FROM public.alerts
      WHERE tenant_id = ${tenantId}::uuid AND dedupe_key = ${dedupeKey}
    `;
    assert.ok(beforeRow);
    const originalId = beforeRow.id;

    // Ejecución 2 con el RPC transaccional
    let caughtError: any = null;
    let row2: any = null;
    try {
      const [res] = await sql`
        SELECT * FROM public.upsert_alert_dedupe(
          ${tenantId}::uuid,
          'daily_summary_archived'::text,
          'activity'::text,
          'info'::text,
          'system'::text,
          'Resumen Diario - 07/09/2026'::text,
          ${updatedBody}::text,
          NULL::text,
          NULL::text,
          NULL::text,
          NULL::text,
          ${dedupeKey}::text,
          'archived'::text,
          true::boolean,
          '{"updated": true}'::jsonb
        )
      `;
      row2 = res;
    } catch (err: any) {
      caughtError = err;
    }

    // Aserciones de no-error
    assert.equal(caughtError, null, "No debe arrojar ningún error de PostgreSQL (cero 42P10, cero 23505)");
    assert.ok(row2);
    assert.equal(row2.id, originalId, "El ID de la fila debe ser EXACTAMENTE el mismo (misma fila actualizada)");
    assert.equal(row2.body, updatedBody, "El body debe haberse actualizado correctamente");

    // Verificar conteo total en la base de datos
    const afterCount = await sql`
      SELECT count(*)::int as count FROM public.alerts
      WHERE tenant_id = ${tenantId}::uuid AND dedupe_key = ${dedupeKey}
    `;
    assert.equal(afterCount[0].count, 1, "Debe permanecer estrictamente 1 fila (cero crecimiento o duplicación)");

    // Verificar conteo total de alerts para el tenant
    const totalTenantAlerts = await sql`
      SELECT count(*)::int as count FROM public.alerts
      WHERE tenant_id = ${tenantId}::uuid
    `;
    assert.equal(totalTenantAlerts[0].count, 1, "No debe haber alertas huérfanas en el tenant");
  });

  test("Aislamiento Multi-Tenant: Tenant B genera su propio resumen sin colisión ni fuga", async () => {
    const tenantB = "00000000-0000-0000-0000-000000000098";
    await sql`
      INSERT INTO public.tenants (id, name, slug, plan, status, notifications_watermark_at)
      VALUES (${tenantB}::uuid, 'Tenant B Store', 'tenant-b-store', 'pro', 'active', now())
      ON CONFLICT (id) DO NOTHING
    `;

    const dedupeKey = `tenant:${tenantB}:cache:daily_summary`;
    const [rowB] = await sql`
      SELECT * FROM public.upsert_alert_dedupe(
        ${tenantB}::uuid,
        'daily_summary_archived'::text,
        'activity'::text,
        'info'::text,
        'system'::text,
        'Resumen Diario Tenant B'::text,
        'Ventas Tenant B: $50.000'::text,
        NULL::text,
        NULL::text,
        NULL::text,
        NULL::text,
        ${dedupeKey}::text,
        'archived'::text,
        true::boolean,
        '{}'::jsonb
      )
    `;

    assert.ok(rowB.id);
    assert.equal(rowB.tenant_id, tenantB);

    // Tenant A debe seguir teniendo estrictamente 1 alerta
    const [countA] = await sql`SELECT count(*)::int as count FROM public.alerts WHERE tenant_id = ${tenantId}::uuid`;
    assert.equal(countA.count, 1, "Tenant A no debe verse afectado por Tenant B");

    // Tenant B debe tener estrictamente 1 alerta
    const [countB] = await sql`SELECT count(*)::int as count FROM public.alerts WHERE tenant_id = ${tenantB}::uuid`;
    assert.equal(countB.count, 1, "Tenant B debe tener exactamente su alerta");
  });
});
