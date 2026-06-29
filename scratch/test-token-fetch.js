const { createAdminClient } = require("../src/lib/supabase/admin");

async function main() {
  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("meli_accounts").select("access_token").limit(1);
  if (!accounts || accounts.length === 0) {
    console.log("No accounts found");
    return;
  }
  const token = accounts[0].access_token;
  console.log("Using access token:", token.substring(0, 15) + "...");

  const testEndpoints = [
    { name: "Single Item", url: "https://api.mercadolibre.com/items/MLA911763253" },
    { name: "Multiget Items", url: "https://api.mercadolibre.com/items?ids=MLA911763253" },
    { name: "Search API", url: "https://api.mercadolibre.com/sites/MLA/search?q=MLA911763253" }
  ];

  for (const ep of testEndpoints) {
    console.log(`\n--- Testing ${ep.name} ---`);
    try {
      const res = await fetch(ep.url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      console.log("Status:", res.status);
      const data = await res.json();
      if (res.status === 200) {
        console.log("Success! Keys in response:", Object.keys(Array.isArray(data) ? data[0] : data));
        if (ep.name === "Multiget Items") {
          console.log("Multiget body structure:", JSON.stringify(data, null, 2).substring(0, 500));
        }
      } else {
        console.log("Failed:", data);
      }
    } catch (e) {
      console.log("Error:", e.message || e);
    }
  }
}

main().catch(console.error);
