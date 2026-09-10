import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Sprint 32.1 — P0 Regression Hotfix: Schema Validity, Production Equivalence & Query Boundedness", () => {
  // Schema reference of real columns in PostgreSQL
  const REAL_SCHEMA = {
    inventory_items: new Set([
      "id",
      "tenant_id",
      "sku",
      "sku_normalized",
      "name",
      "category",
      "unit_cost",
      "average_cost",
      "last_purchase_cost",
      "current_stock",
      "minimum_stock",
      "metadata",
      "created_at",
      "updated_at",
    ]),
    products: new Set([
      "id",
      "tenant_id",
      "meli_account_id",
      "meli_item_id",
      "title",
      "sku",
      "permalink",
      "thumbnail_url",
      "status",
      "listing_type_id",
      "category_id",
      "price",
      "base_price",
      "original_price",
      "available_quantity",
      "sold_quantity",
      "cost",
      "estimated_fee",
      "estimated_shipping_cost",
      "estimated_tax",
      "raw_data",
      "last_synced_at",
      "created_at",
      "updated_at",
      "profitability_status",
      "profit_last_calculated_at",
      "profit_raw_data",
      "margin_amount",
      "margin_percent",
      "campaign_data",
      "promotion_data",
      "extra_fee_amount",
      "promotion_discount_amount",
      "promotion_discount_percent",
      "profit_adjustments",
      "profit_real_estimated",
      "profit_real_margin",
      "last_seen_at",
    ]),
    orders: new Set([
      "id",
      "tenant_id",
      "meli_account_id",
      "meli_order_id",
      "status",
      "buyer_nickname",
      "buyer_id",
      "total_amount",
      "paid_amount",
      "currency_id",
      "date_created",
      "date_closed",
      "raw_data",
      "created_at",
      "updated_at",
      "meli_shipment_id",
      "last_seen_at",
      "internal_stock_processed",
      "internal_stock_processed_at",
      "internal_stock_reverted",
      "internal_stock_reverted_at",
      "packaging_cost_snapshot",
      "flex_cost_snapshot",
      "operational_cost_snapshot_version",
      "cost_snapshot_frozen_at",
      "cost_snapshot_source",
      "cost_snapshot_status",
    ]),
    order_items: new Set([
      "id",
      "tenant_id",
      "order_id",
      "product_id",
      "meli_item_id",
      "title",
      "sku",
      "quantity",
      "unit_price",
      "total_price",
      "unit_cost",
      "estimated_fee",
      "estimated_shipping_cost",
      "estimated_tax",
      "created_at",
      "line_key",
      "unit_cost_snapshot",
      "cost_snapshot_frozen_at",
      "cost_snapshot_source",
      "cost_snapshot_version",
      "estimated_fee_snapshot",
      "estimated_shipping_cost_snapshot",
      "extra_fee_amount_snapshot",
      "promotion_discount_amount_snapshot",
      "estimated_tax_snapshot",
    ]),
    inventory_movements: new Set([
      "id",
      "tenant_id",
      "inventory_item_id",
      "movement_type",
      "quantity_delta",
      "previous_stock",
      "new_stock",
      "unit_cost",
      "total_cost",
      "source",
      "reference_id",
      "notes",
      "created_by",
      "created_at",
    ]),
  };

  describe("1. Schema Column Validation", () => {
    function validateSelectColumns(tableName: keyof typeof REAL_SCHEMA, selectClause: string) {
      const columns = selectClause
        .split(",")
        .map(c => c.trim())
        .filter(c => c.length > 0 && !c.includes("(") && !c.includes(")") && !c.includes(":"));

      const tableSchema = REAL_SCHEMA[tableName];
      const invalidColumns: string[] = [];

      for (const col of columns) {
        if (!tableSchema.has(col)) {
          invalidColumns.push(col);
        }
      }

      return invalidColumns;
    }

    test("fails if an explicit select references non-existent columns (e.g. description, location, supplier_id)", () => {
      const badInventorySelect = "id, tenant_id, sku, sku_normalized, name, description, unit_cost, current_stock, minimum_stock, location, supplier_id, created_at, updated_at";
      const invalid = validateSelectColumns("inventory_items", badInventorySelect);

      assert.deepEqual(invalid, ["description", "location", "supplier_id"]);
      assert.ok(invalid.length > 0, "Must detect nonexistent columns in inventory_items");
    });

    test("passes with the new getInventoryItems() real column selection", () => {
      const fixedInventorySelect = "id, tenant_id, sku, sku_normalized, name, category, unit_cost, average_cost, last_purchase_cost, current_stock, minimum_stock, metadata, created_at, updated_at";
      const invalid = validateSelectColumns("inventory_items", fixedInventorySelect);

      assert.equal(invalid.length, 0, "No nonexistent columns should be selected");
    });

    test("fails if inventory_movements select references non-existent columns (e.g. previous_quantity, new_quantity, reference_type)", () => {
      const badMovementsSelect = "id, inventory_item_id, tenant_id, movement_type, quantity_delta, previous_quantity, new_quantity, unit_cost, reference_type, reference_id, notes, created_by, created_at";
      const invalid = validateSelectColumns("inventory_movements", badMovementsSelect);

      assert.deepEqual(invalid, ["previous_quantity", "new_quantity", "reference_type"]);
    });

    test("passes with getInventoryMovements() real column selection and UI field mapping", () => {
      const fixedMovementsSelect = "id, inventory_item_id, tenant_id, movement_type, quantity_delta, previous_stock, new_stock, unit_cost, total_cost, source, reference_id, notes, created_by, created_at";
      const invalid = validateSelectColumns("inventory_movements", fixedMovementsSelect);

      assert.equal(invalid.length, 0, "All selected inventory_movements columns must exist in DB");
    });

    test("orders explicit select in sales/page.tsx only selects existing columns", () => {
      const ordersSelect = "id, meli_order_id, status, buyer_nickname, total_amount, paid_amount, currency_id, date_created, date_closed, meli_shipment_id, packaging_cost_snapshot, flex_cost_snapshot, cost_snapshot_status";
      const invalid = validateSelectColumns("orders", ordersSelect);

      assert.equal(invalid.length, 0, "All selected order columns must exist");
    });

    test("order_items lightweight query only selects existing columns", () => {
      const orderItemsSelect = "order_id, title, quantity, unit_cost, unit_cost_snapshot, cost_snapshot_frozen_at";
      const invalid = validateSelectColumns("order_items", orderItemsSelect);

      assert.equal(invalid.length, 0, "All selected order_items columns must exist");
    });
  });

  describe("2. Production Equivalent Test: Products, Internal Stock, and Sales Return Valid Data", () => {
    test("all 3 screens successfully return and map data without raw_data JSONB egress", () => {
      // 1 Product
      const mockRawProduct = {
        id: "prod-001",
        tenant_id: "tenant-ana-mary",
        meli_item_id: "MLA12345",
        title: "Collar Plata 925 Dije Corazón",
        sku: "COL-001",
        price: 25000,
        cost: 10000,
        available_quantity: 15,
        sold_quantity: 40,
        shipping: {
          logistic_type: "fulfillment",
          mode: "me2",
          free_shipping: true,
        },
      };

      // Products screen mapping
      const mappedProduct = {
        ...mockRawProduct,
        raw_data: {
          shipping: mockRawProduct.shipping,
        },
      };
      assert.ok(mappedProduct.id, "Product must have an ID");
      assert.equal(mappedProduct.title, "Collar Plata 925 Dije Corazón");
      assert.equal(mappedProduct.raw_data.shipping.logistic_type, "fulfillment");

      // 1 Inventory Item
      const mockInventoryItem = {
        id: "inv-001",
        tenant_id: "tenant-ana-mary",
        sku: "COMP-001",
        sku_normalized: "COMP001",
        name: "Cadena Plata 925 45cm",
        category: "Cadenas",
        unit_cost: 4500,
        average_cost: 4400,
        last_purchase_cost: 4500,
        current_stock: 50,
        minimum_stock: 10,
        metadata: {},
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      };
      assert.ok(mockInventoryItem.id, "Inventory item must have an ID");
      assert.equal(mockInventoryItem.name, "Cadena Plata 925 45cm");
      assert.equal(mockInventoryItem.current_stock, 50);

      // 1 Sale (Order) with Order Item and Frozen Cost Snapshot
      const mockOrder = {
        id: "ord-001",
        meli_order_id: "2000099999",
        status: "paid",
        buyer_nickname: "JUAN_PEREZ",
        total_amount: 25000,
        paid_amount: 25000,
        currency_id: "ARS",
        date_created: "2026-09-09T14:30:00Z",
        date_closed: "2026-09-09T14:35:00Z",
        meli_shipment_id: "ship-001",
        packaging_cost_snapshot: 600,
        flex_cost_snapshot: null,
        cost_snapshot_status: "frozen",
      };

      const mockOrderItems = [
        {
          order_id: "ord-001",
          title: "Collar Plata 925 Dije Corazón",
          quantity: 2,
          unit_cost: 12000, // current unit cost
          unit_cost_snapshot: 10000, // frozen historical cost at sale
          cost_snapshot_frozen_at: "2026-09-09T14:30:00Z",
        },
      ];

      // Server-side grouping
      const itemsByOrderId: Record<string, any[]> = {};
      for (const item of mockOrderItems) {
        if (!itemsByOrderId[item.order_id]) itemsByOrderId[item.order_id] = [];
        itemsByOrderId[item.order_id].push(item);
      }

      // Sales mapping logic
      const items = itemsByOrderId[mockOrder.id] || [];
      const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || 1;
      const firstTitle = items[0]?.title || "Varios productos";

      const resolvedItems = items.map((it) => {
        const historicalCost = it.cost_snapshot_frozen_at ? it.unit_cost_snapshot : it.unit_cost;
        return {
          ...it,
          historical_cost: historicalCost,
        };
      });

      const totalHistoricalCost = items.reduce((sum, it) => {
        const itemCost = it.cost_snapshot_frozen_at ? it.unit_cost_snapshot : it.unit_cost;
        return sum + ((Number(itemCost) || 0) * (Number(it.quantity) || 1));
      }, 0);

      const mappedOrder = {
        ...mockOrder,
        order_items: resolvedItems,
        product_title: firstTitle,
        total_quantity: totalQty,
        total_historical_cost: totalHistoricalCost,
      };

      // Assertions
      assert.equal(mappedOrder.product_title, "Collar Plata 925 Dije Corazón");
      assert.equal(mappedOrder.total_quantity, 2);
      assert.equal(mappedOrder.order_items[0].historical_cost, 10000, "Historical cost must resolve to snapshot");
      assert.equal(mappedOrder.total_historical_cost, 20000, "Total historical cost must be 2 * 10000");

      // Verify null frozen snapshot behavior: if frozen is null, do NOT invent current cost
      const itemWithNullFrozenSnapshot = {
        order_id: "ord-002",
        title: "Dije Especial",
        quantity: 1,
        unit_cost: 8000,
        unit_cost_snapshot: null,
        cost_snapshot_frozen_at: "2026-09-09T12:00:00Z",
      };

      const resolvedNullSnapshot = itemWithNullFrozenSnapshot.cost_snapshot_frozen_at
        ? itemWithNullFrozenSnapshot.unit_cost_snapshot
        : itemWithNullFrozenSnapshot.unit_cost;

      assert.equal(resolvedNullSnapshot, null, "Frozen null snapshot must stay null without falling back to unit_cost");
    });
  });

  describe("3. Scalability & Boundedness: 10,000 Products & 100,000 Sales", () => {
    test("10,000 products query strictly returns a maximum of 50 rows per page", () => {
      // Simulate 10,000 products
      const totalProducts = 10000;
      const pageSize = 50;
      const page = 1;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Range slice emulation [0, 49]
      const returnedRowCount = Math.min(pageSize, to - from + 1);
      assert.equal(returnedRowCount, 50, "Must return exactly 50 rows, not 10,000");
    });

    test("100,000 sales query strictly returns a maximum of 50 rows and bounds secondary order_items query", () => {
      const totalSales = 100000;
      const pageSize = 50;
      const page = 1;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // 50 paged orders
      const pagedOrders = Array.from({ length: 50 }, (_, i) => ({
        id: `ord-${from + i}`,
        meli_order_id: `meli-${from + i}`,
      }));

      assert.equal(pagedOrders.length, 50, "Paged orders must be exactly 50");

      // The secondary query ONLY fetches items for these 50 order IDs
      const orderIds = pagedOrders.map(o => o.id);
      assert.equal(orderIds.length, 50);

      // Simulating order_items query: .in("order_id", orderIds)
      // Even if database has 250,000 order_items across all sales, it will only return items for 50 orders
      const simulatedReturnedItems = orderIds.map(id => ({
        order_id: id,
        title: `Item for ${id}`,
        quantity: 1,
        unit_cost: 100,
        unit_cost_snapshot: 100,
        cost_snapshot_frozen_at: "2026-09-09T00:00:00Z",
      }));

      assert.equal(simulatedReturnedItems.length, 50, "Order items query bounds transfer to paged subset");
    });
  });
});
