import fs from "node:fs";
import path from "node:path";

interface EgressViolation {
  file: string;
  category: string;
  line: number;
  message: string;
}

export function runEgressAudit(): EgressViolation[] {
  console.log("=================================================");
  console.log("LIBRETAX SPRINT 32: ZERO-WASTE EGRESS AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const violations: EgressViolation[] = [];

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
        });

        // Check 7: UI Contract Preservation (Sprint 32.1)
        // Optimizing a query MUST NOT eliminate fields required by the UI contract
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

  console.log(`Total Egress Violations Detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ ZERO-WASTE EGRESS AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}:${v.line}: ${v.message}`);
    }
    return violations;
  }

  console.log("✅ All queries and hot paths adhere to Sprint 32 zero-waste egress standards.\n");
  return [];
}

if (require.main === module) {
  const violations = runEgressAudit();
  if (violations.length > 0) {
    process.exit(1);
  }
}
