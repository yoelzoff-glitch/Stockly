const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

async function run() {
  const query = "2778889574";
  
  const res1 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,title,sku,meli_item_id&or=(sku.eq.%22${query}%22,meli_item_id.ilike.%22*${query}*%22)`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  console.log("exactMatches:", await res1.json());
  
  const query2 = encodeURIComponent("%Banqueta Alta Industrial Para Barra 1m Hierro Y Madera%");
  const res2 = await fetch(`${supabaseUrl}/rest/v1/products?select=id,title,sku,meli_item_id&title=ilike.${query2}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  console.log("titleMatches:", await res2.json());
}
run();
