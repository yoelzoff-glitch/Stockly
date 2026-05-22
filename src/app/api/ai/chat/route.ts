import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { runBusinessAgent } from "@/services/ai/agent";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const supabase = await createClient();
    
    // 1. Validate auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get tenant_id
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

    // 3. Save inbound message
    await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      channel: "web",
      direction: "inbound",
      text: message,
      raw_payload: {},
      created_at: new Date().toISOString(),
    });

    // 4. Run the AI Agent
    const aiResponse = await runBusinessAgent({
      tenantId,
      userMessage: message,
    });

    // 5. Save outbound message
    await adminSupabase.from("messages").insert({
      tenant_id: tenantId,
      channel: "web",
      direction: "outbound",
      text: aiResponse,
      raw_payload: {},
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ response: aiResponse });
  } catch (error: any) {
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      logger.error(new AppError("OPENAI_QUOTA_EXCEEDED", "Sin saldo en OpenAI", 429, error.message), "AI_CHAT");
      return NextResponse.json(
        { error: "Nos hemos quedado sin saldo en el servicio de Inteligencia Artificial. Por favor, recarga tu cuenta de OpenAI." }, 
        { status: 429 }
      );
    }
    
    logger.error(error, "AI_CHAT");
    return NextResponse.json(
      { error: error.message || "Error interno procesando el chat." }, 
      { status: 500 }
    );
  }
}
