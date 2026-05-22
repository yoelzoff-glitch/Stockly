import { createAdminClient } from "@/lib/supabase/admin";

export async function refreshMeliToken(tenantId: string) {
  const supabaseAdmin = createAdminClient();
  
  // 1. Fetch current token and refresh_token
  const { data: account, error } = await supabaseAdmin
    .from("meli_accounts")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !account) {
    throw new Error(`Meli account not found for tenant: ${tenantId}`);
  }

  // Check if token really needs refresh (let's say we refresh if it expires in less than 5 minutes)
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now > fiveMinutes) {
      // Token is still valid
      return account.access_token;
    }
  }

  if (!account.refresh_token) {
    throw new Error(`No refresh token available for tenant: ${tenantId}`);
  }

  // 2. Call Mercado Libre API to refresh
  const clientId = process.env.NEXT_PUBLIC_MELI_APP_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Mercado Libre App ID or Secret in environment variables");
  }

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
    console.error("Failed to refresh ML token:", errorData);
    throw new Error(`Mercado Libre OAuth refresh failed: ${response.statusText}`);
  }

  const data = await response.json();

  // data will contain: access_token, refresh_token, expires_in (seconds)
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // 3. Update DB
  await supabaseAdmin
    .from("meli_accounts")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq("id", account.id);

  return data.access_token;
}
