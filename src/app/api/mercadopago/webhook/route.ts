import { NextResponse } from 'next/server';
import { getSubscription } from '@/integrations/mercadopago/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/errors/logger';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
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
      const plan = subscription.reason === 'Stockly Business' ? 'business' : 'pro';

      if (tenantId) {
        const supabase = createAdminClient();
        
        await supabase.from("subscriptions").upsert({
          tenant_id: tenantId,
          plan: status === 'authorized' ? plan : 'starter',
          status: status === 'authorized' ? 'active' : 'canceled',
          mercadopago_subscription_id: subscription.id,
        });

        logger.info(`Updated subscription for tenant ${tenantId} to ${status} (${plan})`, "MERCADOPAGO_WEBHOOK");
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    logger.error(`Webhook error: ${error.message}`, "MERCADOPAGO_WEBHOOK");
    return new NextResponse("Error", { status: 500 });
  }
}
