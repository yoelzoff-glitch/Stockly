import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeSku } from "../../src/lib/sku";
import { parseCompositeSku } from "../../src/services/products/sku/parseCompositeSku";

describe("SKU Normalization & Composite Parsing Tests", () => {
  describe("normalizeSku", () => {
    test("handles null, undefined and empty strings", () => {
      assert.equal(normalizeSku(null), "");
      assert.equal(normalizeSku(undefined), "");
      assert.equal(normalizeSku(""), "");
      assert.equal(normalizeSku("   "), "");
      assert.equal(normalizeSku("N/A"), "");
      assert.equal(normalizeSku("NULL"), "");
      assert.equal(normalizeSku("undefined"), "");
    });

    test("removes spaces, dashes, slashes and special characters", () => {
      assert.equal(normalizeSku("BAN-01_A"), "BAN01A");
      assert.equal(normalizeSku(" ban / 01 - b "), "BAN01B");
      assert.equal(normalizeSku("SKU#1234@xyz"), "SKU1234XYZ");
    });
  });

  describe("parseCompositeSku", () => {
    test("returns empty components for invalid or blank sku", () => {
      const parsed = parseCompositeSku("");
      assert.deepEqual(parsed.components, []);
      assert.equal(parsed.sku_normalized, "");
    });

    test("parses single component sku", () => {
      const parsed = parseCompositeSku("BAN01A");
      assert.equal(parsed.sku_normalized, "BAN01A");
      assert.deepEqual(parsed.components, ["BAN01A"]);
    });

    test("parses compound sku with known prefixes", () => {
      const parsed = parseCompositeSku("BANQUETA10C20");
      assert.equal(parsed.sku_normalized, "BANQUETA10C20");
      assert.ok(parsed.components.length >= 2, "Should split compound prefix parts");
    });
  });
});
