import { auditEnvironment } from "../src/lib/config/envCheck";

const isStrict = process.argv.includes("--strict");

console.log("=================================================");
console.log(`KLYVO ENVIRONMENT DIAGNOSTIC (Strict mode: ${isStrict})`);
console.log("=================================================\n");

const audit = auditEnvironment(isStrict);

console.log("VARIABLE AUDIT RESULTS:");
console.log("-------------------------------------------------");
for (const item of audit.results) {
  const statusIcon = item.status === "configured" ? "✅ CONFIGURED" : (item.category === "required" ? "❌ MISSING (REQUIRED)" : "⚠️  MISSING (OPTIONAL)");
  console.log(`${item.variable.padEnd(32)} [${item.category.padEnd(10)}] -> ${statusIcon}`);
}

console.log("\n-------------------------------------------------");
console.log(`Summary: ${audit.summary.configured}/${audit.summary.total} configured | ${audit.summary.missingRequired} required missing | ${audit.summary.missingOptional} optional missing`);
console.log("-------------------------------------------------");

if (isStrict && !audit.allRequiredConfigured) {
  console.error("\n❌ FATAL: Required environment variables are missing in strict mode.");
  process.exit(1);
} else {
  console.log("\n✅ Diagnostic completed successfully.");
}
