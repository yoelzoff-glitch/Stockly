import { NextResponse } from 'next/server';
import { getSubscription, updateSubscriptionAmount } from '@/integrations/mercadopago/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/errors/logger';
import { getOrCreateCorrelationId, CORRELATION_ID_HEADER } from '@/lib/observability/correlationId';
import { startOperationRun, completeOperationRun } from '@/lib/observability/operationRuns';

import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  const correlationId = getOrCreateCorrelationId(req);

  try {
    const url = new URL(req.url);

    // Seguridad: Validar secreto de webhook de Mercado Pago
    const secret = url.searchParams.get("secret");
    if (process.env.MERCADOPAGO_WEBHOOK_SECRET && secret !== process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      logger.warn({
        event: "MP_WEBHOOK_UNAUTHORIZED",
        correlationId,
        message: "Invalid or missing Mercado Pago webhook secret",
      });
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { [CORRELATION_ID_HEADER]: correlationId },
      });
    }

    const id = url.searchParams.get("id") || url.searchParams.get("data.id");
    const type = url.searchParams.get("type");

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body might be empty
    }

    const topic = body.type || body.action || type;
    const resourceId = body.data?.id || id;

    // Track operation run asynchronously without delaying webhook response
    startOperationRun({
      operationType: `mp_webhook_${topic || 'unknown'}`,
      source: "mercadopago_webhook",
      correlationId,
      metadata: { topic, resourceId },
    }).then((runId) => {
      if (runId) completeOperationRun(runId, { itemsProcessed: 1 });
    }).catch(() => {});

    logger.info({
      event: "MP_WEBHOOK_RECEIVED",
      correlationId,
      topic,
      resourceId,
    });

    if (topic === "subscription_preapproval" && resourceId) {
      const subscription = await getSubscription(resourceId);
      const reason = subscription.reason || "";
      const externalReference = subscription.external_reference || "";
      const [refType, ...refIdParts] = externalReference.split("_");
      const refId = refIdParts.join("_");
      
      const status = subscription.status; 
      const plan = reason.toLowerCase().includes("ultra")
        ? "ultra"
        : (reason.toLowerCase().includes("pro") ? "pro" : "starter");

      if (refType && refId) {
        const supabase = createAdminClient();
        
        let targetPlan = plan;
        let isExpired = false;

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
          if (currentSub?.expires_at && new Date(currentSub.expires_at) > new Date()) {
            targetPlan = currentSub.plan;
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

          logger.info({
            event: "MP_USER_PAYMENT_STATUS_UPDATED",
            tenantId: tenantId || undefined,
            correlationId,
            userId: refId,
            status,
            targetPlan,
          });
        } else if (refType === 'tenant') {
          let expiresAt = currentSub?.expires_at || null;
          if (status === 'authorized') {
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            expiresAt = expirationDate.toISOString();
          } else if (isExpired) {
            expiresAt = null;
          }

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

          logger.info({
            event: "MP_TENANT_SUBSCRIPTION_UPDATED",
            tenantId: refId,
            correlationId,
            status,
            targetPlan,
          });
        }
      }
    }

    return new NextResponse("OK", {
      status: 200,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "MERCADOPAGO_WEBHOOK", correlationId } });
    logger.error({
      event: "MP_WEBHOOK_PROCESSING_FAILED",
      correlationId,
      error,
      message: error?.message,
    });
    return new NextResponse("Error", {
      status: 500,
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
  }
}
