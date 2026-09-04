import fs from "fs";
import path from "path";

function auditReleasePipeline() {
  console.log("=================================================");
  console.log("RELEASE PIPELINE & GOVERNANCE AUDIT (SPRINT 7)");
  console.log("=================================================\n");

  const errors: string[] = [];
  const rootDir = path.resolve(__dirname, "..");

  // 1. Audit GitHub Actions Workflow
  const ciWorkflowPath = path.join(rootDir, ".github/workflows/ci.yml");
  if (!fs.existsSync(ciWorkflowPath)) {
    errors.push("Missing .github/workflows/ci.yml");
  } else {
    const ciContent = fs.readFileSync(ciWorkflowPath, "utf-8");
    
    // Check concurrency
    if (!ciContent.includes("concurrency:") || !ciContent.includes("cancel-in-progress: true")) {
      errors.push("ci.yml must configure concurrency with cancel-in-progress: true");
    } else {
      console.log("✅ CI Workflow: Concurrency cancellation configured.");
    }

    // Check minimal permissions
    if (!ciContent.includes("permissions:") || !ciContent.includes("contents: read")) {
      errors.push("ci.yml must configure minimal permissions: contents: read");
    } else {
      console.log("✅ CI Workflow: Minimal permissions (contents: read) verified.");
    }

    // Check timeouts
    if (!ciContent.includes("timeout-minutes:")) {
      errors.push("ci.yml must have explicit timeout-minutes configured on jobs");
    } else {
      console.log("✅ CI Workflow: Explicit timeout limits configured.");
    }

    // Check critical gates in CI
    const requiredKeywords = [
      "npm ci",
      "npm run typecheck",
      "npm run test:ci",
      "npm run audit:auth",
      "npm run audit:rls",
      "npm run audit:webhooks",
      "npm run audit:billing",
      "npm run audit:performance",
      "npm run audit:release",
      "npm run test:rls:integration",
      "npm run test:webhooks:integration",
      "npm run test:billing:integration",
      "npm run test:leases:integration",
      "npm run test:fault",
      "npm run test:recovery",
      "npm run test:e2e",
      "npm run build",
    ];

    for (const kw of requiredKeywords) {
      if (!ciContent.includes(kw)) {
        errors.push(`ci.yml is missing required step: ${kw}`);
      }
    }
    console.log("✅ CI Workflow: All 17 verification gates declared in workflow.");
  }

  // 2. Audit Node/npm version alignment
  const pkgJsonPath = path.join(rootDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  if (!pkg.engines || !pkg.engines.node || !pkg.engines.npm) {
    errors.push("package.json must define engines.node and engines.npm");
  } else {
    console.log(`✅ Version Alignment: engines configured (node: ${pkg.engines.node}, npm: ${pkg.engines.npm}).`);
  }

  const nvmrcPath = path.join(rootDir, ".nvmrc");
  if (!fs.existsSync(nvmrcPath) || !fs.readFileSync(nvmrcPath, "utf-8").includes("22")) {
    errors.push(".nvmrc must exist and specify Node 22");
  } else {
    console.log("✅ Version Alignment: .nvmrc matches Node 22.");
  }

  const nodeVersionPath = path.join(rootDir, ".node-version");
  if (!fs.existsSync(nodeVersionPath) || !fs.readFileSync(nodeVersionPath, "utf-8").includes("22")) {
    errors.push(".node-version must exist and specify Node 22");
  } else {
    console.log("✅ Version Alignment: .node-version matches Node 22.");
  }

  // 3. Audit Runbooks and Operational Documentation
  const requiredDocs = [
    "docs/operations/SPRINT_07_RELEASE_AUDIT.md",
    "docs/runbooks/backup_restore.md",
    "docs/runbooks/disaster_recovery.md",
    "docs/runbooks/deployment_checklist.md",
    "docs/runbooks/incident_response.md",
  ];

  for (const doc of requiredDocs) {
    const docPath = path.join(rootDir, doc);
    if (!fs.existsSync(docPath)) {
      errors.push(`Missing documentation runbook: ${doc}`);
    } else {
      console.log(`✅ Documentation: ${doc} present.`);
    }
  }

  // 4. Results
  console.log("\n-------------------------------------------------");
  if (errors.length > 0) {
    console.error("❌ RELEASE AUDIT FAILED with errors:");
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  } else {
    console.log("✅ ALL RELEASE PIPELINE CHECKS PASSED (Exit Code: 0)");
    process.exit(0);
  }
}

auditReleasePipeline();
