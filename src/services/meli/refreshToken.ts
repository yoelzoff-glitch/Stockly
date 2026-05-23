import { createAdminClient } from "@/lib/supabase/admin";
import { createAlert } from "../alerts/createAlert";

export async function refreshMeliToken(meliAccountIdOrTenantId: string) {
  const supabaseAdmin = createAdminClient();
  
  // 1. Fetch current token and refresh_token
  // It can be identified by meliAccountId or tenant_id
  const { data: account, error } = await supabaseAdmin
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at")
    .or(`id.eq."${meliAccountIdOrTenantId}",tenant_id.eq."${meliAccountIdOrTenantId}"`)
    .maybeSingle();

  if (error || !account) {
    throw new Error(`Meli account not found for reference: ${meliAccountIdOrTenantId}`);
  }

  const tenantId = account.tenant_id;

  // 2. Call Mercado Libre API to refresh
  const clientId = process.env.MELI_CLIENT_ID || process.env.NEXT_PUBLIC_MELI_APP_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Mercado Libre App ID or Secret in environment variables");
  }

  if (!account.refresh_token) {
    const errMsg = `No refresh token available for reference: ${meliAccountIdOrTenantId}`;
    
    // Update status to error
    await supabaseAdmin
      .from("meli_accounts")
      .update({
        status: "error",
        sync_error: errMsg,
      })
      .eq("id", account.id);

    await createAlert({
      tenantId,
      title: "Error de integración con Mercado Libre",
      body: "No hay un token de renovación (refresh token) disponible. Por favor, vuelve a conectar tu cuenta.",
      severity: "critical"
    });

    // Create Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "token_refresh_failed",
      resource_type: "meli_account",
      resource_id: account.id,
      details: { error: errMsg }
    });

    throw new Error(errMsg);
  }

  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: account.refresh_token,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errMsg = errorData ? JSON.stringify(errorData) : `Status ${response.statusText}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // 3. Update DB
    await supabaseAdmin
      .from("meli_accounts")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || account.refresh_token,
        token_expires_at: newExpiresAt,
        status: "connected",
        sync_error: null,
        last_success_refresh: new Date().toISOString(),
      })
      .eq("id", account.id);

    // Create Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "token_refreshed",
      resource_type: "meli_account",
      resource_id: account.id,
      details: { expires_at: newExpiresAt }
    });

    return data.access_token;

  } catch (err: any) {
    const errMsg = err.message || String(err);
    console.error("Failed to refresh ML token:", errMsg);

    // Update DB status to error
    await supabaseAdmin
      .from("meli_accounts")
      .update({
        status: "error",
        sync_error: errMsg,
      })
      .eq("id", account.id);

    await createAlert({
      tenantId,
      title: "Conexión expirada con Mercado Libre",
      body: "No pudimos renovar el token de conexión. Por favor, reconecta tu cuenta desde la sección Integraciones.",
      severity: "critical"
    });

    // Create Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      action: "token_refresh_failed",
      resource_type: "meli_account",
      resource_id: account.id,
      details: { error: errMsg }
    });

    throw err;
  }
}
