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
      const externalReference = subscription.external_reference || "";
      const [refType, ...refIdParts] = externalReference.split("_");
      const refId = refIdParts.join("_"); // En caso de que el UUID tenga guiones bajos, aunque no deberia.
      
      // MP Statuses: authorized, paused, cancelled
      const status = subscription.status; 
      const plan = subscription.reason === 'Stockly Ultra' ? 'ultra' : 'pro';

      if (refType && refId) {
        const supabase = createAdminClient();
        
        if (refType === 'user') {
          // 1. Update User Metadata
          await supabase.auth.admin.updateUserById(refId, {
            user_metadata: { 
              payment_status: status === 'authorized' ? 'paid' : 'canceled',
              mp_sub_id: subscription.id 
            }
          });

          // 2. Check if they already have a tenant (for renewals/re-subscriptions later)
          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', refId).single();
          
          if (profile?.tenant_id) {
            await supabase.from("subscriptions").upsert({
              tenant_id: profile.tenant_id,
              plan: status === 'authorized' ? plan : 'starter',
              status: status === 'authorized' ? 'active' : 'canceled',
              mercadopago_subscription_id: subscription.id,
            });

            await supabase.from("tenants").update({
              plan: status === 'authorized' ? plan : 'starter',
            }).eq("id", profile.tenant_id);
          }

          logger.info(`Updated payment status for user ${refId} to ${status} (${plan})`, "MERCADOPAGO_WEBHOOK");
        } else if (refType === 'tenant') {
          // Direct tenant upgrade (from dashboard)
          await supabase.from("subscriptions").upsert({
            tenant_id: refId,
            plan: status === 'authorized' ? plan : 'starter',
            status: status === 'authorized' ? 'active' : 'canceled',
            mercadopago_subscription_id: subscription.id,
          });

          await supabase.from("tenants").update({
            plan: status === 'authorized' ? plan : 'starter',
          }).eq("id", refId);

          logger.info(`Updated subscription for tenant ${refId} to ${status} (${plan})`, "MERCADOPAGO_WEBHOOK");
        }
      }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MERCADOPAGO_WEBHOOK" } });
    logger.error(`Webhook error: ${error.message}`, "MERCADOPAGO_WEBHOOK");
    return new NextResponse("Error", { status: 500 });
  }
}
