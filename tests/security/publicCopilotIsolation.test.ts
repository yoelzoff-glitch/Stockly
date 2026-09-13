import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("Sprint Security: Public Copilot Complete Structural Isolation Audit", () => {
  const publicDirs = [
    path.resolve(process.cwd(), "src/services/ai/public"),
    path.resolve(process.cwd(), "src/app/api/public/copilot"),
  ];

  const FORBIDDEN_PATTERNS = [
    { pattern: /createAdminClient/i, reason: "Must not access Supabase with admin/service_role privileges" },
    { pattern: /createClient/i, reason: "Must not create Supabase client in public copilot module" },
    { pattern: /requireTenantContext/i, reason: "Must not attempt to read or authenticate tenant context" },
    { pattern: /tenantAuth/i, reason: "Must not import tenant authentication utilities" },
    { pattern: /meliFetch/i, reason: "Must not invoke Mercado Libre API directly" },
    { pattern: /runBusinessAgent/i, reason: "Must not invoke the private tenant-aware business agent" },
    { pattern: /getFinancialData/i, reason: "Must not invoke private financial calculations" },
    { pattern: /getProfitSummary/i, reason: "Must not invoke private business tools" },
    { pattern: /getSalesSummary/i, reason: "Must not invoke private sales tools" },
    { pattern: /getStockSummary/i, reason: "Must not invoke private stock tools" },
    { pattern: /preparePriceUpdate/i, reason: "Must not invoke private action tools" },
    { pattern: /from\(["']orders["']\)/i, reason: "Must not query orders table" },
    { pattern: /from\(["']order_items["']\)/i, reason: "Must not query order_items table" },
    { pattern: /from\(["']tenants["']\)/i, reason: "Must not query tenants table" },
    { pattern: /from\(["']subscriptions["']\)/i, reason: "Must not query subscriptions table" },
    { pattern: /from\(["']meli_accounts["']\)/i, reason: "Must not query meli_accounts table" },
  ];

  function getTsFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  test("No public AI service or route file imports or references private database/tenant infrastructure", () => {
    const allFiles: string[] = [];
    for (const dir of publicDirs) {
      allFiles.push(...getTsFiles(dir));
    }

    assert.ok(allFiles.length > 0, "Should have found public AI files to scan");

    const violations: { file: string; pattern: string; reason: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, "utf-8");
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            pattern: pattern.toString(),
            reason,
          });
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Violations found in public assistant isolation audit:\n${JSON.stringify(violations, null, 2)}`
    );
  });
});
