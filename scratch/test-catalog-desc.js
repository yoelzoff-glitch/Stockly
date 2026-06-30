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

  // Test fetching product details
  try {
    const res = await meliFetch({
      tenantId,
      endpoint: "/products/MLA4152382670"
    });
    console.log("Product keys:", Object.keys(res));
    console.log("Product buy_box_winner keys:", res.buy_box_winner ? Object.keys(res.buy_box_winner) : "None");
    
    // Check if there is any text or description
    console.log("Product name/title:", res.name || res.title);
    console.log("Product short_description:", res.short_description);
    console.log("Product description:", res.description);
    
    // Try to see if there is a description in attributes or specifications
    if (res.attributes) {
      console.log("Product attributes count:", res.attributes.length);
    }
  } catch (e) {
    console.log("Product fetch failed:", e.message || e);
  }
}

main().catch(console.error);
