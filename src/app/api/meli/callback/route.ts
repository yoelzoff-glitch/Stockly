import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { POST as webhookPOST } from "../webhook/route";

export async function POST(request: NextRequest) {
  return webhookPOST(request);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!code) {
    console.error("Meli Callback Error: No code provided.");
    return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
  }

  // Auth user checking
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  // Get user profile for tenant_id
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    console.error("Meli Callback Error: Profile or tenant_id not found.", profileError);
    return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
  }

  const clientId = process.env.MELI_CLIENT_ID;
  const clientSecret = process.env.MELI_CLIENT_SECRET;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Meli Callback Error: Missing Meli credentials in env.");
    return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
  }

  try {
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get("meli_code_verifier")?.value;

    if (!codeVerifier) {
      console.error("Meli Callback Error: No code_verifier found in cookies.");
      return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
    }

    // Exchange code for token
    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Meli API Error:", tokenData);
      return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
    }

    const { access_token, refresh_token, expires_in, user_id } = tokenData;
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Save to DB using Admin Client
    const supabaseAdmin = createAdminClient();
    const { error: upsertError } = await supabaseAdmin
      .from("meli_accounts")
      .upsert({
        tenant_id: profile.tenant_id,
        meli_user_id: user_id.toString(),
        access_token,
        refresh_token,
        token_expires_at: expiresAt.toISOString(),
        status: "connected",
        metadata: tokenData,
      }, {
        onConflict: "tenant_id, meli_user_id"
      });

    if (upsertError) {
      console.error("Supabase Upsert Error:", upsertError);
      return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
    }

    return NextResponse.redirect(new URL("/dashboard/integrations?meli=connected", baseUrl));
  } catch (error) {
    console.error("Meli Callback Exception:", error);
    return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", baseUrl));
  }
}
