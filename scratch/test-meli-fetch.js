const { createAdminClient } = require("../src/lib/supabase/admin");
const { meliFetch } = require("../src/services/meli/client");

async function main() {
  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("meli_accounts").select("tenant_id").limit(1);
  if (!accounts || accounts.length === 0) {
    console.log("No meli accounts found in database");
    return;
  }
  const tenantId = accounts[0].tenant_id;
  console.log("Using tenant ID:", tenantId);

  const candidates = [
    { endpoint: "/items/MLAU3911600852" },
    { endpoint: "/products/MLAU3911600852" },
    { endpoint: "/items/MLA3911600852" },
    { endpoint: "/products/MLA3911600852" },
  ];

  for (const c of candidates) {
    try {
      console.log(`Trying: ${c.endpoint}`);
      const res = await meliFetch({
        tenantId,
        endpoint: c.endpoint
      });
      console.log(`Success! ID: ${res.id}, Title: ${res.title || res.name}`);
    } catch (e) {
      console.log(`Failed: ${e.message} (status: ${e.status})`);
    }
  }
}

main().catch(console.error);
