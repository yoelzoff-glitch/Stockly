"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleIgnoreOrderAction(meliOrderId: string, currentIgnored: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return { error: "Tenant no encontrado" };

  // Fetch current metadata to merge
  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", profile.tenant_id)
    .single();
  
  const currentMetadata = (tenant?.metadata as Record<string, any>) || {};
  let ignoredOrderIds: string[] = currentMetadata.ignored_order_ids || [];

  if (currentIgnored) {
    // Remove from ignored
    ignoredOrderIds = ignoredOrderIds.filter(id => id !== meliOrderId);
  } else {
    // Add to ignored
    if (!ignoredOrderIds.includes(meliOrderId)) {
      ignoredOrderIds.push(meliOrderId);
    }
  }

  const newMetadata = {
    ...currentMetadata,
    ignored_order_ids: ignoredOrderIds
  };

  const { error } = await supabase
    .from("tenants")
    .update({ metadata: newMetadata })
    .eq("id", profile.tenant_id);

  if (error) {
    console.error("Error toggling ignored order:", error);
    return { error: "Error al actualizar la configuración de la orden" };
  }

  revalidatePath("/dashboard/sales");
  revalidatePath("/dashboard/finance");
  return { success: "Configuración de la orden actualizada correctamente" };
}
