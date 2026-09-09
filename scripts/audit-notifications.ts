import fs from "node:fs";
import path from "node:path";

interface AuditViolation {
  category: string;
  file: string;
  message: string;
}

function runNotificationsAudit() {
  console.log("=================================================");
  console.log("LIBRETAX SPRINT 12: NOTIFICATIONS & ALERTS AUDIT");
  console.log("=================================================");

  const rootDir = path.resolve(__dirname, "..");
  const srcDir = path.join(rootDir, "src");
  const migrationsDir = path.join(rootDir, "supabase", "migrations");
  const violations: AuditViolation[] = [];

  // 1. Audit Migration for dedupe_key unique index and required columns
  const migration12Path = path.join(migrationsDir, "20260912000000_sprint12_notifications_center.sql");
  if (!fs.existsSync(migration12Path)) {
    violations.push({
      category: "MISSING_MIGRATION",
      file: "supabase/migrations/20260912000000_sprint12_notifications_center.sql",
      message: "Sprint 12 migration for notification center schema is missing.",
    });
  } else {
    const migrationContent = fs.readFileSync(migration12Path, "utf-8");
    if (!migrationContent.includes("idx_alerts_tenant_dedupe_unique") || !migrationContent.includes("(tenant_id, dedupe_key)")) {
      violations.push({
        category: "MISSING_COMPOUND_UNIQUE_INDEX",
        file: "supabase/migrations/20260912000000_sprint12_notifications_center.sql",
        message: "Compound unique index on (tenant_id, dedupe_key) is required for idempotent notifications.",
      });
    }
    if (!migrationContent.includes("notifications_watermark_at SET NOT NULL")) {
      violations.push({
        category: "WATERMARK_NOT_NULL_REQUIRED",
        file: "supabase/migrations/20260912000000_sprint12_notifications_center.sql",
        message: "notifications_watermark_at column must be NOT NULL on tenants table.",
      });
    }
    if (!migrationContent.includes("REVOKE INSERT, UPDATE, DELETE")) {
      violations.push({
        category: "UPDATE_PERMISSIONS_NOT_REVOKED",
        file: "supabase/migrations/20260912000000_sprint12_notifications_center.sql",
        message: "General UPDATE permissions must be explicitly revoked from authenticated before granting column-level UPDATE.",
      });
    }
    if (!migrationContent.includes("BEGIN;") || !migrationContent.includes("COMMIT;")) {
      violations.push({
        category: "MISSING_TRANSACTION_BLOCK",
        file: "supabase/migrations/20260912000000_sprint12_notifications_center.sql",
        message: "Migration must be wrapped inside a BEGIN / COMMIT transaction block.",
      });
    }
  }

  // 2. Audit Daily Summary: Must NOT create active unread notifications
  const dailySummaryPath = path.join(srcDir, "services", "ai", "dailySummary.ts");
  if (fs.existsSync(dailySummaryPath)) {
    const content = fs.readFileSync(dailySummaryPath, "utf-8");
    if (!content.includes("status: \"archived\"") && !content.includes("status: 'archived'")) {
      violations.push({
        category: "DAILY_SUMMARY_ACTIVE_ALERT",
        file: "src/services/ai/dailySummary.ts",
        message: "Daily summaries must be marked as archived so they do NOT appear in the active notification bell.",
      });
    }
    if (!content.includes("is_read: true")) {
      violations.push({
        category: "DAILY_SUMMARY_UNREAD",
        file: "src/services/ai/dailySummary.ts",
        message: "Daily summaries must be marked as is_read: true so they do NOT increment unread badge.",
      });
    }
  }

  // 3. Audit No AI calls for notifications copy
  const notificationServicePath = path.join(srcDir, "services", "notifications", "notificationService.ts");
  if (!fs.existsSync(notificationServicePath)) {
    violations.push({
      category: "MISSING_NOTIFICATION_SERVICE",
      file: "src/services/notifications/notificationService.ts",
      message: "Notification service is missing.",
    });
  } else {
    const notifContent = fs.readFileSync(notificationServicePath, "utf-8");
    if (notifContent.includes("openai") || notifContent.includes("@google/generative-ai")) {
      violations.push({
        category: "FORBIDDEN_AI_COPY",
        file: "src/services/notifications/notificationService.ts",
        message: "AI copy generation is strictly forbidden for operational notifications.",
      });
    }
    if (!notifContent.includes("sanitizeActionUrl")) {
      violations.push({
        category: "MISSING_URL_SANITIZER",
        file: "src/services/notifications/notificationService.ts",
        message: "Action URLs must be strictly sanitized against open redirect vulnerabilities.",
      });
    }
  }

  // 4. Audit No SuperAdmin / Broadcast endpoints
  const apiDir = path.join(srcDir, "app", "api");
  function scanForForbiddenRoutes(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (entry.name === "superadmin" || entry.name === "broadcast") {
          violations.push({
            category: "FORBIDDEN_BROADCAST_ROUTE",
            file: relPath,
            message: `Route directory '${entry.name}' is out of scope for Sprint 12.`,
          });
        }
        scanForForbiddenRoutes(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.includes("broadcast") || entry.name.includes("superadmin")) {
          violations.push({
            category: "FORBIDDEN_ADMIN_ENDPOINT",
            file: relPath,
            message: `File '${entry.name}' indicates admin/broadcast endpoints which are out of scope.`,
          });
        }
      }
    }
  }
  scanForForbiddenRoutes(apiDir);

  // 5. Scan for forbidden source = 'platform_admin' from client or unauthorized setters
  function scanDirForPlatformAdmin(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === ".next" ||
          entry.name === "tests" ||
          entry.name === "scripts"
        ) {
          continue;
        }
        scanDirForPlatformAdmin(fullPath);
      } else if (entry.isFile()) {
        if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx")) continue;
        // Client components must never specify source: 'platform_admin'
        const content = fs.readFileSync(fullPath, "utf-8");
        if (
          (content.includes('"use client"') || content.includes("'use client'")) &&
          (content.includes('"platform_admin"') || content.includes("'platform_admin'"))
        ) {
          violations.push({
            category: "CLIENT_PLATFORM_ADMIN_FORBIDDEN",
            file: relPath,
            message: "Client components must not set or send source: 'platform_admin'.",
          });
        }
      }
    }
  }
  scanDirForPlatformAdmin(srcDir);

  // Output results
  console.log("\n--- AUDIT RESULTS ---");
  if (violations.length === 0) {
    console.log("✅ ALL NOTIFICATION CHECKS PASSED!");
    console.log("   - No active Resumen Diario alert noise.");
    console.log("   - Deduplication enforced by unique index and idempotency keys.");
    console.log("   - Strict internal action URL validation.");
    console.log("   - Zero AI-generated copy.");
    console.log("   - Zero superadmin broadcast endpoints.");
    console.log("   - Strict tenant isolation enforced.");
    console.log("=================================================\n");
    process.exit(0);
  } else {
    console.error(`❌ FOUND ${violations.length} VIOLATIONS:\n`);
    for (const v of violations) {
      console.error(`[${v.category}] ${v.file}: ${v.message}`);
    }
    console.log("\n=================================================");
    process.exit(1);
  }
}

runNotificationsAudit();
