import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run the production services/workers; replace only external boundaries.
const tables: Record<string, any[]> = {};
let api: (args: any) => Promise<any>;
let failWrite = "";
let failRead = "";
let leaseAvailable = true;
let apiCalls: string[] = [];
let writes: string[] = [];
let executions: any[] = [];
const tenantId = "tenant-a";
const order = {
  id: 123, seller: { id: 9 }, status: "paid", shipping: { id: 456 },
  total_amount: 85900, date_created: "2026-09-19T12:00:00Z",
  order_items: [{ item: { id: "MLA1", seller_sku: "A1" }, quantity: 1, unit_price: 85900, sale_fee: 13744 }],
};
const shipment = {
  id: 456, status: "ready_to_ship", logistic_type: "cross_docking", mode: "me2",
  shipping_option: { list_cost: 6500 }, receiver_address: { city: { name: "CABA" }, state: { name: "Capital Federal" } },
  last_updated: "2026-09-19T12:01:00Z",
};

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
    delete: () => { throw new Error("Non-atomic shipment deletion forbidden"); },
    then: (resolve: any, reject: any) => Promise.resolve().then(() => {
      if ((op === "select" && failRead === table) || (op !== "select" && failWrite === table)) {
        return { data: null, error: { message: `injected ${table} failure` } };
      }
      const rows = tables[table] ||= [];
      let result = rows.filter(r => predicates.every(p => p(r))).slice(start, end);
      if (op === "update") { result.forEach(r => Object.assign(r, payload)); writes.push(table); }
      if (op === "upsert" || op === "insert") {
        result = (Array.isArray(payload) ? payload : [payload]).map(p => {
          const row = op === "upsert" && rows.find(r => conflict.split(",").every(k => r[k.trim()] === p[k.trim()]));
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
    if (name === "advance_meli_sync_watermark") {
      const existing = (tables.meli_sync_state || []).find(
        (s: any) => s.tenant_id === args.p_tenant_id && s.resource_type === args.p_resource_type
      );
      if (existing) {
        existing.last_successful_sync_at = args.p_new_watermark;
      } else {
        tables.meli_sync_state = tables.meli_sync_state || [];
        tables.meli_sync_state.push({
          tenant_id: args.p_tenant_id,
          resource_type: args.p_resource_type,
          last_successful_sync_at: args.p_new_watermark,
        });
      }
      return { data: { success: true, advanced: true, watermark: args.p_new_watermark }, error: null };
    }
    assert.equal(name, "persist_meli_shipment");
    if (failWrite === "shipments") return { error: { message: "injected shipment persistence failure" } };
    assert.equal(args.p_tenant_id, tenantId);
    await query("shipments").upsert(args.p_shipment, { onConflict: "tenant_id,order_id" });
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
boundary("../../src/lib/security/leases", { withOperationLease: async (_p: any, fn: any) => leaseAvailable ? { executed: true, result: await fn() } : { executed: false, skipReason: "busy" } });
boundary("../../src/inngest/client", { inngest: { createFunction: (opts: any, handler: any) => ({ opts, handler }) } });
const { syncOrders } = require("../../src/services/meli/syncOrders");
const { syncShipments } = require("../../src/services/meli/syncShipments");
const { getOrders } = require("../../src/services/meli/getOrders");
const { syncOrdersTenantJob, syncOrdersDispatcherJob } = require("../../src/jobs/syncOrdersJob");
const { repairOrdersJob } = require("../../src/jobs/repairOrdersJob");
const { updateWebhookEventStatus } = require("../../src/lib/security/idempotency");
const step = { run: async (_id: string, fn: any) => fn() };

beforeEach(() => {
  Object.keys(tables).forEach(k => delete tables[k]);
  tables.tenants = [{ id: tenantId, metadata: { packaging_cost: 4000 } }];
  tables.meli_accounts = [{ id: "account", tenant_id: tenantId, meli_user_id: "9", status: "connected" }];
  tables.products = [{ id: "product", tenant_id: tenantId, meli_item_id: "MLA1", sku: "A1", cost: 20597.32 }];
  tables.webhook_events = [{ id: "event", tenant_id: tenantId, status: "queued" }];
  failRead = failWrite = ""; leaseAvailable = true; apiCalls = []; writes = []; executions = [];
  process.env.LIBRETAX_SHIPMENTS_FROM_ORDERS_FULL_SYNC = "false";
  process.env.LIBRETAX_CANCELLATIONS_FROM_ORDERS_FULL_SYNC = "false";
  process.env.LIBRETAX_INCREMENTAL_ORDERS_SYNC = "true";
  api = async ({ endpoint }) => {
    if (endpoint.startsWith("/orders/search/archived")) return { results: [], paging: { total: 0 } };
    if (endpoint.startsWith("/orders/search")) return { results: [structuredClone(order)], paging: { total: 1 } };
    if (endpoint === "/orders/123") return structuredClone(order);
    if (endpoint === "/shipments?ids=456") return [{ code: 200, body: structuredClone(shipment) }];
    if (endpoint === "/shipments/456") return structuredClone(shipment);
    throw new Error(`Unexpected API call: ${endpoint}`);
  };
});

test("real order webhook persists sale, items, shipping cost, method and destination; replay preserves cost snapshots", async () => {
  const event = { name: "meli/orders.updated", data: { tenantId, resource: "/orders/123", eventId: "event" } };
  const result = await syncOrdersTenantJob.handler({ event, step });
  assert.equal(result.status, "completed");
  assert.equal(tables.webhook_events[0].status, "completed");
  assert.equal(tables.orders.length, 1);
  assert.equal(tables.order_items.length, 1);
  assert.equal(tables.shipments[0].shipping_cost, 6500);
  assert.equal(tables.shipments[0].receiver_city, "CABA");
  assert.equal(tables.shipments[0].logistic_type, "cross_docking");
  assert.equal(apiCalls.filter(p => p.includes("shipments")).length, 1, "reuse shipment response");
  tables.products[0].cost = 99999;
  tables.tenants[0].metadata.packaging_cost = 99999;
  await syncOrdersTenantJob.handler({ event, step });
  assert.equal(tables.orders.length, 1);
  assert.equal(tables.shipments.length, 1);
  assert.equal(tables.order_items[0].unit_cost_snapshot, 20597.32);
  assert.equal(tables.orders[0].packaging_cost_snapshot, 4000);
});

test("shipment arriving before order is retryable, then order sync hydrates it", async () => {
  await assert.rejects(syncShipments(tenantId, "456"), /not synced yet/);
  await syncOrders(tenantId, "123");
  assert.equal(await syncShipments(tenantId, "456"), 1);
  assert.equal(tables.shipments.length, 1);
});

test("failed targeted order request marks retrying, never completed", async () => {
  api = async () => { throw new Error("ML 503"); };
  await assert.rejects(syncOrdersTenantJob.handler({ event: { data: { tenantId, resource: "/orders/123", eventId: "event" } }, step }), /ML 503/);
  assert.equal(tables.webhook_events[0].status, "retrying");
  assert.ok(!executions.some(e => e.status === "completed"));
});

test("busy distributed lease retries instead of acknowledging the sale", async () => {
  leaseAvailable = false;
  await assert.rejects(syncOrdersTenantJob.handler({ event: { data: { tenantId, resource: "/orders/123", eventId: "event" } }, step }), /lease unavailable/);
  assert.equal(tables.webhook_events[0].status, "retrying");
  assert.equal(apiCalls.length, 0);
});

test("failed second search page never returns partial success", async () => {
  api = async ({ endpoint }) => {
    if (endpoint.includes("offset=0")) return { results: [order], paging: { total: 51 } };
    throw new Error("page 2 failed");
  };
  await assert.rejects(getOrders(tenantId, "9"), /page 2 failed/);
});

test("invalid search response is an error; optional missing archive is allowed", async () => {
  api = async () => ({});
  await assert.rejects(getOrders(tenantId, "9"), /Invalid orders response/);
  api = async ({ endpoint }) => {
    if (endpoint.includes("archived")) throw Object.assign(new Error("not found"), { statusCode: 404 });
    return { results: [order], paging: { total: 1 } };
  };
  assert.equal((await getOrders(tenantId, "9")).length, 1);
});

test("shipment persistence failure keeps the watermark unchanged and surfaces the error", async () => {
  tables.meli_sync_state = [{ tenant_id: tenantId, resource_type: "orders", last_successful_sync_at: "2026-09-19T00:00:00Z" }];
  failWrite = "shipments";
  await assert.rejects(syncOrders(tenantId), /shipment persistence failure/);
  assert.equal(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-19T00:00:00Z");
  assert.ok(executions.some(e => e.status === "failed"));
  failWrite = "";
  await syncOrders(tenantId);
  assert.equal(tables.shipments[0].shipping_cost, 6500);
  assert.notEqual(tables.meli_sync_state[0].last_successful_sync_at, "2026-09-19T00:00:00Z");
});

test("item persistence failure is retried, not hidden behind completed orders", async () => {
  failWrite = "order_items";
  await assert.rejects(syncOrders(tenantId), /Failed to save item/);
  assert.ok(!writes.includes("meli_sync_state"));
});

test("failed snapshot reads abort instead of replacing historical costs", async () => {
  failRead = "orders";
  await assert.rejects(syncOrders(tenantId, "123"), /snapshot/);
  assert.ok(!writes.includes("orders"));
});

test("missing multiget entry falls back to shipment detail before freezing costs", async () => {
  const base = api;
  api = async args => args.endpoint.includes("?ids=") ? [{ code: 404 }] : base(args);
  await syncOrders(tenantId, "123");
  assert.ok(apiCalls.includes("/shipments/456"));
  assert.equal(tables.shipments[0].shipping_cost, 6500);
});

test("unknown shipping cost fails instead of silently storing zero", async () => {
  const base = api;
  api = async args => args.endpoint.includes("shipments") ? [{ code: 200, body: { ...shipment, shipping_option: undefined } }] : base(args);
  await assert.rejects(syncOrders(tenantId, "123"), /cost is not available/);
  assert.equal(tables.shipments?.length || 0, 0);
});

test("late queued acknowledgment cannot overwrite completed webhook status", async () => {
  tables.webhook_events[0].status = "completed";
  await updateWebhookEventStatus("event", "queued");
  assert.equal(tables.webhook_events[0].status, "completed");
});

test("five-minute dispatcher works even with old reduced flag and enqueues isolated recovery", async () => {
  process.env.LIBRETAX_ORDERS_RECONCILIATION_MODE = "reduced";
  const sent: any[] = [];
  const result = await syncOrdersDispatcherJob.handler({ step: { sendEvent: async (_id: string, events: any[]) => sent.push(...events) } });
  assert.equal(result.dispatched, 1);
  assert.equal(sent[0].name, "meli/tenant.sync-orders.requested");
  assert.equal(sent[1].name, "meli/orders.repair.requested");
});

test("history recovery repairs an old missing sale despite newer watermark; marker only after shipment success", async () => {
  const event = { data: { tenantId, dateFrom: "2026-09-13T00:00:00Z", repair: true } };
  tables.meli_sync_state = [{ tenant_id: tenantId, resource_type: "orders", last_successful_sync_at: "2026-09-20T09:00:00Z" }];
  failWrite = "shipments";
  await assert.rejects(repairOrdersJob.handler({ event, step }), /persistence failure/);
  assert.equal(tables.meli_sync_state.length, 1);
  failWrite = "";
  assert.equal((await repairOrdersJob.handler({ event, step })).recovered, 1);
  assert.equal(tables.meli_sync_state.length, 2);
  assert.equal(tables.shipments[0].receiver_city, "CABA");
  assert.equal((await repairOrdersJob.handler({ event, step })).skipped, true);
});

test("exhausted order retries record dead letter with the original event", async () => {
  await syncOrdersTenantJob.opts.onFailure({ event: { data: { event: { data: { tenantId, eventId: "event" } } } }, error: new Error("ML unavailable") });
  assert.equal(tables.webhook_events[0].status, "dead_letter");
});

test("valid zero shipping cost is persisted, not classified as missing", async () => {
  const base = api;
  api = async args => args.endpoint.includes("?ids=")
    ? [{ code: 200, body: { ...shipment, shipping_option: { list_cost: 0 } } }]
    : base(args);
  await syncOrders(tenantId, "123");
  assert.equal(tables.shipments[0].shipping_cost, 0);
});

test("one unavailable shipment cannot hide either sale or prevent the other shipment from syncing", async () => {
  const secondOrder = { ...order, id: 124, shipping: { id: 457 } };
  const base = api;
  api = async args => {
    if (args.endpoint.startsWith("/orders/search") && !args.endpoint.includes("archived")) {
      return { results: [order, secondOrder], paging: { total: 2 } };
    }
    if (args.endpoint === "/shipments?ids=456,457") return [{ code: 200, body: shipment }, { code: 404 }];
    if (args.endpoint === "/shipments/457") throw Object.assign(new Error("not yet available"), { statusCode: 404 });
    return base(args);
  };
  await assert.rejects(syncOrders(tenantId), /not available yet/);
  assert.equal(tables.orders.length, 2);
  assert.equal(tables.order_items.length, 2);
  assert.equal(tables.shipments.length, 1);
  assert.equal(tables.shipments[0].meli_shipment_id, "456");
  assert.equal(tables.orders.find(o => o.meli_order_id === "124").cost_snapshot_frozen_at, null);
  assert.ok(!writes.includes("meli_sync_state"));
});
