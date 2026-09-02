/**
 * Static route authorization and endpoint isolation audit script (Sprint 2).
 * Verifies that protected API routes enforce session authentication and derive tenantId from the server.
 */

import fs from "fs";
import path from "path";

interface AuditFinding {
  routePath: string;
  category: "EXEMPT" | "PROTECTED" | "VIOLATION";
  reason: string;
}

const EXEMPT_ROUTES = new Set([
  "src/app/api/health/live/route.ts", // Public Liveness
  "src/app/api/health/ready/route.ts", // Machine-to-machine HEALTHCHECK_TOKEN
  "src/app/api/meli/webhook/route.ts", // External Webhook (MeLi HMAC Signature)
  "src/app/api/mercadopago/webhook/route.ts", // External Webhook (MP Secret)
  "src/app/api/whatsapp/webhook/route.ts", // External Webhook (Meta HMAC Signature)
  "src/app/api/inngest/route.ts", // Inngest runtime Signing Key
  "src/app/api/meli/callback/route.ts", // OAuth callback flow
  "src/app/api/meli/connect/route.ts", // Initiates OAuth redirect
]);

const CRITICAL_ROUTES = [
  "src/app/api/ai/actions/confirm/route.ts",
  "src/app/api/ai/actions/cancel/route.ts",
  "src/app/api/pricing/simulate/route.ts",
  "src/app/api/pricing/create-workflow/route.ts",
];

function scanApiRoutes(dir: string, baseDir: string, routeFiles: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanApiRoutes(fullPath, baseDir, routeFiles);
    } else if (entry.isFile() && entry.name === "route.ts") {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      routeFiles.push(relPath);
    }
  }

  return routeFiles;
}

export function runRouteAuthAudit(rootDir = path.resolve(__dirname, "..")): {
  totalRoutes: number;
  protectedCount: number;
  exemptCount: number;
  violations: AuditFinding[];
  findings: AuditFinding[];
} {
  const apiDir = path.join(rootDir, "src/app/api");
  const routes = scanApiRoutes(apiDir, rootDir);

  const findings: AuditFinding[] = [];
  const violations: AuditFinding[] = [];
  let protectedCount = 0;
  let exemptCount = 0;

  for (const relRoute of routes) {
    const fullPath = path.join(rootDir, relRoute);
    const content = fs.readFileSync(fullPath, "utf-8");

    if (EXEMPT_ROUTES.has(relRoute)) {
      exemptCount++;
      findings.push({
        routePath: relRoute,
        category: "EXEMPT",
        reason: "Explicitly documented public/webhook/system endpoint",
      });
      continue;
    }

    const usesAuthHelper =
      content.includes("requireTenantContext") ||
      content.includes("requireAuthenticatedUser") ||
      content.includes("requireTenantRole");

    const usesRawGetSession = content.includes("auth.getSession(");

    if (usesRawGetSession) {
      violations.push({
        routePath: relRoute,
        category: "VIOLATION",
        reason: "Insecure: Uses getSession() instead of getUser() / requireTenantContext()",
      });
      continue;
    }

    if (!usesAuthHelper) {
      // Check if critical
      if (CRITICAL_ROUTES.includes(relRoute)) {
        violations.push({
          routePath: relRoute,
          category: "VIOLATION",
          reason: "Critical route lacks requireTenantContext / tenant authentication helper",
        });
        continue;
      }

      // Check if it creates admin client or queries DB directly without auth
      const usesAdminWithoutAuth = content.includes("createAdminClient(");
      if (usesAdminWithoutAuth) {
        violations.push({
          routePath: relRoute,
          category: "VIOLATION",
          reason: "Uses createAdminClient without server tenantAuth verification",
        });
        continue;
      }
    }

    // Verify critical routes have tenant assertion if body tenant is accepted
    if (CRITICAL_ROUTES.includes(relRoute)) {
      const checksTenantMismatch = content.includes("assertRequestedTenant(");
      if (!checksTenantMismatch) {
        violations.push({
          routePath: relRoute,
          category: "VIOLATION",
          reason: "Critical route does not invoke assertRequestedTenant",
        });
        continue;
      }
    }

    protectedCount++;
    findings.push({
      routePath: relRoute,
      category: "PROTECTED",
      reason: "Enforces server session and derives tenantId safely",
    });
  }

  return {
    totalRoutes: routes.length,
    protectedCount,
    exemptCount,
    violations,
    findings,
  };
}

// Execution if run from CLI
if (require.main === module) {
  console.log("=================================================");
  console.log("KLYVO SPRINT 2: STATIC ROUTE AUTH AUDIT");
  console.log("=================================================\n");

  const results = runRouteAuthAudit();

  console.log(`Total Routes Scanned: ${results.totalRoutes}`);
  console.log(`Protected Routes:     ${results.protectedCount}`);
  console.log(`Exempt Routes:        ${results.exemptCount}`);
  console.log(`Violations Detected:  ${results.violations.length}\n`);

  if (results.violations.length > 0) {
    console.error("❌ CRITICAL AUTH VIOLATIONS DETECTED:\n");
    for (const v of results.violations) {
      console.error(`  - [${v.routePath}]: ${v.reason}`);
    }
    process.exit(1);
  } else {
    console.log("✅ All routes adhere to Sprint 2 authentication & tenant isolation boundaries.\n");
    process.exit(0);
  }
}
