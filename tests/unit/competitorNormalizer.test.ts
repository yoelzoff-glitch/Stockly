import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCompetitorData,
  validateCompetitorSnapshot,
} from "../../src/services/meli/competitor/normalizer";

describe("Sprint: Competitor Normalizer Unit Tests", () => {
  test("creates full CompetitorSnapshot when all fields are available", () => {
    const itemData = {
      id: "MLA123456",
      title: "Cafetera Express Automática",
      price: 150000,
      original_price: 180000,
      currency_id: "ARS",
      permalink: "https://articulo.mercadolibre.com.ar/MLA-123456",
      thumbnail: "http://http2.mlstatic.com/D_12345-MLA-I.jpg",
      listing_type_id: "gold_pro",
      shipping: { free_shipping: true, logistic_type: "fulfillment" },
      available_quantity: 25,
      sold_quantity: 150,
      attributes: [{ id: "BRAND", name: "Marca", value_name: "Oster" }],
    };

    const sellerData = {
      id: 998877,
      nickname: "OSTER_OFICIAL",
      seller_reputation: { level_id: "5_green", power_seller_status: "platinum" },
    };

    const description = "Cafetera de alta presión con molinillo integrado.";

    const snapshot = normalizeCompetitorData({
      sourceId: "MLA123456",
      sourceType: "item",
      itemData,
      sellerData,
      description,
      resolutionSource: "server_public_item",
    });

    assert.equal(snapshot.sourceId, "MLA123456");
    assert.equal(snapshot.title, "Cafetera Express Automática");
    assert.equal(snapshot.price, 150000);
    assert.equal(snapshot.originalPrice, 180000);
    assert.equal(snapshot.shipping.freeShipping, true);
    assert.equal(snapshot.shipping.logisticType, "fulfillment");
    assert.equal(snapshot.seller.nickname, "OSTER_OFICIAL");
    assert.equal(snapshot.seller.powerSellerStatus, "platinum");
    assert.equal(snapshot.soldQuantity, 150);
    assert.equal(snapshot.description, description);
    assert.equal(snapshot.thumbnail, "http://http2.mlstatic.com/D_12345-MLA-O.jpg");
    assert.equal(snapshot.resolution.partial, false);
    assert.equal(snapshot.resolution.unavailableFields.length, 0);

    const validation = validateCompetitorSnapshot(snapshot);
    assert.equal(validation.valid, true);
    assert.equal(validation.missingCriticalFields.length, 0);
  });

  test("creates valid partial CompetitorSnapshot when seller or sales are missing", () => {
    const productData = {
      id: "MLA998877",
      name: "Auriculares Inalámbricos Pro",
      buy_box_winner: {
        item_id: "MLA554433",
        price: 25000,
        currency_id: "ARS",
        shipping: { free_shipping: false, logistic_type: "cross_docking" },
      },
      attributes: [{ name: "Conectividad", value_name: "Bluetooth 5.3" }],
    };

    const snapshot = normalizeCompetitorData({
      sourceId: "MLA554433",
      sourceType: "catalog",
      productData,
      resolutionSource: "server_catalog_partial",
      catalogProductId: "MLA998877",
    });

    assert.equal(snapshot.title, "Auriculares Inalámbricos Pro");
    assert.equal(snapshot.price, 25000);
    assert.equal(snapshot.seller.id, null);
    assert.equal(snapshot.soldQuantity, null);
    assert.equal(snapshot.description, null);
    assert.equal(snapshot.resolution.partial, true);
    assert.ok(snapshot.resolution.unavailableFields.includes("seller"));
    assert.ok(snapshot.resolution.unavailableFields.includes("soldQuantity"));
    assert.ok(snapshot.resolution.unavailableFields.includes("description"));

    // Critical validation still passes because title and price exist!
    const validation = validateCompetitorSnapshot(snapshot);
    assert.equal(validation.valid, true);
  });

  test("rejects snapshot with missing price or title as invalid", () => {
    const invalidSnapshot = normalizeCompetitorData({
      sourceId: "MLA000",
      sourceType: "item",
      itemData: { title: "Producto Sin Precio" },
      resolutionSource: "test",
    });

    const validation = validateCompetitorSnapshot(invalidSnapshot);
    assert.equal(validation.valid, false);
    assert.ok(validation.missingCriticalFields.includes("price"));
  });
});
