import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export async function updateStock(tenantId: string, productId: string, newQuantity: number) {
  const supabase = createAdminClient();

  // 1. Get product and check tenant
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("meli_item_id, available_quantity")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (prodErr || !product) {
    throw new AppError("VALIDATION_ERROR", "Producto no encontrado o no pertenece al tenant", 404);
  }

  // 2. Get Meli Token
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .single();

  if (!meliAccount?.access_token) {
    throw new AppError("VALIDATION_ERROR", "No hay cuenta de Mercado Libre conectada", 400);
  }

  // 3. Call Mercado Libre API
  const url = `https://api.mercadolibre.com/items/${product.meli_item_id}`;
  const mlResponse = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${meliAccount.access_token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ available_quantity: newQuantity })
  });

  if (!mlResponse.ok) {
    const errorData = await mlResponse.json();
    logger.error(`Error de Meli al actualizar stock: ${JSON.stringify(errorData)}`, "MERCADO_LIBRE");
    throw new AppError("VALIDATION_ERROR", "Error de Mercado Libre: " + (errorData.message || "Desconocido"), mlResponse.status);
  }

  // 4. Update local DB
  const oldQuantity = product.available_quantity;

  await supabase
    .from("products")
    .update({ available_quantity: newQuantity })
    .eq("id", productId);

  // 5. Save History & Audit
  await supabase.from("stock_movements").insert({
    tenant_id: tenantId,
    product_id: productId,
    old_quantity: oldQuantity,
    new_quantity: newQuantity,
    reason: "ai_update"
  });

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    action: "update_stock",
    resource_type: "product",
    resource_id: productId,
    details: { old_quantity: oldQuantity, new_quantity: newQuantity }
  });

  return true;
}
