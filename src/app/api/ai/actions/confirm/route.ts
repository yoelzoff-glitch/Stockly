import { NextResponse } from 'next/server';
import { logger } from '@/lib/errors/logger';
import { confirmPendingAction } from '@/services/ai/actions/confirm';

export async function POST(req: Request) {
  try {
    const { action_id, tenant_id } = await req.json();
    if (!action_id || !tenant_id) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const res = await confirmPendingAction(tenant_id, action_id);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, results: res.results });
  } catch (error: any) {
    logger.error("Error in confirm action route", "AI_ACTIONS");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
