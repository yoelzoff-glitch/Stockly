import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logger } from "@/lib/errors/logger";

export async function DELETE() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantId = profile.tenant_id;
    const adminSupabase = createAdminClient();

    // Delete all web messages for this tenant (mapped to whatsapp but with null from_phone)
    const { error } = await adminSupabase
      .from("messages")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("channel", "whatsapp")
      .is("from_phone", null);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error(error, "AI_CHAT_CLEAR");
    return NextResponse.json(
      { error: "Error eliminando el historial" }, 
      { status: 500 }
    );
  }
}
