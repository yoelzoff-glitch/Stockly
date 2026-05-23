import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export async function updatePrice(tenantId: string, productId: string, newPrice: number) {
  const supabase = createAdminClient();

  // 1. Get product and check tenant
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("meli_item_id, price, raw_data")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (prodErr || !product) {
    throw new AppError("VALIDATION_ERROR", "Producto no encontrado o no pertenece al tenant", 404);
  }

  // 2. Call Mercado Libre API using resilient meliFetch
  let body: any = {};

  const rawData = product.raw_data as any;
  if (rawData && rawData.variations && rawData.variations.length > 0) {
    body.variations = rawData.variations.map((v: any) => ({
      id: v.id,
      price: newPrice
    }));
  } else {
    body.price = newPrice;
  }

  const { meliFetch } = await import("../client");
  await meliFetch({
    tenantId,
    endpoint: `/items/${product.meli_item_id}`,
    method: "PUT",
    body
  });

  // 3. Update local DB
  const oldPrice = product.price;

  await supabase
    .from("products")
    .update({ price: newPrice })
    .eq("id", productId);

  // 4. Save History & Audit
  await supabase.from("product_price_history").insert({
    tenant_id: tenantId,
    product_id: productId,
    old_price: oldPrice,
    new_price: newPrice,
    source: "ai_agent"
  });

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    action: "update_price",
    resource_type: "product",
    resource_id: productId,
    details: { old_price: oldPrice, new_price: newPrice }
  });

  return true;
}
