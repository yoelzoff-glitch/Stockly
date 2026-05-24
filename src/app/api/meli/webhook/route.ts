import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/inngest/client";

import * as Sentry from "@sentry/nextjs";

export async function POST(req: NextRequest) {
  try {
    // Basic origin/header validation
    const userAgent = req.headers.get("user-agent") || "";
    const signature = req.headers.get("x-signature") || req.headers.get("x-meli-signature");

    if (process.env.NODE_ENV === "production" && !userAgent.toLowerCase().includes("mercadolibre")) {
      return new NextResponse("Unauthorized Origin", { status: 401 });
    }

    const payload = await req.json();

    // Estructura payload
    if (typeof payload !== "object" || payload === null) {
      return new NextResponse("Invalid Payload", { status: 400 });
    }

    const topic = payload.topic || payload.type;
    const resource = payload.resource;
    const userId = payload.user_id;

    if (!topic || !resource || !userId) {
      return NextResponse.json({ status: "ignored", reason: "missing_fields" }, { status: 200 });
    }

    const supabase = createAdminClient();

    // Find the tenant for this user_id
    const { data: account } = await supabase
      .from("meli_accounts")
      .select("tenant_id")
      .eq("meli_user_id", userId)
      .single();

    if (!account) {
      return NextResponse.json({ status: "ignored", reason: "unknown_user" }, { status: 200 });
    }

    const tenantId = account.tenant_id;

    // Depending on the topic, we dispatch an inngest event or handle it directly
    switch (topic) {
      case "orders_v2":
      case "orders":
        await inngest.send({
          name: "meli/orders.updated",
          data: { tenantId, resource }
        });
        break;

      case "items":
        await inngest.send({
          name: "meli/items.updated",
          data: { tenantId, resource }
        });
        break;

      case "questions":
        await inngest.send({
          name: "meli/questions.received",
          data: { tenantId, resource }
        });
        break;

      default:
        console.log(`Unhandled topic: ${topic}`);
    }

    // Save in audit logs (as requested previously, kept to not break logic)
    await supabase.from("ai_actions").insert({
      tenant_id: tenantId,
      action_type: `webhook_${topic}`,
      title: `Webhook recibido: ${topic}`,
      description: `Notificación para el recurso ${resource}`,
      status: "completed",
      payload: payload,
      executed_at: new Date().toISOString()
    });

    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error) {
    Sentry.captureException(error, { extra: { context: "MELI_WEBHOOK" } });
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
