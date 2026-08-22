import { NextResponse } from 'next/server';
import { getSubscription, updateSubscriptionAmount } from '@/integrations/mercadopago/client';
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
      const reason = subscription.reason || "";
      const externalReference = subscription.external_reference || "";
      const [refType, ...refIdParts] = externalReference.split("_");
      const refId = refIdParts.join("_"); // En caso de que el UUID tenga guiones bajos, aunque no deberia.
      
      // MP Statuses: authorized, paused, cancelled
      const status = subscription.status; 
      const plan = reason.toLowerCase().includes("ultra")
        ? "ultra"
        : (reason.toLowerCase().includes("pro") ? "pro" : "starter");

      if (refType && refId) {
        const supabase = createAdminClient();
        
        let targetPlan = plan;
        let isExpired = false;

        // Check current subscription in DB to see if expires_at is valid
        const dbTable = refType === 'user' ? 'profiles' : 'tenants';
        let tenantId = refType === 'user' ? null : refId;
        
        if (refType === 'user') {
          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', refId).single();
          tenantId = profile?.tenant_id;
        }

        let currentSub = null;
        if (tenantId) {
          const { data } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).single();
          currentSub = data;
        }

        if (status === 'authorized') {
          targetPlan = plan;
        } else if (status === 'cancelled' || status === 'canceled') {
          // Si está cancelado, revisamos si tiene un periodo pagado que todavía no expiró
          if (currentSub?.expires_at && new Date(currentSub.expires_at) > new Date()) {
            targetPlan = currentSub.plan; // Mantenemos el plan actual hasta que expire
          } else {
            targetPlan = 'starter';
            isExpired = true;
          }
        }

        if (refType === 'user') {
          // 1. Update User Metadata
          await supabase.auth.admin.updateUserById(refId, {
            user_metadata: { 
              payment_status: status === 'authorized' ? 'paid' : 'canceled',
              mp_sub_id: subscription.id 
            }
          });

          // Calculate expires_at for paid plans
          let expiresAt = currentSub?.expires_at || null;
          if (status === 'authorized') {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            expiresAt = expirationDate.toISOString();
          } else if (isExpired) {
            expiresAt = null;
          }

          if (tenantId) {
            await supabase.from("subscriptions").upsert({
              tenant_id: tenantId,
              plan: targetPlan,
              status: status === 'authorized' ? 'active' : 'canceled',
              mercadopago_subscription_id: subscription.id,
              expires_at: expiresAt,
            });

            await supabase.from("tenants").update({
              plan: targetPlan,
            }).eq("id", tenantId);
          }

          logger.info(`Updated payment status for user ${refId} to ${status} (${targetPlan})`, "MERCADOPAGO_WEBHOOK");
        } else if (refType === 'tenant') {
          // Calculate expires_at for paid plans
          let expiresAt = currentSub?.expires_at || null;
          if (status === 'authorized') {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            expiresAt = expirationDate.toISOString();
          } else if (isExpired) {
            expiresAt = null;
          }

          // Direct tenant upgrade (from dashboard)
          await supabase.from("subscriptions").upsert({
            tenant_id: refId,
            plan: targetPlan,
            status: status === 'authorized' ? 'active' : 'canceled',
            mercadopago_subscription_id: subscription.id,
            expires_at: expiresAt,
          });

          await supabase.from("tenants").update({
            plan: targetPlan,
          }).eq("id", refId);

          logger.info(`Updated subscription for tenant ${refId} to ${status} (${targetPlan})`, "MERCADOPAGO_WEBHOOK");
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
