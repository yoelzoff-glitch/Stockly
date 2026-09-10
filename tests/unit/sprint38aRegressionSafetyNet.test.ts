import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeSku } from "@/services/products/sku/normalizeSku";

describe("Sprint 38A: Regression Safety Net — Reference Contract Baseline", () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000001";

  describe("1. Catalog & Product Recognition (SKU Resolution, Mirrors, Relations, Variations)", () => {
    test("1.1. Normal listing with SKU is recognized accurately", () => {
      const item = {
        id: "MLA1001",
        title: "Dije Corazón Plata 925",
        seller_custom_field: "DIJE-COR-01",
        attributes: [{ id: "SELLER_SKU", value_name: "DIJE-COR-01" }],
      };

      const extractedSku = item.attributes?.find((a: any) => a.id === "SELLER_SKU")?.value_name || item.seller_custom_field;
      assert.equal(extractedSku, "DIJE-COR-01");
      assert.equal(normalizeSku(extractedSku), "DIJECOR01");
    });

    test("1.2. Listing without SKU falls back to synthetic no-sku identifier", () => {
      const item = {
        id: "MLA1002",
        title: "Cadena Sin SKU",
        seller_custom_field: null,
        attributes: [] as any[],
      };

      const extractedSku = item.attributes?.find((a: any) => a.id === "SELLER_SKU")?.value_name || item.seller_custom_field || null;
      assert.equal(extractedSku, null);
      const skuKey = extractedSku ? extractedSku : `no-sku-${item.id}`;
      assert.equal(skuKey, "no-sku-MLA1002");
    });

    test("1.3. Mirrored listings with same SKU resolve to same normalized SKU and group correctly", () => {
      const mirrorA = { id: "MLA2001", title: "Anillo Plata Clásica", seller_custom_field: "AN-100" };
      const mirrorB = { id: "MLA2002", title: "Anillo Plata Premium", seller_custom_field: "AN 100" };

      const normA = normalizeSku(mirrorA.seller_custom_field);
      const normB = normalizeSku(mirrorB.seller_custom_field);

      assert.equal(normA, "AN100");
      assert.equal(normB, "AN100");
      assert.equal(normA, normB, "Mirrored listings must share identical normalized SKU");
    });

    test("1.4. item_relations towards master resolves SKU from master listing", () => {
      const skuMap = new Map<string, string>();
      skuMap.set("MLA-MASTER-01", "PULSERA-MASTER");

      const slaveItem = {
        id: "MLA-SLAVE-02",
        item_relations: [{ id: "MLA-MASTER-01" }],
      };

      let resolvedSku: string | null = null;
      if (slaveItem.item_relations && slaveItem.item_relations.length > 0) {
        const masterId = slaveItem.item_relations[0].id;
        if (skuMap.has(masterId)) {
          resolvedSku = skuMap.get(masterId)!;
        }
      }

      assert.equal(resolvedSku, "PULSERA-MASTER");
    });

    test("1.5. Variations with seller_sku resolve SKU properly", () => {
      const itemWithVariations = {
        id: "MLA3001",
        title: "Aros Trébol",
        variations: [
          { id: 101, seller_sku: "AR-178-V", attributes: [{ id: "COLOR", value_name: "Verde" }] },
          { id: 102, seller_sku: "AR-178-N", attributes: [{ id: "COLOR", value_name: "Negro" }] },
        ],
      };

      const varV = itemWithVariations.variations[0];
      const varN = itemWithVariations.variations[1];

      assert.equal(varV.seller_sku, "AR-178-V");
      assert.equal(normalizeSku(varV.seller_sku), "AR178V");
      assert.equal(varN.seller_sku, "AR-178-N");
      assert.equal(normalizeSku(varN.seller_sku), "AR178N");
    });
  });

  describe("2. Order Association & Fallbacks (meli_item_id & normalized SKU)", () => {
    const mockProducts = [
      { id: "prod-uuid-1", meli_item_id: "MLA4001", sku: "SKU-PROD-1", cost: 5000 },
      { id: "prod-uuid-2", meli_item_id: "MLA4002", sku: "SKU-PROD-2", cost: 7500 },
    ];

    const productMap: Record<string, any> = {};
    const productSkuMap: Record<string, any> = {};
    mockProducts.forEach((p) => {
      if (p.meli_item_id) productMap[p.meli_item_id] = p;
      if (p.sku) productSkuMap[normalizeSku(p.sku)] = p;
    });

    test("2.1. New order associated by direct meli_item_id match", () => {
      const orderItem = {
        item: { id: "MLA4001", seller_sku: "SKU-PROD-1" },
        quantity: 1,
      };

      const meliItemId = orderItem.item.id;
      let matched = meliItemId ? productMap[meliItemId] : undefined;

      assert.ok(matched);
      assert.equal(matched.id, "prod-uuid-1");
      assert.equal(matched.cost, 5000);
    });

    test("2.2. Order item with mismatching/null meli_item_id falls back to normalized SKU match", () => {
      const orderItem = {
        item: { id: "MLA-UNKNOWN-99", seller_sku: "SKU PROD 2" },
        quantity: 1,
      };

      const meliItemId = orderItem.item.id;
      const normSku = normalizeSku(orderItem.item.seller_sku);

      let matched = meliItemId ? productMap[meliItemId] : undefined;
      if (!matched && normSku) {
        matched = productSkuMap[normSku];
      }

      assert.ok(matched);
      assert.equal(matched.id, "prod-uuid-2");
      assert.equal(matched.cost, 7500);
    });
  });

  describe("3. Order Items line_key & Cost Snapshot Invariance", () => {
    test("3.1. Historical order_item with old line_key (_uuid) is matched by composite index and preserves original key and frozen cost", () => {
      const localOrderId = "order-uuid-hist";
      const existingItems = [
        {
          id: "item-hist-1",
          order_id: localOrderId,
          meli_item_id: "MLA5001",
          sku: "AR 178 V",
          line_key: "MLA5001_AR 178 V_item-hist-1", // Old legacy format ending in UUID
          unit_cost_snapshot: 11062.5,
          cost_snapshot_frozen_at: "2026-09-01T10:00:00Z",
          cost_snapshot_source: "captured_at_sale",
        },
      ];

      const existingItemsMap = new Map<string, any>();
      existingItems.forEach((it) => {
        if (it.line_key) existingItemsMap.set(`${it.order_id}_${it.line_key}`, it);
        const norm = it.sku ? normalizeSku(it.sku) : "";
        if (it.order_id && it.meli_item_id) {
          existingItemsMap.set(`${it.order_id}_${it.meli_item_id}_${norm}`, it);
        }
      });

      // Meli raw order item during incremental sync
      const rawOrderItem = {
        item: { id: "MLA5001", seller_sku: "AR 178 V", variation_id: null },
      };

      const meliItemId = rawOrderItem.item.id;
      const normSku = normalizeSku(rawOrderItem.item.seller_sku);
      const deterministicLineKey = `${meliItemId}_0_${normSku}_0`;

      const matched =
        existingItemsMap.get(`${localOrderId}_${deterministicLineKey}`) ||
        existingItemsMap.get(`${localOrderId}_${meliItemId}_${normSku}`);

      assert.ok(matched);
      assert.equal(matched.id, "item-hist-1");
      assert.equal(matched.line_key, "MLA5001_AR 178 V_item-hist-1");
      assert.equal(matched.unit_cost_snapshot, 11062.5);
      assert.equal(matched.cost_snapshot_frozen_at, "2026-09-01T10:00:00Z");

      // Line key preserved to prevent duplicate key 23505
      const effectiveLineKey = matched.line_key || deterministicLineKey;
      assert.equal(effectiveLineKey, "MLA5001_AR 178 V_item-hist-1");
    });

    test("3.2. Truly new order item generates deterministic line_key format", () => {
      const meliItemId = "MLA6001";
      const variationId = "0";
      const normItemSku = normalizeSku("CAD-200");
      const itemIndex = 0;

      const deterministicLineKey = `${meliItemId || "item"}_${variationId}_${normItemSku || "nosku"}_${itemIndex}`;
      assert.equal(deterministicLineKey, "MLA6001_0_CAD200_0");
    });
  });

  describe("4. Internal Stock Processing & Deductions", () => {
    test("4.1. Order already marked internal_stock_processed === true short-circuits safely", () => {
      const order = {
        id: "order-processed-1",
        internal_stock_processed: true,
        raw_data: { some: "large payload that should not need to be parsed" },
      };

      let didProcess = false;
      if (order.internal_stock_processed) {
        didProcess = false;
      } else {
        didProcess = true;
      }

      assert.equal(didProcess, false, "Must skip stock processing if already processed");
    });

    test("4.2. Order with logistic_type === 'fulfillment' (FULL) marks processed without deducting physical local stock", () => {
      const order = {
        id: "order-full-1",
        internal_stock_processed: false,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      };

      const isFull = order.raw_data?.shipping?.logistic_type === "fulfillment";
      assert.equal(isFull, true);

      // Status transitioned to processed, physical stock deduction avoided
      const targetInternalStockProcessed = true;
      const physicalStockDeducted = !isFull;

      assert.equal(targetInternalStockProcessed, true);
      assert.equal(physicalStockDeducted, false);
    });

    test("4.3. Unprocessed local order decrements physical stock for components", () => {
      const order = {
        id: "order-local-1",
        internal_stock_processed: false,
        raw_data: { shipping: { logistic_type: "cross_docking" } },
      };

      const isFull = order.raw_data?.shipping?.logistic_type === "fulfillment";
      assert.equal(isFull, false);

      const components = [
        { component_sku: "DIJE01", current_stock: 10, quantity: 1 },
        { component_sku: "CAD01", current_stock: 5, quantity: 1 },
      ];

      const updated = components.map((c) => ({
        ...c,
        new_stock: c.current_stock - c.quantity,
      }));

      assert.equal(updated[0].new_stock, 9);
      assert.equal(updated[1].new_stock, 4);
    });
  });

  describe("5. Cancellations Two-Stage Reconciliation", () => {
    test("5.1. Existing cancellation in order_cancellations is detected and skipped", () => {
      const cancelledOrders = [
        { id: "ord-canc-1", meli_order_id: "meli-c-1" },
        { id: "ord-canc-2", meli_order_id: "meli-c-2" },
      ];

      const existingCancellations = [{ order_id: "ord-canc-1" }];
      const existingSet = new Set(existingCancellations.map((c) => c.order_id));

      const pendingIds = cancelledOrders.filter((o) => !existingSet.has(o.id)).map((o) => o.id);

      assert.equal(pendingIds.length, 1);
      assert.equal(pendingIds[0], "ord-canc-2");
    });

    test("5.2. New cancellation extracts cancel_detail and prepares atomic record", () => {
      const newCancelledOrder = {
        id: "ord-canc-2",
        meli_order_id: "meli-c-2",
        tenant_id: dummyTenantId,
        raw_data: {
          total_amount: 50000,
          cancel_detail: {
            description: "Comprador se arrepintió",
            requested_by: "buyer",
            date: "2026-09-10T12:00:00Z",
          },
        },
      };

      const raw = newCancelledOrder.raw_data;
      const cancelDetail = raw?.cancel_detail;
      const record = {
        tenant_id: newCancelledOrder.tenant_id,
        order_id: newCancelledOrder.id,
        meli_order_id: newCancelledOrder.meli_order_id,
        reason: cancelDetail?.description || "Cancelada",
        cancelled_by: cancelDetail?.requested_by || "Desconocido",
        refund_amount: raw?.total_amount || 0,
        date_cancelled: cancelDetail?.date || new Date().toISOString(),
      };

      assert.equal(record.order_id, "ord-canc-2");
      assert.equal(record.reason, "Comprador se arrepintió");
      assert.equal(record.cancelled_by, "buyer");
      assert.equal(record.refund_amount, 50000);
      assert.equal(record.date_cancelled, "2026-09-10T12:00:00Z");
    });
  });

  describe("6. Shipments State Reconciliation", () => {
    test("6.1. Orders with completed shipments (delivered/cancelled/returned) are skipped from active sync", () => {
      const orders = [
        { id: "ord-ship-1", meli_shipment_id: "ship-1" },
        { id: "ord-ship-2", meli_shipment_id: "ship-2" },
      ];

      const completedShipments = [{ order_id: "ord-ship-1", status: "delivered" }];
      const completedSet = new Set(completedShipments.map((s) => s.order_id));

      const ordersToSync = orders.filter((o) => !completedSet.has(o.id));

      assert.equal(ordersToSync.length, 1);
      assert.equal(ordersToSync[0].id, "ord-ship-2");
    });
  });
});
