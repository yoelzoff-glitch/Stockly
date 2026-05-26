import { NextResponse } from 'next/server';
import { getSubscription } from '@/integrations/mercadopago/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/errors/logger';

import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);

    // Seguridad: Validar secreto de webhook de Mercado Pago
    const secret = url.searchParams.get("secret");
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && secret !== process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const id = url.searchParams.get("id") || url.searchParams.get("data.id");
    const type = url.searchParams.get("type");

    let body: any = {};
    try {
      body = await req.json();
    } catch(e) {
      // Body might be empty
    }

    const topic = body.type || body.action || type;
    const resourceId = body.data?.id || id;

    if (topic === "subscription_preapproval" && resourceId) {
      const subscription = await getSubscription(resourceId);
      const tenantId = subscription.external_reference;
      
      // MP Statuses: authorized, paused, cancelled
      const status = subscription.status; 
      const plan = subscription.reason === 'Stockly Ultra' ? 'ultra' : 'pro';

      if (tenantId) {
        const supabase = createAdminClient();
        
        await supabase.from("subscriptions").upsert({
          tenant_id: tenantId,
          plan: status === 'authorized' ? plan : 'starter',
          status: status === 'authorized' ? 'active' : 'canceled',
          mercadopago_subscription_id: subscription.id,
        });

        // Actualizar el plan en la tabla tenants
        await supabase.from("tenants").update({
          plan: status === 'authorized' ? plan : 'starter',
        }).eq("id", tenantId);

        logger.info(`Updated subscription for tenant ${tenantId} to ${status} (${plan})`, "MERCADOPAGO_WEBHOOK");
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MERCADOPAGO_WEBHOOK" } });
    logger.error(`Webhook error: ${error.message}`, "MERCADOPAGO_WEBHOOK");
    return new NextResponse("Error", { status: 500 });
  }
}
