import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Isolated mocks for external boundaries
const tables: Record<string, any[]> = {};
let api: (args: any) => Promise<any>;
let failWrite = "";
let failRead = "";
let leaseAvailable = true;
let apiCalls: string[] = [];
let writes: string[] = [];
let executions: any[] = [];
const tenantId = "tenant-sprint41";

const step = { run: async (_id: string, fn: any) => fn() };


function query(table: string) {
  let op = "select", payload: any, conflict = "id", one = false;
  let predicates: ((row: any) => boolean)[] = [];
  let start = 0, end = Infinity;
  const q: any = {
    select: () => q,
    eq: (k: string, v: any) => { predicates.push(r => k === "tenants.is_demo" ? !r.tenants?.is_demo : r[k] === v); return q; },
    in: (k: string, vs: any[]) => { predicates.push(r => vs.includes(r[k])); return q; },
    not: (k: string, _op: string, v: any) => { predicates.push(r => r[k] != v); return q; },
    gte: (k: string, v: any) => { predicates.push(r => r[k] >= v); return q; },
    order: () => q,
    range: (a: number, b: number) => { start = a; end = b + 1; return q; },
    limit: (n: number) => { end = n; return q; },
    single: () => { one = true; return q; },
    maybeSingle: () => { one = true; return q; },
    update: (p: any) => { op = "update"; payload = p; return q; },
    insert: (p: any) => { op = "insert"; payload = p; return q; },
    upsert: (p: any, opts: any) => { op = "upsert"; payload = p; conflict = opts?.onConflict || "id"; return q; },
    delete: () => { throw new Error("Delete not allowed"); },
    then: (resolve: any, reject: any) => Promise.resolve().then(() => {
      if ((op === "select" && failRead === table) || (op !== "select" && failWrite === table)) {
        return { data: null, error: { message: `injected ${table} failure` } };
      }
      const rows = tables[table] ||= [];
      let result = rows.filter(r => predicates.every(p => p(r))).slice(start, end);
      if (op === "update") { result.forEach(r => Object.assign(r, payload)); writes.push(table); }
      if (op === "insert") {
        const p = Array.isArray(payload) ? payload[0] : payload;
        if (table === "webhook_events" && rows.some(r => r.provider === p.provider && r.event_key === p.event_key)) {
          return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
        }
        const created = { id: randomUUID(), ...p };
        rows.push(created);
        writes.push(table);
        return { data: structuredClone(one ? created : [created]), error: null };
      }
      if (op === "upsert") {
        result = (Array.isArray(payload) ? payload : [payload]).map(p => {
          const row = rows.find(r => conflict.split(",").every(k => r[k.trim()] === p[k.trim()]));
          if (row) { Object.assign(row, p); return row; }
          const created = { id: randomUUID(), ...p }; rows.push(created); return created;
        });
        writes.push(table);
      }
      return { data: structuredClone(one ? result[0] || null : result), error: null };
    }).then(resolve, reject),
  };
  return q;
}

const db = {
  from: query,
  rpc: async (name: string, args: any) => {
    if (failWrite === "shipments") return { error: { message: "injected shipment persistence failure" } };
    await query("shipments").upsert(args?.p_shipment || {}, { onConflict: "tenant_id,order_id" });
    return { error: null };
  },
};

function boundary(path: string, exports: any) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports } as any;
}

boundary("../../src/lib/supabase/admin", { createAdminClient: () => db });
boundary("../../src/services/meli/client", { meliFetch: async (args: any) => { apiCalls.push(args.endpoint); return api(args); } });
boundary("../../src/lib/observability/egress", { logEgressSample: () => {} });
boundary("../../src/lib/observability/operationRuns", { recordSyncExecution: async (e: any) => executions.push(e) });
boundary("../../src/services/inventory/decrementInternalStockFromOrder", { decrementInternalStockFromOrder: async () => {} });
boundary("../../src/services/notifications/notificationService", { publishImmutableEvent: async () => {}, upsertStateAlert: async () => {} });
boundary("../../src/services/super-admin/activity", { recordMlSyncActivity: async () => {} });
boundary("../../src/lib/demo/assert-demo-write-allowed", { isDemoTenant: async () => false });
boundary("../../src/lib/security/leases", {
  withOperationLease: async (_p: any, fn: any) => leaseAvailable ? { executed: true, result: await fn() } : { executed: false, skipReason: "busy" },
  acquireLock: async () => true,
  releaseLock: () => {},
  isLocked: () => false,
});
boundary("../../src/inngest/client", { inngest: { createFunction: (opts: any, handler: any) => ({ opts, handler }), send: async () => {} } });

// Production dependencies required AFTER boundaries are set
const { getOrders } = require("../../src/services/meli/getOrders");
const { syncOrders } = require("../../src/services/meli/syncOrders");
const { syncOrdersTenantJob } = require("../../src/jobs/syncOrdersJob");
const { updateWebhookEventStatus, claimWebhookEvent } = require("../../src/lib/security/idempotency");


beforeEach(() => {
  Object.keys(tables).forEach(k => delete tables[k]);
  tables.tenants = [{ id: tenantId, metadata: { packaging_cost: 3500 } }];
  tables.meli_accounts = [{ id: "account", tenant_id: tenantId, meli_user_id: "99", status: "connected" }];
  tables.products = [{ id: "product-1", tenant_id: tenantId, meli_item_id: "MLA-P1", sku: "SKU-P1", cost: 15000 }];
  tables.webhook_events = [];
  tables.orders = [];
  tables.order_items = [];
  tables.shipments = [];
  tables.meli_sync_state = [];

  failRead = failWrite = "";
  leaseAvailable = true;
  apiCalls = [];
  writes = [];
  executions = [];

  process.env.LIBRETAX_SHIPMENTS_FROM_ORDERS_FULL_SYNC = "false";
  process.env.LIBRETAX_CANCELLATIONS_FROM_ORDERS_FULL_SYNC = "false";
  process.env.LIBRETAX_INCREMENTAL_ORDERS_SYNC = "true";

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [], paging: { total: 0 } };
    throw new Error(`Unexpected API call: ${endpoint}`);
  };
});

// =========================================================================
// PARTE 14: Escenario Pago Fácil obligatorio
// =========================================================================
test("Caso Pago Fácil obligatorio: Orden creada a las 17:15 y pagada a las 19:27 es encontrada por el cron de las 19:50 vía date_last_updated", async () => {
  const pagoFacilOrder = {
    id: 2000018611729760,
    seller: { id: 99 },
    status: "paid",
    total_amount: 84178.68,
    date_created: "2026-09-23T20:15:51.000Z", // 17:15 ART
    date_closed: "2026-09-23T22:27:35.000Z",  // 19:27 ART
    last_updated: "2026-09-23T22:29:12.000Z", // 19:29 ART
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 84178.68, sale_fee: 13468.59 }],
  };

  // Watermark at 19:50 ART (22:50 UTC)
  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T22:50:00.000Z",
  }];

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) {
      // Must use date_last_updated, not date_created
      assert.ok(endpoint.includes("order.date_last_updated.from="), "Search must filter by order.date_last_updated.from");
      assert.ok(!endpoint.includes("order.date_created.from="), "Search must NOT filter by order.date_created.from");
      return { results: [pagoFacilOrder], paging: { total: 1 } };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const syncedCount = await syncOrders(tenantId);
  assert.equal(syncedCount, 1);
  assert.equal(tables.orders.length, 1);
  assert.equal(tables.orders[0].meli_order_id, "2000018611729760");
  assert.equal(tables.orders[0].status, "paid");
  assert.equal(tables.orders[0].total_amount, 84178.68);
});

// =========================================================================
// PARTE 15: Tests A a L
// =========================================================================

test("Test A: Orden creada y pagada inmediatamente sincroniza correctamente", async () => {
  const instantOrder = {
    id: 101, seller: { id: 99 }, status: "paid", total_amount: 50000,
    date_created: "2026-09-23T20:00:00.000Z",
    date_closed: "2026-09-23T20:00:02.000Z",
    last_updated: "2026-09-23T20:00:05.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 50000 }],
  };

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [instantOrder], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 1);
  assert.equal(tables.orders.length, 1);
  assert.equal(tables.orders[0].meli_order_id, "101");
});

test("Test B: Orden creada hace más de 2 horas y pagada ahora sincroniza por date_last_updated", async () => {
  const delayedOrder = {
    id: 102, seller: { id: 99 }, status: "paid", total_amount: 60000,
    date_created: "2026-09-23T18:00:00.000Z", // 2+ hours ago
    last_updated: "2026-09-23T20:30:00.000Z", // updated now
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 60000 }],
  };

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) {
      assert.ok(endpoint.includes("order.date_last_updated.from="));
      return { results: [delayedOrder], paging: { total: 1 } };
    }
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 1);
  assert.equal(tables.orders[0].meli_order_id, "102");
});

test("Test C: Webhook no llega -> Cron incremental recupera la orden en su siguiente ciclo", async () => {
  const missedOrder = {
    id: 103, seller: { id: 99 }, status: "paid", total_amount: 70000,
    date_created: "2026-09-23T20:10:00.000Z",
    last_updated: "2026-09-23T20:15:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 70000 }],
  };

  // No webhook received in tables.webhook_events
  assert.equal(tables.webhook_events.length, 0);

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [missedOrder], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 1);
  assert.equal(tables.orders[0].meli_order_id, "103");
});

test("Test D: Webhook llega y después aparece en cron -> idempotente, 1 sola orden en BD", async () => {
  const orderD = {
    id: 104, seller: { id: 99 }, status: "paid", total_amount: 45000,
    date_created: "2026-09-23T20:00:00.000Z",
    last_updated: "2026-09-23T20:01:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 45000 }],
  };

  api = async ({ endpoint }) => {
    if (endpoint === "/orders/104") return structuredClone(orderD);
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [structuredClone(orderD)], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  // 1. Webhook execution
  tables.webhook_events.push({ id: "wh-104", tenant_id: tenantId, status: "queued" });
  await syncOrdersTenantJob.handler({ event: { data: { tenantId, resource: "/orders/104", eventId: "wh-104" } }, step });
  assert.equal(tables.orders.length, 1);

  // 2. Cron execution later
  await syncOrders(tenantId);
  assert.equal(tables.orders.length, 1, "Order must remain exactly 1 in DB");
});

test("Test E: Misma orden aparece por overlap en 3 ciclos sucesivos -> continúa existiendo una sola", async () => {
  const orderE = {
    id: 105, seller: { id: 99 }, status: "paid", total_amount: 32000,
    date_created: "2026-09-23T20:00:00.000Z",
    last_updated: "2026-09-23T20:05:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 32000 }],
  };

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [structuredClone(orderE)], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  // Cycle 1
  await syncOrders(tenantId);
  assert.equal(tables.orders.length, 1);

  // Cycle 2 (overlap)
  await syncOrders(tenantId);
  assert.equal(tables.orders.length, 1);

  // Cycle 3 (overlap)
  await syncOrders(tenantId);
  assert.equal(tables.orders.length, 1);
  assert.equal(tables.orders[0].meli_order_id, "105");
});

test("Test F: Cron encuentra cero órdenes -> no consulta orders ni shipments y avanza watermark", async () => {
  const startedAt = "2026-09-23T21:00:00.000Z";
  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T20:55:00.000Z",
  }];

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search")) return { results: [], paging: { total: 0 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 0);

  // No queries to orders table or shipments
  assert.equal(writes.filter(w => w === "orders").length, 0);
  assert.equal(writes.filter(w => w === "shipments").length, 0);

  // Watermark WAS advanced
  assert.equal(writes.filter(w => w === "meli_sync_state").length, 1);
  assert.notEqual(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-23T20:55:00.000Z");
});

test("Test G: Falla Mercado Libre -> Watermark NO avanza", async () => {
  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T20:55:00.000Z",
  }];

  api = async () => {
    throw new Error("Mercado Libre 500 Internal Error");
  };

  await assert.rejects(syncOrders(tenantId), /Mercado Libre 500/);
  assert.equal(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-23T20:55:00.000Z");
});

test("Test H: Falla persistencia de una orden -> Watermark NO avanza", async () => {
  const orderH = {
    id: 108, seller: { id: 99 }, status: "paid", total_amount: 10000,
    date_created: "2026-09-23T20:00:00.000Z",
    last_updated: "2026-09-23T20:05:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 10000 }],
  };

  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T20:55:00.000Z",
  }];

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [orderH], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  failWrite = "orders";
  await assert.rejects(syncOrders(tenantId), /Failed to save synced orders/);
  assert.equal(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-23T20:55:00.000Z");
});

test("Test I: Hay dos páginas de resultados -> debe procesarlas ambas antes de avanzar watermark", async () => {
  const orderP1 = {
    id: 201, seller: { id: 99 }, status: "paid", total_amount: 10000,
    last_updated: "2026-09-23T20:00:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 10000 }],
  };
  const orderP2 = {
    id: 202, seller: { id: 99 }, status: "paid", total_amount: 20000,
    last_updated: "2026-09-23T20:01:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 20000 }],
  };

  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T20:00:00.000Z",
  }];

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.includes("offset=0")) return { results: [orderP1], paging: { total: 51 } };
    if (endpoint.includes("offset=50")) return { results: [orderP2], paging: { total: 51 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 2);
  assert.equal(tables.orders.length, 2);
  assert.ok(tables.orders.some(o => o.meli_order_id === "201"));
  assert.ok(tables.orders.some(o => o.meli_order_id === "202"));
  assert.notEqual(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-23T20:00:00.000Z");
});

test("Test J: Falla página 2 -> Watermark NO avanza", async () => {
  const orderP1 = {
    id: 301, seller: { id: 99 }, status: "paid", total_amount: 10000,
    last_updated: "2026-09-23T20:00:00.000Z",
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 10000 }],
  };

  tables.meli_sync_state = [{
    tenant_id: tenantId,
    resource_type: "orders",
    last_successful_sync_at: "2026-09-23T20:00:00.000Z",
  }];

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.includes("offset=0")) return { results: [orderP1], paging: { total: 51 } };
    if (endpoint.includes("offset=50")) throw new Error("Network timeout on page 2");
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  await assert.rejects(syncOrders(tenantId), /page 2/);
  assert.equal(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-23T20:00:00.000Z");
});

test("Test K: Orden local tiene meli_last_updated más reciente que incoming -> no se sobreescribe", async () => {
  // Local order has newer updated timestamp
  tables.orders = [{
    id: "uuid-401",
    tenant_id: tenantId,
    meli_order_id: "401",
    status: "paid",
    total_amount: 99000,
    raw_data: { last_updated: "2026-09-23T22:30:00.000Z" },
    packaging_cost_snapshot: 3500,
    cost_snapshot_frozen_at: "2026-09-23T22:30:00.000Z",
  }];

  // Incoming order from ML with older last_updated
  const olderIncomingOrder = {
    id: 401, seller: { id: 99 }, status: "paid", total_amount: 50000,
    date_created: "2026-09-23T20:00:00.000Z",
    last_updated: "2026-09-23T21:00:00.000Z", // Older than 22:30!
    order_items: [{ item: { id: "MLA-P1", seller_sku: "SKU-P1" }, quantity: 1, unit_price: 50000 }],
  };

  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [olderIncomingOrder], paging: { total: 1 } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };

  const count = await syncOrders(tenantId);
  assert.equal(count, 0, "Older incoming order must be skipped");
  assert.equal(tables.orders[0].total_amount, 99000, "Local amount must NOT be overwritten");
});

test("Test L: Notificación webhook duplicada -> no genera orden duplicada", async () => {
  const claim1 = await claimWebhookEvent({
    provider: "mercadolibre",
    eventKey: "meli_99_orders__orders_501_delivery1",
    tenantId,
    topic: "orders_v2",
    payload: { resource: "/orders/501", user_id: 99 },
    correlationId: "c-1",
  });
  assert.equal(claim1.isDuplicate, false);
  await updateWebhookEventStatus(claim1.eventId, "queued");

  // Second delivery of the identical event
  const claim2 = await claimWebhookEvent({
    provider: "mercadolibre",
    eventKey: "meli_99_orders__orders_501_delivery1",
    tenantId,
    topic: "orders_v2",
    payload: { resource: "/orders/501", user_id: 99 },
    correlationId: "c-2",
  });
  assert.equal(claim2.isDuplicate, true);
  assert.equal(tables.webhook_events.length, 1);
});
