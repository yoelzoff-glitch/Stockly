import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createAdminClient } from "@/lib/supabase/admin";
import { refreshMeliToken, TransientMeliTokenError } from "@/services/meli/refreshToken";
import { syncOrders } from "@/services/meli/syncOrders";
import { syncShipments } from "@/services/meli/syncShipments";

async function main() {
  const tenantId = process.argv[2] || "198b6356-4bbf-43d8-ae0e-3cc406f66f87";
  const supabase = createAdminClient();

  console.log("=================================================");
  console.log(`PROCEDIMIENTO DE RECUPERACIÓN DE MERCADO LIBRE`);
  console.log(`Tenant objetivo: ${tenantId}`);
  console.log("=================================================\n");

  // Paso 1: Diagnóstico previo
  console.log("1. Verificando estado actual de la cuenta en BD...");
  const { data: account, error: accErr } = await supabase
    .from("meli_accounts")
    .select("id, tenant_id, meli_user_id, status, sync_error, token_expires_at, last_success_refresh, updated_at, has_refresh_token:refresh_token")
    .eq("tenant_id", tenantId)
    .single();

  if (accErr || !account) {
    console.error("❌ Error al obtener la cuenta de Mercado Libre:", accErr?.message || "No existe");
    process.exit(1);
  }

  console.log("Estado antes de la recuperación:", {
    accountId: account.id,
    meliUserId: account.meli_user_id,
    status: account.status,
    sync_error: account.sync_error,
    token_expires_at: account.token_expires_at,
    last_success_refresh: account.last_success_refresh,
    updated_at: account.updated_at,
    has_refresh_token: Boolean(account.has_refresh_token),
  });

  if (!account.has_refresh_token) {
    console.error("\n❌ FATAL: La cuenta no posee refresh_token. Es obligatoria la reautorización OAuth.");
    process.exit(1);
  }

  // Paso 2: Renovación mediante el flujo oficial protegido
  console.log("\n2. Ejecutando renovación de token mediante refreshMeliToken...");
  let newAccessToken: string | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Intento ${attempt}/${maxRetries}...`);
      newAccessToken = await refreshMeliToken(tenantId, { force: true });
      console.log("   ✅ Renovación exitosa en Mercado Libre y persistida en BD.");
      break;
    } catch (err: any) {
      if (err instanceof TransientMeliTokenError || err?.isTransient) {
        const waitMs = err.retryAfterMs || attempt * 3000 + Math.random() * 1000;
        console.warn(`   ⚠️ Error transitorio (${err.message}). Esperando ${Math.round(waitMs)}ms antes de reintentar...`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }
      console.error("   ❌ Error en la renovación:", err.message);
      if (err?.message?.includes("invalid_grant")) {
        console.error("   ⚠️ El refresh token fue rechazado con invalid_grant. Se requiere autorización del usuario mediante OAuth.");
      }
      process.exit(1);
    }
  }

  // Paso 3: Verificar estado recuperado en BD
  console.log("\n3. Verificando persistencia y estado en base de datos...");
  const { data: updatedAccount, error: updateErr } = await supabase
    .from("meli_accounts")
    .select("id, status, sync_error, token_expires_at, last_success_refresh, updated_at")
    .eq("tenant_id", tenantId)
    .single();

  if (updateErr || !updatedAccount) {
    console.error("❌ Error verificando cuenta actualizada:", updateErr?.message);
    process.exit(1);
  }

  console.log("Estado verificado post-renovación:", {
    status: updatedAccount.status,
    sync_error: updatedAccount.sync_error,
    token_expires_at: updatedAccount.token_expires_at,
    last_success_refresh: updatedAccount.last_success_refresh,
    updated_at: updatedAccount.updated_at,
  });

  if (updatedAccount.status !== "connected") {
    console.error("❌ La cuenta no quedó en estado 'connected'. Abortando sincronización.");
    process.exit(1);
  }

  // Paso 4: Sincronización acotada e incremental de órdenes
  console.log("\n4. Ejecutando sincronización incremental de órdenes pendientes...");
  const { data: syncStateBefore } = await supabase
    .from("meli_sync_state")
    .select("last_successful_sync_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "orders")
    .maybeSingle();

  console.log(`   Watermark anterior: ${syncStateBefore?.last_successful_sync_at || "Ninguno"}`);

  const syncResult = await syncOrders(tenantId, undefined, undefined, {
    source: "manual",
    correlationId: `recovery-${Date.now()}`,
  });

  console.log("   Resultado de syncOrders:", syncResult);

  // Sincronizar envíos
  console.log("\n5. Ejecutando sincronización de envíos asociados...");
  const shipmentsResult = await syncShipments(tenantId, undefined, {
    source: "manual",
  });
  console.log("   Resultado de syncShipments:", shipmentsResult);

  // Paso 5: Verificaciones de consistencia (ventas recuperadas, watermark, sin duplicados)
  console.log("\n6. Verificando consistencia post-sincronización...");

  const { data: syncStateAfter } = await supabase
    .from("meli_sync_state")
    .select("last_successful_sync_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("resource_type", "orders")
    .maybeSingle();

  console.log(`   Nuevo watermark: ${syncStateAfter?.last_successful_sync_at}`);

  // Verificar órdenes en las últimas 24 horas
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders, count: totalRecent } = await supabase
    .from("orders")
    .select("id, meli_order_id, date_created, status, total_amount", { count: "exact" })
    .eq("tenant_id", tenantId)
    .gte("date_created", twentyFourHoursAgo)
    .order("date_created", { ascending: false });

  console.log(`   Total órdenes en las últimas 24 horas: ${totalRecent}`);
  console.log("   Órdenes más recientes:");
  for (const o of (recentOrders || []).slice(0, 5)) {
    console.log(`     - Orden ML: ${o.meli_order_id} | Fecha: ${o.date_created} | Estado: ${o.status} | Total: $${o.total_amount}`);
  }

  // Verificar duplicados
  const meliIds = (recentOrders || []).map((o) => o.meli_order_id);
  const duplicates = meliIds.filter((id, index) => meliIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    console.warn(`   ⚠️ ATENCIÓN: Se detectaron IDs duplicados:`, duplicates);
  } else {
    console.log("   ✅ Cero duplicados detectados en órdenes recientes.");
  }

  console.log("\n=================================================");
  console.log("🎉 RECUPERACIÓN COMPLETADA EXITOSAMENTE");
  console.log("=================================================");
}

main().catch((e) => {
  console.error("FATAL ERROR IN RECOVERY:", e);
  process.exit(1);
});
