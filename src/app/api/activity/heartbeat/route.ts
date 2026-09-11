import "server-only";

import { NextResponse } from "next/server";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { recordHumanActivity, calculateActivityHealth } from "@/services/super-admin/activity";

export async function POST(req: Request) {
  try {
    const { tenantId, userId } = await requireTenantContext(req);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable for lightweight heartbeats
    }

    const eventName = body?.eventName || "heartbeat";
    const metadata = body?.metadata || {};

    await recordHumanActivity({
      tenantId,
      userId,
      eventName,
      metadata,
    });

    const healthResult = calculateActivityHealth(new Date());

    return NextResponse.json({
      success: true,
      health: healthResult.health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return toAuthErrorResponse(error);
  }
}
