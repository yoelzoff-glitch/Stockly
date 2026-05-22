import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const clientId = process.env.MELI_CLIENT_ID;
  const redirectUri = process.env.MELI_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error("Missing MELI_CLIENT_ID or MELI_REDIRECT_URI in env");
    return NextResponse.redirect(new URL("/dashboard/integrations?meli=error", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const meliAuthUrl = new URL("https://auth.mercadolibre.com.ar/authorization");
  meliAuthUrl.searchParams.set("response_type", "code");
  meliAuthUrl.searchParams.set("client_id", clientId);
  meliAuthUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(meliAuthUrl.toString());
}
