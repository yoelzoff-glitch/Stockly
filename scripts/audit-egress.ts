import fs from "node:fs";
import path from "node:path";

interface EgressViolation {
  file: string;
  category: string;
  line: number;
  message: string;
}

interface EgressWarning {
  file: string;
  category: string;
  line: number;
  message: string;
}

export function runEgressAudit(): EgressViolation[] {
  console.log("=================================================");
  console.log("LIBRETAX SPRINT 38A: EGRESS AUDIT V2");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const violations: EgressViolation[] = [];
  const warnings: EgressWarning[] = [];

  // Allowlist of single-item / detail / isolated paths where select("*") or single row detail is legitimate
  const allowlist: Record<string, string[]> = {
    // Individual item lookups with .single() / .maybeSingle() or test/admin workflows
    "src/app/dashboard/sales/[id]/page.tsx": ["single_order_detail"],
    "src/app/dashboard/settings/page.tsx": ["settings_tenant_detail"],
    "src/app/dashboard/settings/costs/actions.ts": ["costs_single_tenant"],
    "src/app/dashboard/billing/actions.ts": ["billing_single_tenant"],
    "src/services/ai/session.ts": ["session_single_record"],
    "src/services/ai/actions/confirm.ts": ["confirm_single_action"],
  };

  // Heavy JSONB columns that should not be queried in recurrent jobs or sync routines without projection
  const heavyJsonbColumns = [
    "campaign_data",
    "promotion_data",
    "profit_raw_data",
    "event_data",
    "payload",
    "result",
  ];

  // Heavy collection tables where select("*") transfers excessive egress
  const heavyCollectionTables = [
    "orders",
    "products",
    "ai_actions",
    "webhook_events",
    "shipments",
  ];

  function scanDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
        const lines = content.split("\n");

        const isRecurrentJobOrSync =
          relPath.startsWith("src/jobs/") ||
          (relPath.startsWith("src/services/meli/") && relPath.includes("sync"));

        const isPageFile = relPath.startsWith("src/app/") && relPath.endsWith("page.tsx");

        // Helper to extract the table name preceding a .select() call
        const getTableForSelect = (selectIdx: number): string | null => {
          const sliceBefore = content.slice(Math.max(0, selectIdx - 250), selectIdx);
          const matches = [...sliceBefore.matchAll(/\.from\(\s*["']([^"']+)["']\s*\)/g)];
          if (matches.length > 0) {
            return matches[matches.length - 1][1];
          }
          return null;
        };

        lines.forEach((lineText, idx) => {
          const lineNum = idx + 1;

          // Check 1: Prohibit ai_actions query using select("*")
          if (
            (lineText.includes('.from("ai_actions")') || lineText.includes(".from('ai_actions')")) &&
            lineText.includes('.select("*")')
          ) {
            const isAllowed = allowlist[relPath] !== undefined;
            if (!isAllowed && !lineText.includes(".single()") && !lineText.includes(".maybeSingle()")) {
              violations.push({
                file: relPath,
                category: "UNBOUNDED_AI_ACTIONS_SELECT_STAR",
                line: lineNum,
                message: `ai_actions query MUST NOT use select("*"). Select explicit columns to prevent heavy JSONB payload/result transfer.`,
              });
            }
          }

          // Check 2: /dashboard/actions list must not fetch payload or result in table query
          if (
            relPath === "src/app/dashboard/actions/page.tsx" &&
            (lineText.includes('"payload"') || lineText.includes('"result"')) &&
            !lineText.includes("payload->>")
          ) {
            violations.push({
              file: relPath,
              category: "AI_ACTIONS_LIST_HEAVY_JSONB",
              line: lineNum,
              message: `/dashboard/actions list query must NOT transfer raw payload or result JSONB. Use lazy getAiActionDetail() instead.`,
            });
          }

          // Check 3: Check hot paths products list query
          if (
            relPath === "src/app/dashboard/products/page.tsx" &&
            lineText.includes('.select("*,')
          ) {
            violations.push({
              file: relPath,
              category: "PRODUCTS_LIST_SELECT_STAR",
              line: lineNum,
              message: `Products page list query must NOT use select("*"). Select explicit columns to avoid downloading massive profit_raw_data/campaign_data JSONBs.`,
            });
          }

          // Check 4: Check shipments list query for raw_data
          if (
            relPath === "src/app/dashboard/shipments/page.tsx" &&
            lineText.includes('.select("*,')
          ) {
            violations.push({
              file: relPath,
              category: "SHIPMENTS_LIST_SELECT_STAR",
              line: lineNum,
              message: `Shipments list query must NOT use select("*"). Explicitly project non-raw_data columns.`,
            });
          }

          // Check 5: Check webhook_events event_data in list queries
          if (
            content.includes('.from("webhook_events")') &&
            lineText.includes('"event_data"') &&
            !lineText.includes(".single()") &&
            !lineText.includes(".maybeSingle()")
          ) {
            violations.push({
              file: relPath,
              category: "WEBHOOK_EVENTS_LIST_HEAVY_PAYLOAD",
              line: lineNum,
              message: `webhook_events query must NOT fetch event_data in lists or loops without single-record demand.`,
            });
          }

          // Check 6: Check aggressive polling loops
          if (
            (lineText.includes("refetchInterval") || lineText.includes("refreshInterval")) &&
            !lineText.includes("//")
          ) {
            violations.push({
              file: relPath,
              category: "AGGRESSIVE_CLIENT_POLLING",
              line: lineNum,
              message: `Aggressive polling intervals detected (${lineText.trim()}). Prefer reactive invalidation or user-triggered refreshes.`,
            });
          }

          // Check 7: Heavy JSONB in recurrent jobs or sync routines
          if (isRecurrentJobOrSync && lineText.includes(".select(")) {
            for (const heavyCol of heavyJsonbColumns) {
              // In syncProducts, campaign_data and promotion_data are explicitly preserved by contract
              if (
                relPath === "src/services/meli/syncProducts.ts" &&
                (heavyCol === "campaign_data" || heavyCol === "promotion_data")
              ) {
                continue;
              }

              if (
                lineText.includes(`"${heavyCol}"`) ||
                lineText.includes(`'${heavyCol}'`) ||
                lineText.includes(`${heavyCol},`) ||
                lineText.includes(`, ${heavyCol}`)
              ) {
                violations.push({
                  file: relPath,
                  category: "HEAVY_JSONB_IN_RECURRENT_JOB",
                  line: lineNum,
                  message: `Recurrent job / sync routine queries heavy JSONB column '${heavyCol}'. Use PostgREST JSON path projection or fetch on demand.`,
                });
              }
            }

            // Flag unprojected raw_data in recurrent sync products
            if (
              relPath === "src/services/meli/syncProducts.ts" &&
              (lineText.includes('"raw_data"') || lineText.includes(", raw_data,")) &&
              !lineText.includes("raw_data->")
            ) {
              violations.push({
                file: relPath,
                category: "HEAVY_JSONB_IN_RECURRENT_JOB",
                line: lineNum,
                message: `syncProducts must not query unprojected raw_data. Use JSON path projections (e.g. fees:raw_data->fees).`,
              });
            }
          }

          // Check 8: select("*") in collections
          if (
            (lineText.includes('.select("*")') || lineText.includes(".select('*')") || lineText.includes('.select("*,') || lineText.includes(".select('*,") || lineText.includes(".select(`*`")) &&
            !lineText.includes(".single()") &&
            !lineText.includes(".maybeSingle()") &&
            !allowlist[relPath]
          ) {
            const lineIdxInContent = content.indexOf(lineText);
            const table = getTableForSelect(lineIdxInContent);
            if (table && heavyCollectionTables.includes(table)) {
              const surrounding = content.slice(lineIdxInContent, lineIdxInContent + lineText.length + 150);
              if (!surrounding.includes(".single()") && !surrounding.includes(".maybeSingle()") && !surrounding.includes(".limit(1)")) {
                violations.push({
                  file: relPath,
                  category: "COLLECTION_SELECT_STAR",
                  line: lineNum,
                  message: `Table collection '${table}' must NOT use select("*"). Select explicit columns to prevent egress bloat.`,
                });
              }
            }
          }

          // Check 9: Large collection query without bounds
          if (lineText.includes(".select(") && !allowlist[relPath]) {
            const lineIdxInContent = content.indexOf(lineText);
            const table = getTableForSelect(lineIdxInContent);
            if (table && ["orders", "products", "webhook_events"].includes(table)) {
              // Check if this query is a mutation returning data (update/upsert/insert)
              const sliceBefore = content.slice(Math.max(0, lineIdxInContent - 200), lineIdxInContent);
              const isMutationReturning =
                sliceBefore.includes(".update(") ||
                sliceBefore.includes(".upsert(") ||
                sliceBefore.includes(".insert(");

              if (!isMutationReturning) {
                // Search around the query (before and after in the chain) for bounds
                const contextSlice = content.slice(
                  Math.max(0, lineIdxInContent - 200),
                  Math.min(content.length, lineIdxInContent + 800)
                );
                const hasBounds =
                  contextSlice.includes(".eq(") ||
                  contextSlice.includes(".in(") ||
                  contextSlice.includes(".gte(") ||
                  contextSlice.includes(".lte(") ||
                  contextSlice.includes(".limit(") ||
                  contextSlice.includes(".range(") ||
                  contextSlice.includes(".single()") ||
                  contextSlice.includes(".maybeSingle()");

                if (!hasBounds) {
                  violations.push({
                    file: relPath,
                    category: "LARGE_COLLECTION_WITHOUT_BOUNDS",
                    line: lineNum,
                    message: `Collection query on '${table}' without filter, bounds, or limit detected.`,
                  });
                }
              }
            }
          }

          // Check 10: WARNING - Sync triggered from page render
          if (isPageFile) {
            if (
              lineText.includes("syncShipments(") ||
              lineText.includes("syncProducts(") ||
              lineText.includes("syncOrders(") ||
              lineText.includes("syncCancellations(")
            ) {
              warnings.push({
                file: relPath,
                category: "PAGE_RENDER_SYNC_TRIGGERED",
                line: lineNum,
                message: `Page render triggers background sync (${lineText.trim()}). Ensure this is guarded by feature flags or moved to background workers.`,
              });
            }
          }

          // Check 11: WARNING - Full sync triggered from specific webhook
          if (
            relPath.includes("webhook") ||
            relPath === "src/jobs/syncProductsJob.ts"
          ) {
            if (
              lineText.includes('"meli/items.updated"') ||
              lineText.includes("'meli/items.updated'")
            ) {
              warnings.push({
                file: relPath,
                category: "WEBHOOK_FULL_SYNC_TRIGGERED",
                line: lineNum,
                message: `Webhook 'meli/items.updated' currently triggers full catalog sync. Targeted for granular resolution in Sprint 38B.`,
              });
            }
          }
        });

        // Check 12: Idempotency Fast-Path: raw_data before idempotency flag
        if (relPath === "src/services/inventory/decrementInternalStockFromOrder.ts") {
          const firstOrdersQuery = content.indexOf(".from(\"orders\")");
          const firstSelectMatch = content.indexOf(".select(", firstOrdersQuery);
          const firstSelectSlice = content.slice(firstSelectMatch, firstSelectMatch + 150);
          if (firstSelectSlice.includes("raw_data") || firstSelectSlice.includes("order_items")) {
            violations.push({
              file: relPath,
              category: "RAW_DATA_BEFORE_IDEMPOTENCY_FLAG",
              line: 1,
              message: `decrementInternalStockFromOrder must check 'internal_stock_processed' before downloading raw_data or order_items.`,
            });
          }
        }

        if (relPath === "src/services/meli/syncCancellations.ts") {
          const firstOrdersQuery = content.indexOf(".from(\"orders\")");
          const firstSelectMatch = content.indexOf(".select(", firstOrdersQuery);
          const firstSelectSlice = content.slice(firstSelectMatch, firstSelectMatch + 150);
          if (firstSelectSlice.includes("raw_data")) {
            violations.push({
              file: relPath,
              category: "RAW_DATA_BEFORE_IDEMPOTENCY_FLAG",
              line: 1,
              message: `syncCancellations must query order IDs first, filter out existing cancellations, and only query raw_data for pending cancellations.`,
            });
          }
        }

        // Check 13: UI Contract Preservation
        if (relPath === "src/app/dashboard/sales/page.tsx") {
          if (!content.includes("product_title:") || !content.includes("total_quantity:")) {
            violations.push({
              file: relPath,
              category: "UI_CONTRACT_VIOLATION",
              line: 1,
              message: `Sales page query optimization must maintain 'product_title' and 'total_quantity' contract for UI list view.`,
            });
          }
          if (content.includes('.select("*,') || content.includes('.select("*")')) {
            violations.push({
              file: relPath,
              category: "SALES_LIST_SELECT_STAR",
              line: 1,
              message: `Sales page must not reintroduce select("*") or full raw_data on orders.`,
            });
          }
        }

        if (relPath === "src/app/dashboard/internal-stock/actions.ts") {
          if (
            content.includes("inventory_items.description") ||
            content.includes("description, unit_cost") ||
            content.includes("supplier_id") ||
            content.includes("location,")
          ) {
            violations.push({
              file: relPath,
              category: "SCHEMA_CONTRACT_VIOLATION",
              line: 1,
              message: `getInventoryItems() must not query non-existent columns (description, location, supplier_id).`,
            });
          }

          if (
            content.includes("previous_quantity") ||
            content.includes("new_quantity") ||
            content.includes("reference_type")
          ) {
            violations.push({
              file: relPath,
              category: "SCHEMA_CONTRACT_VIOLATION",
              line: 1,
              message: `getInventoryMovements() must not query non-existent columns (previous_quantity, new_quantity, reference_type).`,
            });
          }
        }

        if (relPath === "src/app/dashboard/products/page.tsx") {
          if (!content.includes("shipping:") && !content.includes("shipping")) {
            violations.push({
              file: relPath,
              category: "UI_CONTRACT_VIOLATION",
              line: 1,
              message: `Products page query must preserve shipping logistic_type for Fulfillment UI filtering.`,
            });
          }
        }
      }
    }
  }

  scanDirectory(srcDir);

  if (warnings.length > 0) {
    console.log(`⚠️  Egress Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.warn(`  [${w.category}] ${w.file}:${w.line}: ${w.message}`);
    }
    console.log();
  }

  console.log(`Total Egress Violations Detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ ZERO-WASTE EGRESS AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}:${v.line}: ${v.message}`);
    }
    return violations;
  }

  console.log("✅ All queries and hot paths adhere to Sprint 38A zero-waste egress standards.\n");
  return [];
}

if (require.main === module) {
  const violations = runEgressAudit();
  if (violations.length > 0) {
    process.exit(1);
  }
}
