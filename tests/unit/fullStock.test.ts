import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSku } from "../../src/services/products/sku/normalizeSku";

describe("Sprint 11 / Bodega FULL — Inventory Sync & Display Tests", () => {
  it("correctly groups mirrored listings by normalized SKU and exposes physicalStockInFull and available_quantity", () => {
    // 5 publications, 2 with the same SKU (e.g. Clásica and Premium)
    const rawProducts = [
      {
        id: "prod-1",
        meli_item_id: "MLA101",
        sku: "P 299",
        title: "Pulsera Plata 925 Clásica",
        thumbnail_url: "https://example.com/1.jpg",
        available_quantity: 5,
        sold_quantity: 2,
        price: 15000,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      },
      {
        id: "prod-2",
        meli_item_id: "MLA102",
        sku: "P 299",
        title: "Pulsera Plata 925 Premium Cuotas",
        thumbnail_url: "https://example.com/1.jpg",
        available_quantity: 5,
        sold_quantity: 8,
        price: 18000,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      },
      {
        id: "prod-3",
        meli_item_id: "MLA103",
        sku: "D 260 VN C 197",
        title: "Cadena Dije Virgen Niña",
        thumbnail_url: "https://example.com/2.jpg",
        available_quantity: 7,
        sold_quantity: 12,
        price: 25000,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      },
      {
        id: "prod-4",
        meli_item_id: "MLA104",
        sku: "D 764 S C 207",
        title: "Collar Dije Cristal",
        thumbnail_url: "https://example.com/3.jpg",
        available_quantity: 5,
        sold_quantity: 4,
        price: 19000,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      },
      {
        id: "prod-5",
        meli_item_id: "MLA105",
        sku: "D 260 AN",
        title: "Dije Angel De La Guarda",
        thumbnail_url: "https://example.com/4.jpg",
        available_quantity: 13,
        sold_quantity: 20,
        price: 12000,
        raw_data: { shipping: { logistic_type: "fulfillment" } },
      },
    ];

    const skuGroupMap = new Map<string, any>();

    rawProducts.forEach((p) => {
      const rawSku = p.sku?.trim();
      const normSku = rawSku ? normalizeSku(rawSku) : null;
      const groupKey = normSku ? normSku : `no-sku-${p.meli_item_id}`;

      if (!skuGroupMap.has(groupKey)) {
        skuGroupMap.set(groupKey, {
          id: p.id,
          meli_item_id: p.meli_item_id,
          sku: rawSku || "Sin SKU",
          title: p.title,
          thumbnail_url: p.thumbnail_url,
          available_quantity: p.available_quantity || 0,
          physicalStockInFull: p.available_quantity || 0,
          totalSold: p.sold_quantity || 0,
          publications: [p],
          prices: [p.price],
        });
      } else {
        const group = skuGroupMap.get(groupKey);
        group.publications.push(p);
        group.totalSold += p.sold_quantity || 0;
        group.prices.push(p.price);
        group.physicalStockInFull = Math.max(group.physicalStockInFull, p.available_quantity || 0);
        group.available_quantity = group.physicalStockInFull;
        if (!group.meli_item_id && p.meli_item_id) {
          group.meli_item_id = p.meli_item_id;
        }
      }
    });

    const grouped = Array.from(skuGroupMap.values());

    // 5 publications grouped into 4 unique physical SKUs
    assert.equal(grouped.length, 4);

    // Group 1 (P 299) has 2 publications, shared stock = 5
    const p299Group = grouped.find((g) => g.sku === "P 299");
    assert.ok(p299Group);
    assert.equal(p299Group.publications.length, 2);
    assert.equal(p299Group.available_quantity, 5);
    assert.equal(p299Group.physicalStockInFull, 5);
    assert.equal(p299Group.meli_item_id, "MLA101");

    // Total units in FULL: 5 (P 299) + 7 (D 260) + 5 (D 764) + 13 (D 260 AN) = 30 units
    const totalFullUnits = grouped.reduce((sum, g) => sum + g.physicalStockInFull, 0);
    assert.equal(totalFullUnits, 30);

    // Critical stock count (<= 5): P 299 (5) and D 764 (5) -> exactly 2
    const criticalFullCount = grouped.filter((g) => g.physicalStockInFull <= 5).length;
    assert.equal(criticalFullCount, 2);

    // Check display stock fallback
    grouped.forEach((item) => {
      const displayStock = item.physicalStockInFull ?? item.available_quantity ?? 0;
      assert.ok(displayStock > 0, `Display stock for SKU ${item.sku} should not be 0`);
      assert.ok(item.meli_item_id, `Item ${item.sku} must have a valid meli_item_id`);
    });
  });

  it("resolves variation quantities when top-level available_quantity is zero or missing", () => {
    const itemWithVariations = {
      id: "MLA9999",
      title: "Anillo Plata 925 Varios Talles",
      available_quantity: 0,
      sold_quantity: 0,
      variations: [
        { id: 1, available_quantity: 4, sold_quantity: 1 },
        { id: 2, available_quantity: 6, sold_quantity: 3 },
      ],
    };

    let resolvedAvailableQuantity = typeof itemWithVariations.available_quantity === "number" ? itemWithVariations.available_quantity : 0;
    if (resolvedAvailableQuantity === 0 && Array.isArray(itemWithVariations.variations) && itemWithVariations.variations.length > 0) {
      const varQty = itemWithVariations.variations.reduce((acc: number, v: any) => acc + (Number(v.available_quantity) || 0), 0);
      if (varQty > 0) {
        resolvedAvailableQuantity = varQty;
      }
    }

    let resolvedSoldQuantity = typeof itemWithVariations.sold_quantity === "number" ? itemWithVariations.sold_quantity : 0;
    if (resolvedSoldQuantity === 0 && Array.isArray(itemWithVariations.variations) && itemWithVariations.variations.length > 0) {
      const varSold = itemWithVariations.variations.reduce((acc: number, v: any) => acc + (Number(v.sold_quantity) || 0), 0);
      if (varSold > 0) {
        resolvedSoldQuantity = varSold;
      }
    }

    assert.equal(resolvedAvailableQuantity, 10);
    assert.equal(resolvedSoldQuantity, 4);
  });
});
