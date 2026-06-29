const { createAdminClient } = require("../src/lib/supabase/admin");

async function main() {
  const supabase = createAdminClient();
  const { data: accounts } = await supabase.from("meli_accounts").select("access_token").limit(1);
  if (!accounts || accounts.length === 0) {
    console.log("No meli accounts found");
    return;
  }
  const token = accounts[0].access_token;
  console.log("Using token:", token ? `${token.substring(0, 10)}...` : "null");

  const urls = [
    "https://api.mercadolibre.com/products/MLAU3911600852",
    "https://api.mercadolibre.com/products/MLA3911600852",
    "https://api.mercadolibre.com/items/MLAU3911600852",
    "https://api.mercadolibre.com/items/MLA3911600852"
  ];

  for (const url of urls) {
    try {
      console.log(`Fetching: ${url}`);
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        console.log(`Success! ID: ${data.id}, Title: ${data.title || data.name}`);
      } else {
        console.log(`Error: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      console.log(`Failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
