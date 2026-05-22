import { refreshMeliToken } from "../meli/refreshToken";
import { createAdminClient } from "@/lib/supabase/admin";

export async function searchCompetitors(tenantId: string, productId: string) {
  const supabase = createAdminClient();

  // 1. Get our product and seller id
  const { data: product } = await supabase
    .from("products")
    .select("title, category_id, price")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  const { data: account } = await supabase
    .from("meli_accounts")
    .select("meli_user_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!product || !account) {
    throw new Error("Product or Meli Account not found");
  }

  const mySellerId = account.meli_user_id;

  // 2. Fetch ML API
  const accessToken = await refreshMeliToken(tenantId);
  const query = product.title;
  let url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=50`;
  
  if (product.category_id) {
    url += `&category=${product.category_id}`;
  }

  const response = await fetch(url, {
    headers: { 
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": "StocklyApp/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("ML API Error:", errorText, url);
    throw new Error(`Error fetching ML API for competitors: ${errorText}`);
  }

  const data = await response.json();

  // 3. Filter our own products and normalize array
  const rawResults = data.results || [];
  const competitors = rawResults
    .filter((r: any) => String(r.seller?.id) !== String(mySellerId))
    .slice(0, 20)
    .map((r: any) => ({
      item_id: r.id,
      title: r.title,
      price: r.price,
      currency_id: r.currency_id,
      available_quantity: r.available_quantity,
      sold_quantity: r.sold_quantity,
      permalink: r.permalink,
      thumbnail: r.thumbnail,
      seller_id: r.seller?.id,
      condition: r.condition,
      listing_type_id: r.listing_type_id,
      free_shipping: r.shipping?.free_shipping || false,
    }));

  return {
    query,
    own_price: product.price,
    competitors
  };
}
