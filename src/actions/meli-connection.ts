"use server";

import { createClient } from "@/lib/supabase/server";
import { refreshMeliToken } from "@/services/meli/refreshToken";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";
import { acquireOperationLease, releaseOperationLease } from "@/lib/security/leases";

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

    // Call the refresh service with force: true for manual user action
    await refreshMeliToken(profile.tenant_id, { force: true });
    
    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error: any) {
    console.error("Manual token refresh action failed:", error);
    return { success: false, error: error.message };
  }
}

export async function retryMeliOrdersSyncAction(): Promise<{
  success: boolean;
  status: "executed" | "busy" | "error";
  ordersProcessed?: number;
  message: string;
}> {
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
    const tenantId = profile.tenant_id;

    await assertTenantWritable(tenantId);

    // Concurrency guard with operation lease: prevent concurrent sync
    const workerId = `manual-sync-${tenantId}-${Date.now()}`;
    const lease = await acquireOperationLease({
      tenantId,
      operationType: "sync_orders",
      leaseOwner: workerId,
      ttlSeconds: 180,
    });

    if (!lease.acquired) {
      return {
        success: false,
        status: "busy",
        message: "Ya hay una sincronización de ventas en curso para tu cuenta. Por favor aguardá unos instantes.",
      };
    }

    try {
      // Execute orders sync directly without heavy product sync!
      const { syncOrders } = await import("@/services/meli/syncOrders");
      const ordersProcessed = await syncOrders(tenantId, undefined, undefined, {
        source: "manual",
        correlationId: `retry-sync-${Date.now()}`,
      });

      revalidatePath("/dashboard/sales");
      revalidatePath("/dashboard/integrations");
      revalidatePath("/dashboard");

      return {
        success: true,
        status: "executed",
        ordersProcessed,
        message: `Sincronización de ventas completada. Se procesaron ${ordersProcessed} órdenes.`,
      };
    } finally {
      await releaseOperationLease({
        tenantId,
        operationType: "sync_orders",
        leaseOwner: workerId,
      });
    }
  } catch (error: any) {
    console.error("Retry sync action failed:", error);
    return {
      success: false,
      status: "error",
      message: `Error al reintentar sincronización: ${error?.message || "Error desconocido"}`,
    };
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
        sync_error: null,
        next_retry_at: null,
        last_failure_category: null,
        last_failure_reason: null,
        updated_at: new Date().toISOString(),
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
      entity_type: "meli_account",
      entity_id: profile.tenant_id,
      metadata: { message: "Conexión desconectada manualmente por el usuario conservando los datos históricos." },
    });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (e: any) {
    console.error("Disconnect exception:", e);
    return { success: false, error: e.message };
  }
}
