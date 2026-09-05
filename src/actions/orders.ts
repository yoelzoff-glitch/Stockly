"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/security/tenantAuth";
import { revalidatePath } from "next/cache";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function toggleIgnoreOrderAction(meliOrderId: string, currentIgnored: boolean) {
  try {
    const context = await requireTenantContext();
    await assertTenantWritable(context.tenantId);
    const adminSupabase = createAdminClient();

    // Fetch current metadata to merge
    const { data: tenant } = await adminSupabase
      .from("tenants")
      .select("metadata")
      .eq("id", context.tenantId)
      .single();

    const currentMetadata = (tenant?.metadata as Record<string, any>) || {};
    let ignoredOrderIds: string[] = currentMetadata.ignored_order_ids || [];

    if (currentIgnored) {
      // Remove from ignored
      ignoredOrderIds = ignoredOrderIds.filter((id) => id !== meliOrderId);
    } else {
      // Add to ignored
      if (!ignoredOrderIds.includes(meliOrderId)) {
        ignoredOrderIds.push(meliOrderId);
      }
    }

    const newMetadata = {
      ...currentMetadata,
      ignored_order_ids: ignoredOrderIds,
    };

    const { error } = await adminSupabase
      .from("tenants")
      .update({ metadata: newMetadata })
      .eq("id", context.tenantId);

    if (error) {
      console.error("Error toggling ignored order:", error);
      return { error: "Error al actualizar la configuración de la orden" };
    }

    revalidatePath("/dashboard/sales");
    revalidatePath("/dashboard/finance");
    return { success: "Configuración de la orden actualizada correctamente" };
  } catch (err: any) {
    return { error: err.message || "No autenticado" };
  }
}
