import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  category: string;
  message: string;
}

function runPerformanceAudit() {
  console.log("=================================================");
  console.log("KLYVO SPRINT 6: SCALABILITY & PERFORMANCE AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const pkgJsonPath = path.join(rootDir, "package.json");
  const violations: Violation[] = [];

  // 1. Verify package.json scripts
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  if (!pkg.scripts?.["verify:sprint6"]?.includes("test:performance")) {
    violations.push({
      file: "package.json",
      category: "RELEASE_GATE_MISSING_PERFORMANCE_TEST",
      message: "package.json 'verify:sprint6' script MUST execute 'npm run test:performance' as a mandatory pre-deploy gate.",
    });
  }

  // 2. Scan src/ for scalability anti-patterns
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

        // Anti-pattern 1: Shared cache tag without tenant partition
        if (
          relPath === "src/lib/cache.ts" &&
          content.includes('tags: ["orders"]')
        ) {
          violations.push({
            file: relPath,
            category: "SHARED_CACHE_KEY_LEAK",
            message: "Cache tags must be strictly partitioned per tenant (e.g. `orders-${tenantId}`).",
          });
        }

        // Anti-pattern 2: In-memory Map in operationRuns for durations
        if (
          relPath === "src/lib/observability/operationRuns.ts" &&
          content.includes("const operationStartTimes = new Map")
        ) {
          violations.push({
            file: relPath,
            category: "STATEFUL_MEMORY_MAP_LEAK",
            message: "operationRuns must NOT depend on in-memory Map across serverless instances. Calculate duration from started_at.",
          });
        }

        // Anti-pattern 3: select("*") on export route
        if (
          relPath === "src/app/api/sales/export/route.ts" &&
          content.includes('.select("*")')
        ) {
          violations.push({
            file: relPath,
            category: "UNBOUNDED_SELECT_STAR_IN_HOT_PATH",
            message: "Hot path export route must select explicit columns to reduce payload and memory transfer.",
          });
        }
      }
    }
  }

  scanDir(srcDir);

  console.log(`Total Violations Detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("❌ PERFORMANCE AUDIT FAILED with the following violations:\n");
    for (const v of violations) {
      console.error(`- [${v.category}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log("✅ All files adhere to Sprint 6 scalability & performance standards.\n");
}

runPerformanceAudit();
