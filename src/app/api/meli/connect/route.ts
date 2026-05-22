import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

function base64URLEncode(buffer: Buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generatePKCE() {
  const verifier = base64URLEncode(crypto.randomBytes(32));
  const challenge = base64URLEncode(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

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

  const { verifier, challenge } = generatePKCE();
  
  const cookieStore = await cookies();
  cookieStore.set("meli_code_verifier", verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10 // 10 minutes
  });

  const meliAuthUrl = new URL("https://auth.mercadolibre.com.ar/authorization");
  meliAuthUrl.searchParams.set("response_type", "code");
  meliAuthUrl.searchParams.set("client_id", clientId);
  meliAuthUrl.searchParams.set("redirect_uri", redirectUri);
  meliAuthUrl.searchParams.set("code_challenge", challenge);
  meliAuthUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(meliAuthUrl.toString());
}
