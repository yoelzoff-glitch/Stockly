"use server";

import { createClient } from "@/lib/supabase/server";
import { refreshMeliToken } from "@/services/meli/refreshToken";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function refreshMeliConnectionAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

    await assertTenantWritable(profile.tenant_id);

    // Call the refresh service
    await refreshMeliToken(profile.tenant_id);
    
    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: any) {
    console.error("Manual token refresh action failed:", error);
    return { success: false, error: error.message };
  }
}

export async function disconnectMeliConnectionAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

    await assertTenantWritable(profile.tenant_id);

    const adminSupabase = createAdminClient();

    // MÓDULO 5: Update status = 'disconnected' and clear tokens
    const { error } = await adminSupabase
      .from("meli_accounts")
      .update({
        status: "disconnected",
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        sync_error: null
      })
      .eq("tenant_id", profile.tenant_id);

    if (error) {
      console.error("Disconnect action failed:", error);
      throw new Error(error.message);
    }

    // Create Audit Log
    await adminSupabase.from("audit_logs").insert({
      tenant_id: profile.tenant_id,
      action: "meli_disconnected",
      resource_type: "meli_account",
      details: { message: "Conexión desconectada manualmente por el usuario conservando los datos históricos." }
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (e: any) {
    console.error("Disconnect exception:", e);
    return { success: false, error: e.message };
  }
}
