import { NextResponse } from 'next/server';
import { logger } from '@/lib/errors/logger';
import { cancelPendingAction } from '@/services/ai/actions/confirm';

export async function POST(req: Request) {
  try {
    const { action_id, tenant_id } = await req.json();
    if (!action_id || !tenant_id) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const res = await cancelPendingAction(tenant_id, action_id);
    if (!res.success) {
      return NextResponse.json({ error: "Action not found or could not be cancelled" }, { status: 404 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    logger.error("Error in cancel action route", "AI_ACTIONS");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
