"use server";

import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors/AppError";

export async function createPauseProductsWorkflow(productIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) throw new Error("Tenant not found");

  if (productIds.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Debe seleccionar al menos un producto.");
  }

  if (productIds.length > 50) {
    throw new AppError("VALIDATION_ERROR", "No se puede pausar más de 50 productos a la vez por seguridad.");
  }

  // Verificar preferencias del tenant (seguridad)
  const { data: preferences } = await supabase
    .from("tenant_preferences")
    .select("protected_products")
    .eq("tenant_id", tenantId)
    .single();

  const protectedProducts = preferences?.protected_products || [];
  const validProductIds = productIds.filter((id) => !protectedProducts.includes(id));

  if (validProductIds.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Todos los productos seleccionados están protegidos y no pueden pausarse.");
  }

  // Get products details
  const { data: products } = await supabase
    .from("products")
    .select("id, title, status")
    .eq("tenant_id", tenantId)
    .in("id", validProductIds);

  if (!products) throw new Error("No products found");

  const alreadyPaused = products.filter(p => p.status === 'paused');
  const toPause = products.filter(p => p.status !== 'paused');

  if (toPause.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Todos los productos ya están pausados.");
  }

  const itemsPayload = toPause.map((p) => ({
    product_id: p.id,
    title: p.title,
    new_value: "paused",
    current_value: p.status,
  }));

  // Create pending AI Action
  const { data: action, error } = await supabase
    .from("ai_actions")
    .insert({
      tenant_id: tenantId,
      action_type: "pause_product",
      status: "pending",
      title: `Pausar ${toPause.length} productos sin movimiento`,
      payload: itemsPayload,
      require_confirmation: true,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    })
    .select()
    .single();

  if (error || !action) {
    throw new Error("Error al crear la acción");
  }

  // Registrar auditoría
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    user_id: user.id,
    action: "create_bulk_pause_workflow",
    resource_type: "products",
    details: { requested_count: productIds.length, valid_count: toPause.length, action_id: action.id }
  });

  return { success: true, actionId: action.id, skippedCount: productIds.length - toPause.length };
}
