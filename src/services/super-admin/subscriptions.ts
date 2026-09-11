import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logPlatformAdminAction } from "./audit";
import { logger } from "@/lib/errors/logger";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "paused";

export type CancellationReason =
  | "too_expensive"
  | "missing_feature"
  | "not_using"
  | "technical_problems"
  | "switched_product"
  | "business_closed"
  | "other";

export interface ManageSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
}

/**
 * Assigns or initializes a plan for a tenant.
 */
export async function assignPlan(
  actorUserId: string,
  tenantId: string,
  planId: string,
  billingInterval: "monthly" | "yearly" = "monthly",
  isTrial: boolean = false,
  trialDays: number = 14
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  // Get plan details
  const { data: plan, error: planErr } = await adminDb
    .from("plans")
    .select("id, code, name, price_monthly, price_yearly")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    return { success: false, error: "Plan not found." };
  }

  const now = new Date();
  const priceSnapshot =
    billingInterval === "yearly" ? plan.price_yearly : plan.price_monthly;

  const trialStartedAt = isTrial ? now.toISOString() : null;
  const trialEndsAt = isTrial
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = isTrial
    ? trialEndsAt
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const initialStatus: SubscriptionStatus = isTrial ? "trialing" : "active";

  // Check if tenant already has an active or existing subscription
  const { data: existingSub } = await adminDb
    .from("subscriptions")
    .select("id, status, plan_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let subscriptionId = existingSub?.id;

  if (existingSub) {
    const { error: updateErr } = await adminDb
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        plan: plan.code,
        status: initialStatus,
        started_at: now.toISOString(),
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        cancelled_at: null,
        ended_at: null,
        billing_interval: billingInterval,
        monthly_price_snapshot: priceSnapshot,
        updated_at: now.toISOString(),
      })
      .eq("id", existingSub.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
  } else {
    const { data: newSub, error: insertErr } = await adminDb
      .from("subscriptions")
      .insert({
        tenant_id: tenantId,
        plan_id: plan.id,
        plan: plan.code,
        status: initialStatus,
        started_at: now.toISOString(),
        trial_started_at: trialStartedAt,
        trial_ends_at: trialEndsAt,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        billing_interval: billingInterval,
        monthly_price_snapshot: priceSnapshot,
      })
      .select("id")
      .single();

    if (insertErr || !newSub) {
      return { success: false, error: insertErr?.message || "Failed to create subscription." };
    }
    subscriptionId = newSub.id;
  }

  // Record subscription event
  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: subscriptionId,
    event_type: isTrial ? "trial_started" : "subscription_started",
    metadata: {
      plan_code: plan.code,
      plan_id: plan.id,
      billing_interval: billingInterval,
      monthly_price: priceSnapshot,
      is_trial: isTrial,
      trial_days: trialDays,
    },
  });

  // Audit log
  await logPlatformAdminAction({
    actorUserId,
    action: isTrial ? "trial_started" : "subscription_activated",
    targetTenantId: tenantId,
    targetSubscriptionId: subscriptionId,
    metadata: { plan_code: plan.code, plan_name: plan.name, is_trial: isTrial },
  });

  return { success: true, subscriptionId };
}

/**
 * Changes plan (upgrade or downgrade).
 */
export async function changePlan(
  actorUserId: string,
  tenantId: string,
  newPlanId: string
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, plan_id, plan, monthly_price_snapshot, billing_interval")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found for tenant." };
  }

  const { data: newPlan, error: planErr } = await adminDb
    .from("plans")
    .select("id, code, name, price_monthly, price_yearly")
    .eq("id", newPlanId)
    .single();

  if (planErr || !newPlan) {
    return { success: false, error: "New plan not found." };
  }

  const oldPrice = Number(sub.monthly_price_snapshot || 0);
  const newPrice =
    sub.billing_interval === "yearly" ? newPlan.price_yearly : newPlan.price_monthly;
  const isUpgrade = newPrice >= oldPrice;
  const eventType = isUpgrade ? "plan_upgraded" : "plan_downgraded";

  const { error: updateErr } = await adminDb
    .from("subscriptions")
    .update({
      plan_id: newPlan.id,
      plan: newPlan.code,
      monthly_price_snapshot: newPrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Record subscription event
  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: sub.id,
    event_type: eventType,
    metadata: {
      old_plan: sub.plan,
      new_plan: newPlan.code,
      old_price: oldPrice,
      new_price: newPrice,
    },
  });

  // Audit log
  await logPlatformAdminAction({
    actorUserId,
    action: "plan_changed",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
    metadata: {
      old_plan: sub.plan,
      new_plan: newPlan.code,
      eventType,
    },
  });

  return { success: true, subscriptionId: sub.id };
}

/**
 * Extends trial by N additional days.
 */
export async function extendTrial(
  actorUserId: string,
  tenantId: string,
  additionalDays: number
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, status, trial_ends_at, current_period_end")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found." };
  }

  const baseDate = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
  const newTrialEnd = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

  const { error: updateErr } = await adminDb
    .from("subscriptions")
    .update({
      status: "trialing",
      trial_ends_at: newTrialEnd.toISOString(),
      current_period_end: newTrialEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: sub.id,
    event_type: "trial_extended",
    metadata: {
      additional_days: additionalDays,
      new_trial_ends_at: newTrialEnd.toISOString(),
    },
  });

  await logPlatformAdminAction({
    actorUserId,
    action: "trial_extended",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
    metadata: { additionalDays, newTrialEndsAt: newTrialEnd.toISOString() },
  });

  return { success: true, subscriptionId: sub.id };
}

/**
 * Activates subscription.
 */
export async function activateSubscription(
  actorUserId: string,
  tenantId: string
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found." };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: updateErr } = await adminDb
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      cancelled_at: null,
      ended_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", sub.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: sub.id,
    event_type: "subscription_started",
    metadata: { activated_at: now.toISOString() },
  });

  await logPlatformAdminAction({
    actorUserId,
    action: "subscription_activated",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
  });

  return { success: true, subscriptionId: sub.id };
}

/**
 * Pauses an active subscription.
 */
export async function pauseSubscription(
  actorUserId: string,
  tenantId: string
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found." };
  }

  const { error: updateErr } = await adminDb
    .from("subscriptions")
    .update({
      status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: sub.id,
    event_type: "subscription_paused",
    metadata: { paused_at: new Date().toISOString() },
  });

  await logPlatformAdminAction({
    actorUserId,
    action: "subscription_paused",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
  });

  return { success: true, subscriptionId: sub.id };
}

/**
 * Reactivates a paused, expired, or cancelled subscription.
 */
export async function reactivateSubscription(
  actorUserId: string,
  tenantId: string
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found." };
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: updateErr } = await adminDb
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      cancelled_at: null,
      ended_at: null,
      updated_at: now.toISOString(),
    })
    .eq("id", sub.id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  await adminDb.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: sub.id,
    event_type: "subscription_reactivated",
    metadata: { reactivated_at: now.toISOString() },
  });

  await logPlatformAdminAction({
    actorUserId,
    action: "subscription_reactivated",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
  });

  return { success: true, subscriptionId: sub.id };
}

/**
 * Cancels a subscription immediately or at period end.
 */
export async function cancelSubscription(
  actorUserId: string,
  tenantId: string,
  reason: CancellationReason = "other",
  comment?: string,
  immediate: boolean = false
): Promise<ManageSubscriptionResult> {
  const adminDb = createAdminClient();

  const { data: sub, error: subErr } = await adminDb
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("tenant_id", tenantId)
    .single();

  if (subErr || !sub) {
    return { success: false, error: "Subscription not found." };
  }

  const now = new Date();

  if (immediate) {
    const { error: updateErr } = await adminDb
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancel_at_period_end: false,
        cancelled_at: now.toISOString(),
        ended_at: now.toISOString(),
        cancellation_reason: reason,
        cancellation_comment: comment || null,
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await adminDb.from("subscription_events").insert({
      tenant_id: tenantId,
      subscription_id: sub.id,
      event_type: "subscription_cancelled",
      metadata: { reason, comment, immediate: true, cancelled_at: now.toISOString() },
    });
  } else {
    const { error: updateErr } = await adminDb
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancellation_reason: reason,
        cancellation_comment: comment || null,
        updated_at: now.toISOString(),
      })
      .eq("id", sub.id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    await adminDb.from("subscription_events").insert({
      tenant_id: tenantId,
      subscription_id: sub.id,
      event_type: "cancellation_requested",
      metadata: {
        reason,
        comment,
        effective_date: sub.current_period_end,
      },
    });
  }

  await logPlatformAdminAction({
    actorUserId,
    action: "subscription_cancelled",
    targetTenantId: tenantId,
    targetSubscriptionId: sub.id,
    metadata: { reason, comment, immediate },
  });

  return { success: true, subscriptionId: sub.id };
}
