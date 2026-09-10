import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("HOTFIX 38A.1 — Zero Regression Contract Fix", () => {
  const rootDir = path.resolve(__dirname, "../..");

  // Canonical columns present in PostgreSQL public.products
  const REAL_PRODUCT_SCHEMA_COLUMNS = new Set([
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
    "last_seen_at"
  ]);

  test("1. Sibling products SELECT contains all properties required by siblingStats in stats/route.ts", () => {
    const filePath = path.join(rootDir, "src/app/api/products/[id]/stats/route.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    // SiblingStats maps the following product properties
    const requiredSiblingStatsProps = [
      "id",
      "title",
      "sku",
      "meli_item_id",
      "listing_type_id",
      "status",
      "price",
      "permalink",
      "thumbnail_url"
    ];

    // Find the sibling query select string inside normSku block
    const siblingQueryMatch = content.match(/if\s*\(normSku\)\s*\{[\s\S]*?\.from\(\s*["']products["']\s*\)\s*\.select\(\s*["'`]([^"'`]+)["'`]\s*\)/);
    assert.ok(siblingQueryMatch, "Sibling candidates query must exist in stats/route.ts");

    const selectStr = siblingQueryMatch[1];
    assert.ok(!selectStr.includes("*"), "Sibling candidates query MUST NOT use select('*')");

    const selectedCols = selectStr
      .split(",")
      .map(c => c.trim())
      .filter(Boolean);

    for (const prop of requiredSiblingStatsProps) {
      assert.ok(
        selectedCols.includes(prop),
        `Required siblingStats property '${prop}' must be explicitly selected in stats/route.ts (found: ${selectedCols.join(", ")})`
      );
    }
  });

  test("2. smartAlerts does not query non-existent last_sale and falls back to created_at", () => {
    const filePath = path.join(rootDir, "src/services/analytics/smartAlerts.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not query last_sale
    assert.ok(
      !content.includes('"last_sale"') && !content.includes("last_sale,"),
      "smartAlerts must NOT include 'last_sale' in SELECT because it does not exist in PostgreSQL schema"
    );

    // Must select created_at
    assert.ok(
      content.includes("created_at"),
      "smartAlerts must select 'created_at' as reference date fallback"
    );
  });

  test("3. All explicit SELECT queries on products use strictly columns from REAL_SCHEMA", () => {
    const filesToAudit = [
      "src/app/api/products/[id]/stats/route.ts",
      "src/services/analytics/smartAlerts.ts",
      "src/services/analytics/campaignRecommendations.ts",
      "src/services/meli/syncProducts.ts",
      "src/services/meli/syncOrders.ts",
      "src/app/dashboard/products/page.tsx",
      "src/app/api/profitability/recalculate/route.ts"
    ];

    for (const relPath of filesToAudit) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      // Extract all .select(...) calls where table is products
      const selectMatches = content.matchAll(/\.from\(\s*["']products["']\s*\)(?:[^\.]*?)\.select\(\s*[`"']([^`"']+)["'`]\s*\)/gs);

      for (const match of selectMatches) {
        const selectString = match[1];
        if (selectString === "*") continue;

        const rawColumns = selectString
          .split(/[\n,]/)
          .map(c => c.trim())
          .filter(c => c && !c.startsWith("//"));

        for (const rawCol of rawColumns) {
          // Handle PostgREST projections: alias:column->>sub or column->sub
          let baseColumn = rawCol;
          if (baseColumn.includes(":")) {
            baseColumn = baseColumn.split(":")[1].trim();
          }
          if (baseColumn.includes("->")) {
            baseColumn = baseColumn.split("->")[0].trim();
          }

          assert.ok(
            REAL_PRODUCT_SCHEMA_COLUMNS.has(baseColumn),
            `Column '${baseColumn}' in ${relPath} does not exist in REAL_PRODUCT_SCHEMA_COLUMNS!`
          );
        }
      }
    }
  });

  test("4. REAL_PRODUCT_SCHEMA_COLUMNS strictly excludes non-existent last_sale", () => {
    assert.equal(REAL_PRODUCT_SCHEMA_COLUMNS.has("last_sale"), false);
  });
});
