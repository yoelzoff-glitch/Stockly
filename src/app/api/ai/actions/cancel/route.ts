import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/errors/logger';

export async function POST(req: Request) {
  try {
    const { action_id, tenant_id } = await req.json();
    if (!action_id || !tenant_id) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: action, error } = await supabase
      .from("ai_actions")
      .select("id")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending")
      .single();

    if (error || !action) {
      return NextResponse.json({ error: "Action not found or not pending" }, { status: 404 });
    }

    await supabase.from("ai_actions").update({
      status: "cancelled",
    }).eq("id", action.id);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    logger.error("Error in cancel action route", "AI_ACTIONS");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
