import { createAdminClient } from "@/lib/supabase/admin";
import { refreshMeliToken } from "./refreshToken";
import { createAlert } from "../alerts/createAlert";
import { AppError } from "@/lib/errors/AppError";

export interface MeliFetchArgs {
  tenantId?: string;
  meliAccountId?: string;
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
}

export async function meliFetch({
  tenantId,
  meliAccountId,
  endpoint,
  method = "GET",
  body
}: MeliFetchArgs): Promise<any> {
  const supabase = createAdminClient();

  // 1. Fetch current meli account
  let query = supabase
    .from("meli_accounts")
    .select("id, tenant_id, access_token, refresh_token, token_expires_at");

  if (meliAccountId) {
    query = query.eq("id", meliAccountId);
  } else if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  } else {
    throw new AppError("VALIDATION_ERROR", "meliFetch requires either tenantId or meliAccountId", 400);
  }

  const { data: account, error } = await query.maybeSingle();

  if (error || !account) {
    throw new AppError("VALIDATION_ERROR", "No hay una cuenta de Mercado Libre conectada", 400);
  }

  const finalTenantId = account.tenant_id;
  let accessToken = account.access_token;

  // 2. Check if token expires in less than 10 minutes (or already expired)
  let needsRefresh = false;
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    const tenMinutes = 10 * 60 * 1000;
    if (expiresAt - Date.now() < tenMinutes) {
      needsRefresh = true;
    }
  } else {
    needsRefresh = true;
  }

  if (needsRefresh) {
    try {
      accessToken = await refreshMeliToken(account.id);
    } catch (refreshErr: any) {
      throw new AppError("VALIDATION_ERROR", `Failed to auto-refresh Meli token: ${refreshErr.message}`, 401);
    }
  }

  const executeRequest = async (token: string) => {
    const url = `https://api.mercadolibre.com${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    return response;
  };

  // 3. Execute Request
  let response = await executeRequest(accessToken || "");

  // 4. If 401 Unauthorized, attempt refresh once and retry
  if (response.status === 401) {
    console.warn("[meliFetch] Received 401 from Mercado Libre. Attempting token refresh...");
    try {
      accessToken = await refreshMeliToken(account.id);
      response = await executeRequest(accessToken);
    } catch (refreshErr: any) {
      console.error("[meliFetch] Refresh and retry failed:", refreshErr);
    }
  }

  // 5. If it still fails, update status to error and throw controlled error
  if (!response.ok) {
    const errorText = await response.text();
    let errorData: any = null;
    try {
      errorData = JSON.parse(errorText);
    } catch (_) {}

    const errorMessage = errorData?.message || `Mercado Libre API failed with status ${response.status}: ${errorText}`;
    
    // Update meli_accounts status to error
    await supabase
      .from("meli_accounts")
      .update({
        status: "error",
        sync_error: errorMessage,
      })
      .eq("id", account.id);

    await createAlert({
      tenantId: finalTenantId,
      title: "Fallo de comunicación con Mercado Libre",
      body: `La sincronización ha fallado: ${errorMessage.substring(0, 100)}`,
      severity: "error"
    });

    // Create Audit Log
    await supabase.from("audit_logs").insert({
      tenant_id: finalTenantId,
      action: "sync_failed",
      resource_type: "meli_account",
      resource_id: account.id,
      details: { error: errorMessage, endpoint }
    });

    throw new AppError("VALIDATION_ERROR", `Mercado Libre API Error: ${errorMessage}`, response.status);
  }

  return response.json();
}
