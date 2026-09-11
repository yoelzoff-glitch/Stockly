import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export interface BackfillPaymentParams {
  tenantId: string;
  subscriptionId?: string | null;
  amount: number;
  currency?: string;
  paidAt: string | Date;
  periodStart?: string | Date | null;
  periodEnd?: string | Date | null;
  provider?: string;
  providerPaymentId?: string;
}

export interface BackfillResult {
  success: boolean;
  inserted: boolean;
  transactionId?: string;
  message: string;
}

/**
 * Idempotently backfills a historical approved billing transaction.
 * Checks for duplicate based on providerPaymentId or (tenantId + periodStart + amount).
 */
export async function backfillBillingPayment({
  tenantId,
  subscriptionId,
  amount,
  currency = "ARS",
  paidAt,
  periodStart,
  periodEnd,
  provider = "mercadopago",
  providerPaymentId,
}: BackfillPaymentParams): Promise<BackfillResult> {
  const adminDb = createAdminClient();
  const paidAtIso = new Date(paidAt).toISOString();
  const periodStartIso = periodStart ? new Date(periodStart).toISOString() : null;
  const periodEndIso = periodEnd ? new Date(periodEnd).toISOString() : null;

  try {
    // 1. Check if transaction with this providerPaymentId already exists
    if (providerPaymentId) {
      const { data: existing } = await adminDb
        .from("billing_transactions")
        .select("id")
        .eq("provider_payment_id", providerPaymentId)
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          inserted: false,
          transactionId: existing.id,
          message: "Transaction already exists with this providerPaymentId.",
        };
      }
    }

    // 2. Check by tenantId + periodStart + amount
    if (periodStartIso) {
      const { data: duplicate } = await adminDb
        .from("billing_transactions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("period_start", periodStartIso)
        .eq("amount", amount)
        .maybeSingle();

      if (duplicate) {
        return {
          success: true,
          inserted: false,
          transactionId: duplicate.id,
          message: "Transaction already exists for this tenant, period, and amount.",
        };
      }
    }

    // 3. Insert approved payment
    const { data: inserted, error } = await adminDb
      .from("billing_transactions")
      .insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId || null,
        type: "payment",
        status: "approved",
        amount,
        currency,
        provider,
        provider_payment_id: providerPaymentId || null,
        period_start: periodStartIso,
        period_end: periodEndIso,
        paid_at: paidAtIso,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      logger.error({
        event: "backfill_billing_payment_failed",
        tenantId,
        error: error?.message,
      });
      return {
        success: false,
        inserted: false,
        message: error?.message || "Failed to insert transaction.",
      };
    }

    return {
      success: true,
      inserted: true,
      transactionId: inserted.id,
      message: "Historical payment transaction backfilled successfully.",
    };
  } catch (err: any) {
    logger.error({
      event: "backfill_billing_payment_exception",
      tenantId,
      error: err?.message,
    });
    return {
      success: false,
      inserted: false,
      message: err?.message || "Exception during backfill.",
    };
  }
}
