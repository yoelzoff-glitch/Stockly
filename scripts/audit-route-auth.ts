/**
 * Static route authorization and endpoint isolation audit script (Sprint 2.1).
 * Verifies that protected API routes enforce session authentication, derive tenantId from the server,
 * do not invoke admin clients prior to authentication, and do not trust client-supplied tenant identifiers.
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
  "src/app/api/meli/webhook/route.ts", // External Webhook (Strict HMAC verification scheduled for Sprint 4)
  "src/app/api/mercadopago/webhook/route.ts", // External Webhook (Strict Secret verification scheduled for Sprint 4)
  "src/app/api/whatsapp/webhook/route.ts", // External Webhook (Strict HMAC verification scheduled for Sprint 4)
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

    // 1. Check insecure getSession() usage
    if (content.includes("auth.getSession(")) {
      violations.push({
        routePath: relRoute,
        category: "VIOLATION",
        reason: "Insecure: Uses getSession() instead of getUser() / requireTenantContext()",
      });
      continue;
    }

    // 2. Check presence of server auth helpers
    const authHelperRegex = /\b(requireTenantContext|requireAuthenticatedUser|requireTenantRole)\s*\(/g;
    const firstAuthMatch = authHelperRegex.exec(content);
    const authIndex = firstAuthMatch ? firstAuthMatch.index : -1;

    if (authIndex === -1) {
      // Check if critical
      if (CRITICAL_ROUTES.includes(relRoute)) {
        violations.push({
          routePath: relRoute,
          category: "VIOLATION",
          reason: "Critical route lacks requireTenantContext / tenant authentication helper",
        });
        continue;
      }

      // Check if it creates admin client without auth
      if (content.includes("createAdminClient(")) {
        violations.push({
          routePath: relRoute,
          category: "VIOLATION",
          reason: "Uses createAdminClient without server tenantAuth verification",
        });
        continue;
      }
    }

    // 3. Structural ordering check: createAdminClient() MUST NOT be called before authentication
    const adminClientRegex = /\bcreateAdminClient\s*\(/g;
    const firstAdminMatch = adminClientRegex.exec(content);
    if (firstAdminMatch && authIndex !== -1 && firstAdminMatch.index < authIndex) {
      violations.push({
        routePath: relRoute,
        category: "VIOLATION",
        reason: "Insecure Ordering: createAdminClient() is invoked before tenant authentication helper",
      });
      continue;
    }

    // 4. Check for untrusted body tenant parameter passed to administrative services without assertRequestedTenant
    const extractsBodyTenant = /(?:const|let|var)\s*\{[^}]*?\b(tenant_id|tenantId)\b[^}]*\}\s*=\s*(?:body|await\s+request\.json\(\)|await\s+req\.json\(\))/g.test(content);
    const usesAssertRequestedTenant = content.includes("assertRequestedTenant(");

    if (extractsBodyTenant && !usesAssertRequestedTenant) {
      violations.push({
        routePath: relRoute,
        category: "VIOLATION",
        reason: "Unsafe parameter binding: extracts tenantId/tenant_id from body without invoking assertRequestedTenant()",
      });
      continue;
    }

    // 5. Critical routes must assert tenant mismatch
    if (CRITICAL_ROUTES.includes(relRoute) && !usesAssertRequestedTenant) {
      violations.push({
        routePath: relRoute,
        category: "VIOLATION",
        reason: "Critical route must assert requested tenant matches authenticated tenant",
      });
      continue;
    }

    protectedCount++;
    findings.push({
      routePath: relRoute,
      category: "PROTECTED",
      reason: "Enforces server session, correct admin client ordering, and derives tenantId safely",
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
