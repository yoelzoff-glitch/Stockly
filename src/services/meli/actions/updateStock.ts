import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export async function updateStock(tenantId: string, productId: string, newQuantity: number) {
  const supabase = createAdminClient();

  // 1. Get product and check tenant
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("meli_item_id, available_quantity, raw_data")
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
      available_quantity: newQuantity
    }));
  } else {
    body.available_quantity = newQuantity;
  }

  const { meliFetch } = await import("../client");
  await meliFetch({
    tenantId,
    endpoint: `/items/${product.meli_item_id}`,
    method: "PUT",
    body
  });

  // 3. Update local DB
  const oldQuantity = product.available_quantity;

  await supabase
    .from("products")
    .update({ available_quantity: newQuantity })
    .eq("id", productId);

  // 4. Save History & Audit
  await supabase.from("stock_movements").insert({
    tenant_id: tenantId,
    product_id: productId,
    previous_quantity: oldQuantity,
    new_quantity: newQuantity,
    quantity_delta: newQuantity - oldQuantity,
    movement_type: "ai_update",
    reason: "Actualizado por IA"
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
