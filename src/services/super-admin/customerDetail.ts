import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantActivityStatus } from "./activity";

export interface CustomerDetailData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    isDemo: boolean;
  };
  owner: {
    id: string;
    email: string;
    fullName: string;
  } | null;
  meliAccounts: {
    id: string;
    meliUserId: string;
    nickname: string | null;
    status: string;
    updatedAt: string;
  }[];
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    status: string;
    monthlyPriceSnapshot: number;
    billingInterval: string;
    startedAt: string | null;
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt: string | null;
    cancellationReason: string | null;
    cancellationComment: string | null;
  } | null;
  activity: {
    lastUserActivityAt: string | null;
    lastSyncAt: string | null;
    health: string;
    daysSinceLastActivity: number | null;
    activeUsersCount: number;
  };
  usage30d: {
    dashboardViews: number;
    profitabilityViews: number;
    adsViews: number;
    exports: number;
    syncs: number;
    totalEvents: number;
  };
  revenue: {
    historicalRevenue: number;
    last30dRevenue: number;
    currentMrr: number;
    paymentCount: number;
    transactions: {
      id: string;
      type: string;
      status: string;
      amount: number;
      currency: string;
      provider: string | null;
      paidAt: string | null;
      createdAt: string;
    }[];
  };
  timeline: {
    id: string;
    eventType: string;
    metadata: Record<string, any>;
    createdAt: string;
  }[];
  availablePlans: {
    id: string;
    code: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
  }[];
}

export async function getCustomerDetail(tenantId: string): Promise<CustomerDetailData | null> {
  const adminDb = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Parallel batch query
  const [
    { data: tenant },
    { data: profiles },
    { data: meliAccounts },
    { data: sub },
    { data: plans },
    { data: activityEvents30d },
    { data: transactions },
    { data: events },
  ] = await Promise.all([
    adminDb.from("tenants").select("id, name, slug, created_at, is_demo").eq("id", tenantId).single(),
    adminDb.from("profiles").select("id, email, full_name, role").eq("tenant_id", tenantId),
    adminDb.from("meli_accounts").select("id, meli_user_id, nickname, status, updated_at").eq("tenant_id", tenantId),
    adminDb.from("subscriptions").select("*, plans(name)").eq("tenant_id", tenantId).maybeSingle(),
    adminDb.from("plans").select("id, code, name, price_monthly, price_yearly").eq("is_active", true),
    adminDb.from("platform_activity_events").select("event_name, created_at").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
    adminDb.from("billing_transactions").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    adminDb.from("subscription_events").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(50),
  ]);

  if (!tenant) return null;

  // Owner profile
  const ownerProfile = (profiles || []).find((p) => p.role === "owner") || profiles?.[0] || null;

  // Subscription
  let subscriptionData = null;
  if (sub) {
    const planName = (sub.plans as any)?.name || sub.plan?.toUpperCase() || "PLAN";
    subscriptionData = {
      id: sub.id,
      planCode: sub.plan,
      planName,
      status: sub.status,
      monthlyPriceSnapshot: Number(sub.monthly_price_snapshot || 0),
      billingInterval: sub.billing_interval || "monthly",
      startedAt: sub.started_at,
      trialStartedAt: sub.trial_started_at,
      trialEndsAt: sub.trial_ends_at,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      cancelledAt: sub.cancelled_at,
      cancellationReason: sub.cancellation_reason,
      cancellationComment: sub.cancellation_comment,
    };
  }

  // Activity
  const activityStatus = await getTenantActivityStatus(tenantId);

  // Usage 30d
  let dashboardViews = 0;
  let profitabilityViews = 0;
  let adsViews = 0;
  let exports = 0;
  let syncs = 0;

  if (activityEvents30d) {
    for (const e of activityEvents30d) {
      if (e.event_name === "dashboard_viewed") dashboardViews++;
      else if (e.event_name === "profitability_viewed") profitabilityViews++;
      else if (e.event_name === "ads_viewed") adsViews++;
      else if (e.event_name === "report_exported") exports++;
      else if (e.event_name === "sync_started") syncs++;
    }
  }

  // Revenue calculations
  const allTx = transactions || [];
  let historicalRevenue = 0;
  let last30dRevenue = 0;
  let paymentCount = 0;

  for (const tx of allTx) {
    if (tx.status === "approved" && tx.type === "payment") {
      const amt = Number(tx.amount || 0);
      historicalRevenue += amt;
      paymentCount++;
      if (tx.paid_at && tx.paid_at >= thirtyDaysAgo) {
        last30dRevenue += amt;
      }
    }
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.created_at,
      isDemo: !!tenant.is_demo,
    },
    owner: ownerProfile
      ? {
          id: ownerProfile.id,
          email: ownerProfile.email || "",
          fullName: ownerProfile.full_name || "",
        }
      : null,
    meliAccounts: (meliAccounts || []).map((m) => ({
      id: m.id,
      meliUserId: m.meli_user_id,
      nickname: m.nickname,
      status: m.status,
      updatedAt: m.updated_at,
    })),
    subscription: subscriptionData,
    activity: {
      lastUserActivityAt: activityStatus.lastUserActivityAt,
      lastSyncAt: activityStatus.lastSyncAt,
      health: activityStatus.health,
      daysSinceLastActivity: activityStatus.daysSinceLastActivity,
      activeUsersCount: profiles?.length || 1,
    },
    usage30d: {
      dashboardViews,
      profitabilityViews,
      adsViews,
      exports,
      syncs,
      totalEvents: activityEvents30d?.length || 0,
    },
    revenue: {
      historicalRevenue,
      last30dRevenue,
      currentMrr:
        subscriptionData?.status === "active" ? subscriptionData.monthlyPriceSnapshot : 0,
      paymentCount,
      transactions: allTx.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amount: Number(t.amount || 0),
        currency: t.currency,
        provider: t.provider,
        paidAt: t.paid_at,
        createdAt: t.created_at,
      })),
    },
    timeline: (events || []).map((ev) => ({
      id: ev.id,
      eventType: ev.event_type,
      metadata: ev.metadata || {},
      createdAt: ev.created_at,
    })),
    availablePlans: (plans || []).map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      priceMonthly: Number(p.price_monthly || 0),
      priceYearly: Number(p.price_yearly || 0),
    })),
  };
}
