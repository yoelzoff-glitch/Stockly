import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  publishImmutableEvent,
  upsertStateAlert,
  sanitizeActionUrl,
} from "../../src/services/notifications/notificationService";

describe("Sprint 12 — Centro de Alertas y Actividad Operativa Tests", () => {
  describe("1. Idempotencia y Concurrencia", () => {
    it("20 intentos concurrentes de insertar la misma venta resultan en exactamente 1 registro", async () => {
      const tenantId = "00000000-0000-0000-0000-000000000001";
      const meliOrderId = "MELI-CONCURRENT-999";
      const dedupeKey = `tenant:${tenantId}:sale:${meliOrderId}:created`;

      const memoryStore: any[] = [];

      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { notifications_watermark_at: new Date(Date.now() - 3600000).toISOString() },
                  }),
                }),
              }),
            };
          }
          assert.equal(table, "alerts");
          return {
            insert: async (row: any) => {
              // Simulate PostgreSQL UNIQUE constraint on dedupe_key
              const exists = memoryStore.some((r) => r.dedupe_key === row.dedupe_key);
              if (exists) {
                return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
              }
              memoryStore.push({ ...row, id: `alert-${memoryStore.length + 1}` });
              return { error: null };
            },
          };
        },
      };

      // 20 concurrent publish attempts
      const promises = Array.from({ length: 20 }, (_, i) =>
        publishImmutableEvent(
          {
            tenantId,
            type: "sale_created",
            title: `Nueva venta por $10.000 (intento ${i + 1})`,
            body: "Pulsera Plata 925 · 1 unidad",
            actionUrl: `/dashboard/sales/sale-${meliOrderId}`,
            dedupeKey,
            eventTimestamp: new Date().toISOString(),
          },
          mockClient as any
        )
      );

      const results = await Promise.all(promises);

      // Exactly one should succeed, 19 should be skipped due to duplicate key
      const succeeded = results.filter((r) => r.success);
      const skippedDuplicates = results.filter((r) => !r.success && r.skippedReason === "duplicate");

      assert.equal(succeeded.length, 1);
      assert.equal(skippedDuplicates.length, 19);
      assert.equal(memoryStore.length, 1);
      assert.equal(memoryStore[0].dedupe_key, dedupeKey);
    });
  });

  describe("2. Watermark Temporal", () => {
    it("descarta silenciosamente ventas anteriores al watermark del tenant", async () => {
      const tenantId = "00000000-0000-0000-0000-000000000002";
      const watermark = new Date("2026-09-01T00:00:00Z");
      const historicalDate = new Date("2026-08-15T12:00:00Z"); // anterior al watermark

      let insertCalled = false;

      const mockClient = {
        from: (table: string) => {
          if (table === "tenants") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { notifications_watermark_at: watermark.toISOString() },
                  }),
                }),
              }),
            };
          }
          if (table === "alerts") {
            return {
              insert: async () => {
                insertCalled = true;
                return { error: null };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };

      const result = await publishImmutableEvent(
        {
          tenantId,
          type: "sale_created",
          title: "Venta histórica antigua",
          body: "Venta antigua",
          dedupeKey: `tenant:${tenantId}:sale:HISTORICAL:created`,
          eventTimestamp: historicalDate,
        },
        mockClient as any
      );

      assert.equal(result.success, false);
      assert.equal(result.skippedReason, "pre_watermark");
      assert.equal(insertCalled, false, "Insert must not be called for pre-watermark historical orders");
    });
  });

  describe("3. Alertas de Estado Agregadas (Ciclo open -> resolved)", () => {
    it("maneja correctamente el ciclo de vida de missing_costs (creación -> actualización de cantidad -> resolución)", async () => {
      const tenantId = "00000000-0000-0000-0000-000000000003";
      const dedupeKey = `tenant:${tenantId}:state:missing_costs`;

      let activeAlert: any = null;

      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "alerts");
          return {
            select: () => ({
              eq: (field1: string, val1: any) => ({
                eq: (field2: string, val2: any) => ({
                  maybeSingle: async () => ({ data: activeAlert }),
                  eq: (field3: string, val3: any) => ({
                    maybeSingle: async () => ({
                      data: activeAlert && activeAlert.status === val3 ? activeAlert : null,
                    }),
                  }),
                }),
              }),
            }),
            insert: async (row: any) => {
              activeAlert = { ...row, id: "alert-state-1", status: "open" };
              return { error: null };
            },
            update: (patch: any) => ({
              eq: (field: string, id: string) => {
                if (activeAlert && activeAlert.id === id) {
                  activeAlert = { ...activeAlert, ...patch };
                }
                return Promise.resolve({ error: null });
              },
            }),
          };
        },
      };

      // Paso 1: 5 productos sin costo -> alerta abierta con count = 5
      const res1 = await upsertStateAlert(
        {
          tenantId,
          type: "missing_costs",
          title: "Hay 5 productos sin costo",
          body: "Faltan costos",
          actionUrl: "/dashboard/products",
          actionLabel: "Cargar costos",
          dedupeKey,
          count: 5,
        },
        mockClient as any
      );

      assert.equal(res1.status, "opened");
      assert.equal(activeAlert.status, "open");
      assert.equal(activeAlert.title, "Hay 5 productos sin costo");
      assert.equal(activeAlert.metadata.count, 5);

      // Paso 2: La cantidad cambia a 3 -> la MISMA alerta se actualiza, no se crea otra
      const res2 = await upsertStateAlert(
        {
          tenantId,
          type: "missing_costs",
          title: "Hay 3 productos sin costo",
          body: "Faltan costos",
          actionUrl: "/dashboard/products",
          actionLabel: "Cargar costos",
          dedupeKey,
          count: 3,
        },
        mockClient as any
      );

      assert.equal(res2.status, "updated");
      assert.equal(activeAlert.status, "open");
      assert.equal(activeAlert.title, "Hay 3 productos sin costo");
      assert.equal(activeAlert.metadata.count, 3);
      assert.equal(activeAlert.id, "alert-state-1", "Debe ser el mismo ID de alerta");

      // Paso 3: Todos los costos cargados (count = 0) -> alerta pasa a status = resolved
      const res3 = await upsertStateAlert(
        {
          tenantId,
          type: "missing_costs",
          title: "Hay 0 productos sin costo",
          body: "",
          dedupeKey,
          count: 0,
        },
        mockClient as any
      );

      assert.equal(res3.status, "resolved");
      assert.equal(activeAlert.status, "resolved");
      assert.ok(activeAlert.resolved_at, "Debe tener resolved_at asignado");
    });
  });

  describe("4. Seguridad y Sanitización de URLs (Open Redirect Prevention)", () => {
    it("acepta únicamente rutas internas relativas dentro de /dashboard", () => {
      // Rutas válidas
      assert.equal(sanitizeActionUrl("/dashboard/sales/123"), "/dashboard/sales/123");
      assert.equal(sanitizeActionUrl("/dashboard/products?filter=no-cost"), "/dashboard/products?filter=no-cost");
      assert.equal(sanitizeActionUrl("/dashboard/integrations"), "/dashboard/integrations");

      // Rutas maliciosas o externas rechazadas
      assert.equal(sanitizeActionUrl("https://evil.com"), null);
      assert.equal(sanitizeActionUrl("http://attacker.com/dashboard"), null);
      assert.equal(sanitizeActionUrl("//malicious-site.com"), null);
      assert.equal(sanitizeActionUrl("javascript:alert(1)"), null);
      assert.equal(sanitizeActionUrl("data:text/html,<script>alert(1)</script>"), null);
      assert.equal(sanitizeActionUrl("/api/danger"), null);
      assert.equal(sanitizeActionUrl(""), null);
      assert.equal(sanitizeActionUrl(undefined), null);
    });
  });
});
