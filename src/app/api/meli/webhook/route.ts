import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "../../../inngest/client";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Mercado Libre sometimes sends a validation payload with "resource": "/users/xyz"
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
        // Emit an event to sync orders for this tenant
        await inngest.send({
          name: "meli/orders.updated",
          data: { tenantId, resource }
        });
        break;

      case "items":
        // Emit an event to sync products
        await inngest.send({
          name: "meli/items.updated",
          data: { tenantId, resource }
        });
        break;

      case "questions":
        // Process question and optionally auto-respond
        await inngest.send({
          name: "meli/questions.received",
          data: { tenantId, resource }
        });
        break;

      default:
        console.log(`Unhandled topic: ${topic}`);
    }

    // Save in audit logs
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
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
