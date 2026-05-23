import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabaseServer = await createClient();
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

  if (!profile || !profile.tenant_id) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // MÓDULO 5: Update status to disconnected instead of deleting the row (prevents cascade deletion)
  const { error } = await supabase
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
    console.error("Error disconnecting Mercado Libre:", error);
    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }

  // Create Audit Log
  await supabase.from("audit_logs").insert({
    tenant_id: profile.tenant_id,
    action: "meli_disconnected",
    resource_type: "meli_account",
    details: { message: "Conexión desconectada manualmente por el usuario conservando los datos históricos." }
  });

  return NextResponse.json({ success: true });
} catch (error: any) {
  console.error("Disconnect error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
}
