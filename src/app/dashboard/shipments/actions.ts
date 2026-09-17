"use server";

import { createClient } from "@/lib/supabase/server";
import { syncShipments } from "@/services/meli/syncShipments";
import { revalidatePath } from "next/cache";

export async function manualSyncShipmentsAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) return { success: false, error: "Tenant no encontrado" };

    await syncShipments(profile.tenant_id);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Error al sincronizar envíos" };
  }
}
