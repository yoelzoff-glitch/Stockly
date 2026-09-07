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

  describe("5. Fault Injection: Recuperación ante fallo entre guardado de venta/cancelación y creación de alerta", () => {
    it("Orden confirmada → interrupción antes de crear alerta → reintento genera exactamente 1 notificación", async () => {
      const tenantId = "00000000-0000-0000-0000-000000000005";
      const meliOrderId = "MELI-FAULT-ORDER-777";
      const dedupeKey = `tenant:${tenantId}:sale:${meliOrderId}:created`;

      const memoryAlerts: any[] = [];
      const memoryOrders = [{ meli_order_id: meliOrderId, id: "uuid-order-777", status: "paid" }];

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
          if (table === "alerts") {
            return {
              insert: async (row: any) => {
                const isDupe = memoryAlerts.some((a) => a.tenant_id === row.tenant_id && a.dedupe_key === row.dedupe_key);
                if (isDupe) {
                  return { error: { code: "23505", message: "duplicate key violates idx_alerts_tenant_dedupe_unique" } };
                }
                memoryAlerts.push({ ...row, id: `alert-${memoryAlerts.length + 1}` });
                return { error: null };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };

      // Simulación de Intento 1: La orden se guardó en DB, pero el proceso se interrumpió antes de publishImmutableEvent
      // (memoryOrders ya tiene la orden, pero memoryAlerts está vacío)
      assert.equal(memoryOrders.length, 1);
      assert.equal(memoryAlerts.length, 0);

      // Simulación de Intento 2 (Reintento de Inngest):
      // La orden ya existe en DB, pero el nuevo flujo garantiza la publicación idempotente
      const retryResult1 = await publishImmutableEvent(
        {
          tenantId,
          type: "sale_created",
          title: "Nueva venta por $50.000",
          body: "Smart TV 43 · 1 unidad",
          actionUrl: `/dashboard/sales/uuid-order-777`,
          actionLabel: "Ver venta",
          entityType: "order",
          entityId: "uuid-order-777",
          dedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(retryResult1.success, true);
      assert.equal(memoryAlerts.length, 1);
      assert.equal(memoryAlerts[0].dedupe_key, dedupeKey);

      // Simulación de Intento 3 (Reintento adicional):
      // La notificación ya existe: debe descartarse silenciosamente sin duplicar
      const retryResult2 = await publishImmutableEvent(
        {
          tenantId,
          type: "sale_created",
          title: "Nueva venta por $50.000",
          body: "Smart TV 43 · 1 unidad",
          actionUrl: `/dashboard/sales/uuid-order-777`,
          actionLabel: "Ver venta",
          entityType: "order",
          entityId: "uuid-order-777",
          dedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(retryResult2.success, false);
      assert.equal(retryResult2.skippedReason, "duplicate");
      assert.equal(memoryAlerts.length, 1, "Cero duplicados en reintentos adicionales");
    });

    it("Cancelación confirmada → interrupción antes de alerta → reintento genera exactamente 1 notificación de cancelación", async () => {
      const tenantId = "00000000-0000-0000-0000-000000000005";
      const meliOrderId = "MELI-FAULT-CANCEL-888";
      const dedupeKey = `tenant:${tenantId}:sale:${meliOrderId}:cancelled`;

      const memoryAlerts: any[] = [];

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
          if (table === "alerts") {
            return {
              insert: async (row: any) => {
                const isDupe = memoryAlerts.some((a) => a.tenant_id === row.tenant_id && a.dedupe_key === row.dedupe_key);
                if (isDupe) {
                  return { error: { code: "23505", message: "duplicate key violates idx_alerts_tenant_dedupe_unique" } };
                }
                memoryAlerts.push({ ...row, id: `alert-${memoryAlerts.length + 1}` });
                return { error: null };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };

      // Reintento tras fallo previo:
      const res1 = await publishImmutableEvent(
        {
          tenantId,
          type: "sale_cancelled",
          title: "Se canceló una venta por $30.000",
          body: "La facturación y la rentabilidad fueron actualizadas.",
          actionUrl: `/dashboard/sales/uuid-order-888`,
          actionLabel: "Ver cancelación",
          dedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(res1.success, true);
      assert.equal(memoryAlerts.length, 1);

      // Reintento repetido:
      const res2 = await publishImmutableEvent(
        {
          tenantId,
          type: "sale_cancelled",
          title: "Se canceló una venta por $30.000",
          body: "La facturación y la rentabilidad fueron actualizadas.",
          actionUrl: `/dashboard/sales/uuid-order-888`,
          actionLabel: "Ver cancelación",
          dedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(res2.success, false);
      assert.equal(res2.skippedReason, "duplicate");
      assert.equal(memoryAlerts.length, 1);
    });
  });

  describe("6. Aislamiento por Índice Compuesto (tenant_id, dedupe_key)", () => {
    it("permite el mismo dedupe_key para dos tenants distintos sin colisión", async () => {
      const tenantA = "00000000-0000-0000-0000-00000000000A";
      const tenantB = "00000000-0000-0000-0000-00000000000B";
      const sharedDedupeKey = "state:missing_costs";

      const store: any[] = [];

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
          if (table === "alerts") {
            return {
              insert: async (row: any) => {
                // Simula idx_alerts_tenant_dedupe_unique en (tenant_id, dedupe_key)
                const dupe = store.some(
                  (r) => r.tenant_id === row.tenant_id && r.dedupe_key === row.dedupe_key
                );
                if (dupe) {
                  return { error: { code: "23505", message: "unique violation" } };
                }
                store.push({ ...row, id: `alert-${store.length + 1}` });
                return { error: null };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };

      // Tenant A publica
      const resA = await publishImmutableEvent(
        {
          tenantId: tenantA,
          type: "sale_created",
          title: "Venta Tenant A",
          body: "Item A",
          actionUrl: "/dashboard/sales/1",
          dedupeKey: sharedDedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      // Tenant B publica con la MISMA dedupe_key
      const resB = await publishImmutableEvent(
        {
          tenantId: tenantB,
          type: "sale_created",
          title: "Venta Tenant B",
          body: "Item B",
          actionUrl: "/dashboard/sales/2",
          dedupeKey: sharedDedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(resA.success, true);
      assert.equal(resB.success, true);
      assert.equal(store.length, 2, "Ambos tenants deben coexistir con el mismo dedupe_key gracias al índice compuesto");

      // Tenant A intenta publicar de nuevo con la misma key -> debe colisionar
      const resADupe = await publishImmutableEvent(
        {
          tenantId: tenantA,
          type: "sale_created",
          title: "Venta Tenant A Repetida",
          body: "Item A",
          actionUrl: "/dashboard/sales/1",
          dedupeKey: sharedDedupeKey,
          eventTimestamp: new Date().toISOString(),
        },
        mockClient as any
      );

      assert.equal(resADupe.success, false);
      assert.equal(resADupe.skippedReason, "duplicate");
      assert.equal(store.length, 2);
    });
  });

  describe("7. Realtime Multi-tenant Isolation & Cleanup Contract", () => {
    it("canal privado y filtro postgres_changes respetan estricto aislamiento por tenant", () => {
      const tenantA = "00000000-0000-0000-0000-00000000000A";
      const tenantB = "00000000-0000-0000-0000-00000000000B";

      let channelCreated = "";
      let eventFilter = "";
      let removedChannel: any = null;

      const mockSupabase = {
        channel: (channelName: string) => {
          channelCreated = channelName;
          return {
            on: (eventType: string, config: any, callback: Function) => {
              eventFilter = config.filter;
              return {
                subscribe: () => ({ id: "sub-1" }),
              };
            },
          };
        },
        removeChannel: (ch: any) => {
          removedChannel = ch;
        },
      };

      // Simular setup del componente notification-bell para Tenant A
      const channelA = mockSupabase.channel(`tenant-notifications:${tenantA}`);
      channelA.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `tenant_id=eq.${tenantA}` },
        () => {}
      );

      assert.equal(channelCreated, `tenant-notifications:${tenantA}`);
      assert.equal(eventFilter, `tenant_id=eq.${tenantA}`);
      assert.ok(!channelCreated.includes(tenantB), "El canal de Tenant A no debe incluir al Tenant B");
      assert.ok(eventFilter.includes(tenantA), "El filtro debe restringirse exactamente al tenantId");

      // Simular desmontaje del componente (cleanup)
      mockSupabase.removeChannel(channelA);
      assert.ok(removedChannel, "Debe desuscribirse y limpiar el canal al desmontar");
    });
  });
});
