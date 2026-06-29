const { createAdminClient } = require("../src/lib/supabase/admin");
const { meliFetch } = require("../src/services/meli/client");

async function main() {
  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("meli_accounts").select("tenant_id").limit(1);
  if (!accounts || accounts.length === 0) {
    console.log("No accounts found");
    return;
  }
  const tenantId = accounts[0].tenant_id;
  console.log("Using tenant ID:", tenantId);

  try {
    const res = await meliFetch({
      tenantId,
      endpoint: "/items?ids=MLA911763253"
    });
    console.log("Multiget result:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.log("Multiget failed:", e.message || e);
  }
}

main().catch(console.error);
