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

  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .single();

  if (!meliAccount?.access_token) {
    throw new AppError("VALIDATION_ERROR", "No hay cuenta de Mercado Libre conectada", 400);
  }

  const url = `https://api.mercadolibre.com/items/${product.meli_item_id}`;
  const mlResponse = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${meliAccount.access_token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({ status })
  });

  if (!mlResponse.ok) {
    const errorData = await mlResponse.json();
    logger.error(`Error de Meli al cambiar estado a ${status}: ${JSON.stringify(errorData)}`, "MERCADO_LIBRE");
    throw new AppError("VALIDATION_ERROR", "Error de Mercado Libre: " + (errorData.message || "Desconocido"), mlResponse.status);
  }

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
