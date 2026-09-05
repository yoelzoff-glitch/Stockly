import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

try {
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal) && typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile(envLocal);
  }
} catch (_) {}

import { seedPrivateDemo, DEMO_TENANT_SLUG, DEMO_SEED_VERSION } from "./seed-private-demo";

export interface ProvisionOptions {
  email?: string;
  password?: string;
  dbUrl?: string;
  tenantSlug?: string;
}

export async function provisionPrivateDemo(options: ProvisionOptions = {}) {
  const email = options.email || process.env.DEMO_ACCOUNT_EMAIL || "yoel.zoff+demo@gmail.com";
  const slug = options.tenantSlug || process.env.DEMO_TENANT_SLUG || DEMO_TENANT_SLUG;
  const dbUrl =
    options.dbUrl ||
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:password@127.0.0.1:54322/postgres";

  console.log(`\n=============================================================`);
  console.log(`🚀 PROVISIONING PRIVATE DEMO TENANT & USER`);
  console.log(`=============================================================`);
  console.log(`Target email: ${email}`);
  console.log(`Target slug: ${slug}`);

  const sql = postgres(dbUrl, { max: 5 });

  try {
    // 1. Check or create tenant
    let [tenant] = await sql`
      SELECT id, is_demo, slug, name FROM public.tenants WHERE slug = ${slug}
    `;

    if (!tenant) {
      console.log(`[PROVISION] Demo tenant '${slug}' does not exist. Creating...`);
      [tenant] = await sql`
        INSERT INTO public.tenants (
          name,
          slug,
          plan,
          status,
          currency,
          timezone,
          is_demo,
          demo_label,
          metadata
        ) VALUES (
          'Casa Norte',
          ${slug},
          'starter',
          'active',
          'ARS',
          'America/Argentina/Buenos_Aires',
          true,
          'Datos ficticios para demostración',
          ${sql.json({
            source: "demo_provisioning",
            demo_seed_version: DEMO_SEED_VERSION,
          })}
        )
        RETURNING id, is_demo, slug, name
      `;
    } else if (!tenant.is_demo) {
      throw new Error(`Refusing to provision: tenant with slug '${slug}' exists but is NOT marked as is_demo = true.`);
    }

    const tenantId = tenant.id;

    // 2. Check or create user in auth.users
    let [user] = await sql`
      SELECT id, email FROM auth.users WHERE email = ${email}
    `;

    if (!user) {
      console.log(`[PROVISION] User '${email}' does not exist. Registering user record...`);
      [user] = await sql`
        INSERT INTO auth.users (
          email
        ) VALUES (
          ${email}
        )
        RETURNING id, email
      `;
    }

    const userId = user.id;

    // 3. Check or create profile linking user to demo tenant
    let [profile] = await sql`
      SELECT id, tenant_id, role FROM public.profiles WHERE id = ${userId}
    `;

    if (!profile) {
      console.log(`[PROVISION] Creating profile for user ${userId} linked to tenant ${tenantId}...`);
      [profile] = await sql`
        INSERT INTO public.profiles (
          id,
          tenant_id,
          full_name,
          email,
          role,
          is_active
        ) VALUES (
          ${userId},
          ${tenantId},
          'Yoel Zoff (Demo)',
          ${email},
          'owner',
          true
        )
        RETURNING id, tenant_id, role
      `;
    } else {
      if (profile.tenant_id !== tenantId) {
        console.log(`[PROVISION] Updating existing demo profile to point to demo tenant ${tenantId}...`);
        await sql`
          UPDATE public.profiles
          SET tenant_id = ${tenantId}
          WHERE id = ${userId}
        `;
      }
    }

    // 4. Ensure demo subscription record exists
    await sql`
      INSERT INTO public.subscriptions (
        tenant_id,
        plan,
        status,
        expires_at
      ) VALUES (
        ${tenantId},
        'starter',
        'active',
        ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `;

    // 5. Execute deterministic seed
    console.log(`[PROVISION] Running deterministic seed dataset...`);
    const seedResult = await seedPrivateDemo({
      dbUrl,
      tenantSlug: slug,
    });

    console.log(`[PROVISION_COMPLETED] Demo account provisioned successfully.`);
    console.log(`User ID: ${userId}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Email: ${email}`);
    console.log(`Slug: ${slug}`);
    console.log(`Products: ${seedResult.productsCount}`);
    console.log(`Orders: ${seedResult.ordersCount}`);
    console.log(`=============================================================\n`);

    return {
      userId,
      tenantId,
      email,
      slug,
      seedResult,
    };
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  provisionPrivateDemo()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("Provisioning failed:", err);
      process.exit(1);
    });
}
