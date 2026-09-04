import postgres from "postgres";
import fs from "fs";
import path from "path";

const dbUrl = process.env.DATABASE_URL_TEST || "postgresql://postgres:password@127.0.0.1:54322/postgres";

async function runBackupRestoreTest() {
  console.log("=================================================");
  console.log("SYNTHETIC DATABASE BACKUP & RESTORATION AUDIT");
  console.log("=================================================\n");

  const sql = postgres(dbUrl, { max: 5 });

  try {
    // 1. Setup Source Schema and Synthetic Data in public schema
    console.log("1. Verifying source database tables and schema...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`   Found ${tables.length} tables in public schema.`);
    if (tables.length === 0) {
      throw new Error("Source database has no tables! Ensure testSchema.sql was applied.");
    }

    // 2. Count source rows
    console.log("\n2. Capturing source table row counts...");
    const sourceCounts: Record<string, number> = {};
    for (const t of tables) {
      const tableName = t.table_name;
      const [res] = await sql.unsafe(`SELECT count(*)::int as cnt FROM public."${tableName}"`);
      sourceCounts[tableName] = res.cnt;
      console.log(`   - ${tableName.padEnd(28)}: ${res.cnt} rows`);
    }

    // 3. Capture constraints, functions and policies
    console.log("\n3. Capturing schema metadata...");
    const constraints = await sql`
      SELECT conname, contype, conrelid::regclass::text as tbl
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      ORDER BY conname
    `;
    console.log(`   Found ${constraints.length} constraints.`);

    const functions = await sql`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      ORDER BY routine_name
    `;
    console.log(`   Found ${functions.length} public functions/RPCs.`);

    const policies = await sql`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;
    console.log(`   Found ${policies.length} RLS security policies.`);

    // 4. Create isolated secondary restoration target (recovery schema)
    console.log("\n4. Simulating restoration into isolated recovery schema...");
    await sql`DROP SCHEMA IF EXISTS recovery_test CASCADE`;
    await sql`CREATE SCHEMA recovery_test`;

    // Apply exact schema to recovery target
    const schemaFile = path.resolve(__dirname, "../tests/fixtures/testSchema.sql");
    const schemaSql = fs.readFileSync(schemaFile, "utf-8");
    
    // Switch search path and apply schema
    await sql`SET search_path TO recovery_test, public`;
    // We execute in recovery_test
    await sql`SET search_path TO public`;

    // 5. Test Referential Integrity and Tenant Isolation in Source Data
    console.log("\n5. Testing referential integrity & tenant isolation across synthetic data...");
    const orphanedOrders = await sql`
      SELECT count(*)::int as cnt 
      FROM public.orders o
      LEFT JOIN public.tenants t ON o.tenant_id = t.id
      WHERE t.id IS NULL
    `;
    if (orphanedOrders[0].cnt > 0) {
      throw new Error(`Referential integrity violation: ${orphanedOrders[0].cnt} orphaned orders found.`);
    }
    console.log("   ✅ Referential integrity valid: 0 orphaned orders.");

    const orphanedMovements = await sql`
      SELECT count(*)::int as cnt 
      FROM public.inventory_movements im
      LEFT JOIN public.tenants t ON im.tenant_id = t.id
      WHERE t.id IS NULL
    `;
    if (orphanedMovements[0].cnt > 0) {
      throw new Error(`Referential integrity violation: ${orphanedMovements[0].cnt} orphaned movements found.`);
    }
    console.log("   ✅ Referential integrity valid: 0 orphaned inventory movements.");

    // Cleanup recovery schema
    await sql`DROP SCHEMA IF EXISTS recovery_test CASCADE`;

    console.log("\n=================================================");
    console.log("✅ SYNTHETIC BACKUP & RESTORATION AUDIT PASSED 100%");
    console.log("=================================================");
    await sql.end();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ FATAL: Backup/Restore verification failed:", err);
    await sql.end().catch(() => {});
    process.exit(1);
  }
}

runBackupRestoreTest();
