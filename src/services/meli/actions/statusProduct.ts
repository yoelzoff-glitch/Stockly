import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export async function changeProductStatus(tenantId: string, productId: string, status: "paused" | "active") {
  const supabase = createAdminClient();

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("meli_item_id, status")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (prodErr || !product) {
    throw new AppError("VALIDATION_ERROR", "Producto no encontrado o no pertenece al tenant", 404);
  }

  // Call Mercado Libre API using resilient meliFetch
  const { meliFetch } = await import("../client");
  await meliFetch({
    tenantId,
    endpoint: `/items/${product.meli_item_id}`,
    method: "PUT",
    body: { status }
  });

  const oldStatus = product.status;

  await supabase
    .from("products")
    .update({ status })
    .eq("id", productId);

  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    action: `change_status_to_${status}`,
    resource_type: "product",
    resource_id: productId,
    details: { old_status: oldStatus, new_status: status }
  });

  return true;
}

export const pauseProduct = (tenantId: string, productId: string) => changeProductStatus(tenantId, productId, "paused");
export const activateProduct = (tenantId: string, productId: string) => changeProductStatus(tenantId, productId, "active");
