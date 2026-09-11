import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { calculateActivityHealth, ActivityHealth } from "./activity";

export interface OverviewMetrics {
  activeCustomers: number;
  trialingCustomers: number;
  cancelledCustomersMonth: number;
  inactiveCustomers: number;
  activeSubscriptions: number;
  mrr: number;
  monthRevenue: number;
  newCustomersMonth: number;
  cancellationsMonth: number;
  planDistribution: {
    planCode: string;
    planName: string;
    customerCount: number;
    mrr: number;
  }[];
  activityDistribution: {
    active7d: number;
    inactive7dPlus: number;
    atRisk: number;
  };
  attentionItems: AttentionItem[];
}

export interface AttentionItem {
  id: string;
  tenantId: string;
  tenantName: string;
  type: "trial_expiring" | "sub_expiring" | "inactive" | "past_due" | "cancellation_pending";
  title: string;
  detail: string;
  badge: string;
  dueDate?: string;
  daysRemaining?: number;
}

export interface CustomerListItem {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  planCode: string;
  planName: string;
  status: string;
  userCount: number;
  lastActivityAt: string | null;
  activityHealth: ActivityHealth;
  createdAt: string;
  currentPeriodEnd: string | null;
  mrr: number;
  isDemo: boolean;
}

export interface CustomerFilters {
  status?: string;
  plan?: string;
  search?: string;
}

export interface RevenueAnalytics {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  mrr: number;
  newMrr: number;
  lostMrr: number;
  arpu: number;
  monthlyHistory: {
    month: string;
    label: string;
    realRevenue: number;
    mrr: number;
  }[];
}

/**
 * Returns comprehensive Overview KPIs for the Super Admin dashboard without N+1 queries.
 */
export async function getSuperAdminOverview(): Promise<OverviewMetrics> {
  const adminDb = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // 1. Parallel batch queries
  const [
    { data: tenants },
    { data: subscriptions },
    { data: plans },
    { data: monthPayments },
    { data: recentActivities },
  ] = await Promise.all([
    adminDb.from("tenants").select("id, name, slug, created_at, status, is_demo").eq("is_demo", false),
    adminDb
      .from("subscriptions")
      .select("id, tenant_id, plan, plan_id, status, monthly_price_snapshot, trial_ends_at, current_period_end, cancel_at_period_end, cancelled_at, created_at"),
    adminDb.from("plans").select("id, code, name, price_monthly"),
    adminDb
      .from("billing_transactions")
      .select("amount, paid_at")
      .eq("status", "approved")
      .eq("type", "payment")
      .gte("paid_at", startOfMonth),
    adminDb
      .from("platform_activity_events")
      .select("tenant_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const allTenants = tenants || [];
  const allSubs = subscriptions || [];
  const allPlans = plans || [];
  const payments = monthPayments || [];

  // Map latest activity per tenant
  const latestActivityByTenant = new Map<string, string>();
  if (recentActivities) {
    for (const act of recentActivities) {
      if (!latestActivityByTenant.has(act.tenant_id)) {
        latestActivityByTenant.set(act.tenant_id, act.created_at);
      }
    }
  }

  // Active subscriptions map
  const activeSubsByTenant = new Map<string, any>();
  for (const s of allSubs) {
    if (s.status === "active" || s.status === "trialing" || s.status === "past_due") {
      activeSubsByTenant.set(s.tenant_id, s);
    }
  }

  // KPIs
  let activeCustomers = 0;
  let trialingCustomers = 0;
  let activeSubscriptions = 0;
  let mrr = 0;
  let active7d = 0;
  let inactive7dPlus = 0;
  let atRisk = 0;
  let inactiveCustomers = 0;

  for (const t of allTenants) {
    const sub = activeSubsByTenant.get(t.id);
    const lastAct = latestActivityByTenant.get(t.id) || null;
    const health = calculateActivityHealth(lastAct);

    if (health === "ACTIVE") active7d++;
    else if (health === "AT_RISK") {
      atRisk++;
      inactive7dPlus++;
    } else {
      inactive7dPlus++;
      inactiveCustomers++;
    }

    if (sub) {
      if (sub.status === "active") {
        activeCustomers++;
        activeSubscriptions++;
        mrr += Number(sub.monthly_price_snapshot || 0);
      } else if (sub.status === "trialing") {
        trialingCustomers++;
      }
    }
  }

  // Month revenue from approved payments
  const monthRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // New customers this month
  const newCustomersMonth = allTenants.filter((t) => t.created_at >= startOfMonth).length;

  // Cancellations this month
  const cancellationsMonth = allSubs.filter(
    (s) => s.cancelled_at && s.cancelled_at >= startOfMonth
  ).length;

  // Plan distribution
  const planMap = new Map<string, { name: string; count: number; mrr: number }>();
  for (const p of allPlans) {
    planMap.set(p.code, { name: p.name, count: 0, mrr: 0 });
  }

  for (const sub of allSubs) {
    if (sub.status === "active") {
      const pCode = sub.plan || "starter";
      const existing = planMap.get(pCode) || { name: pCode, count: 0, mrr: 0 };
      existing.count += 1;
      existing.mrr += Number(sub.monthly_price_snapshot || 0);
      planMap.set(pCode, existing);
    }
  }

  const planDistribution = Array.from(planMap.entries()).map(([code, data]) => ({
    planCode: code,
    planName: data.name,
    customerCount: data.count,
    mrr: data.mrr,
  }));

  // Attention items
  const attentionItems: AttentionItem[] = [];
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const tenantNameMap = new Map(allTenants.map((t) => [t.id, t.name]));

  for (const sub of allSubs) {
    const tName = tenantNameMap.get(sub.tenant_id) || "Cliente desconocido";

    // 1. Trial expiring in <= 7d
    if (sub.status === "trialing" && sub.trial_ends_at && sub.trial_ends_at <= sevenDaysFromNow) {
      const diffDays = Math.ceil(
        (new Date(sub.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      attentionItems.push({
        id: `trial_${sub.id}`,
        tenantId: sub.tenant_id,
        tenantName: tName,
        type: "trial_expiring",
        title: "Trial por vencer",
        detail: `Vence en ${diffDays <= 0 ? "hoy" : `${diffDays} días`}`,
        badge: "Trial",
        dueDate: sub.trial_ends_at,
        daysRemaining: diffDays,
      });
    }

    // 2. Active sub expiring in <= 7d
    if (
      sub.status === "active" &&
      sub.current_period_end &&
      sub.current_period_end <= sevenDaysFromNow
    ) {
      const diffDays = Math.ceil(
        (new Date(sub.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      attentionItems.push({
        id: `sub_${sub.id}`,
        tenantId: sub.tenant_id,
        tenantName: tName,
        type: "sub_expiring",
        title: "Suscripción por renovar",
        detail: `Vence en ${diffDays <= 0 ? "hoy" : `${diffDays} días`}`,
        badge: "Renovación",
        dueDate: sub.current_period_end,
        daysRemaining: diffDays,
      });
    }

    // 3. Past due
    if (sub.status === "past_due") {
      attentionItems.push({
        id: `past_due_${sub.id}`,
        tenantId: sub.tenant_id,
        tenantName: tName,
        type: "past_due",
        title: "Pago vencido (Past Due)",
        detail: "La suscripción se encuentra impaga",
        badge: "Alerta",
      });
    }

    // 4. Requested cancellation
    if (sub.cancel_at_period_end) {
      attentionItems.push({
        id: `cancel_${sub.id}`,
        tenantId: sub.tenant_id,
        tenantName: tName,
        type: "cancellation_pending",
        title: "Cancelación programada",
        detail: `Baja efectiva al fin del período: ${
          sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : ""
        }`,
        badge: "Baja",
      });
    }
  }

  // 5. Inactive >= 10 days
  for (const t of allTenants) {
    const lastAct = latestActivityByTenant.get(t.id);
    if (!lastAct || lastAct <= tenDaysAgo) {
      const days = lastAct
        ? Math.floor((now.getTime() - new Date(lastAct).getTime()) / (1000 * 60 * 60 * 24))
        : 30;
      attentionItems.push({
        id: `inact_${t.id}`,
        tenantId: t.id,
        tenantName: t.name,
        type: "inactive",
        title: "Sin actividad",
        detail: `${days}+ días sin uso de plataforma`,
        badge: "Riesgo",
      });
    }
  }

  return {
    activeCustomers,
    trialingCustomers,
    cancelledCustomersMonth: cancellationsMonth,
    inactiveCustomers,
    activeSubscriptions,
    mrr,
    monthRevenue,
    newCustomersMonth,
    cancellationsMonth,
    planDistribution,
    activityDistribution: {
      active7d,
      inactive7dPlus,
      atRisk,
    },
    attentionItems: attentionItems.slice(0, 15),
  };
}

/**
 * Returns customers list with filters and search without N+1 queries.
 */
export async function getCustomersList(filters: CustomerFilters = {}): Promise<CustomerListItem[]> {
  const adminDb = createAdminClient();

  // 1. Fetch tenants, subscriptions, profiles, and plans in single batch
  const [
    { data: tenants },
    { data: subscriptions },
    { data: profiles },
    { data: plans },
    { data: activities },
  ] = await Promise.all([
    adminDb.from("tenants").select("id, name, slug, created_at, status, is_demo").order("created_at", { ascending: false }),
    adminDb.from("subscriptions").select("id, tenant_id, plan, plan_id, status, monthly_price_snapshot, current_period_end"),
    adminDb.from("profiles").select("id, tenant_id, email, role"),
    adminDb.from("plans").select("id, code, name"),
    adminDb
      .from("platform_activity_events")
      .select("tenant_id, created_at")
      .order("created_at", { ascending: false })
      .limit(3000),
  ]);

  const allTenants = tenants || [];
  const subs = subscriptions || [];
  const profs = profiles || [];
  const plns = plans || [];

  // Group maps
  const subByTenant = new Map(subs.map((s) => [s.tenant_id, s]));
  const planByCode = new Map(plns.map((p) => [p.code, p.name]));
  const planById = new Map(plns.map((p) => [p.id, p.name]));

  // Count users and owner email per tenant
  const usersByTenant = new Map<string, number>();
  const ownerByTenant = new Map<string, string>();

  for (const pr of profs) {
    if (!pr.tenant_id) continue;
    usersByTenant.set(pr.tenant_id, (usersByTenant.get(pr.tenant_id) || 0) + 1);
    if (pr.role === "owner" || !ownerByTenant.has(pr.tenant_id)) {
      ownerByTenant.set(pr.tenant_id, pr.email || "");
    }
  }

  // Latest activity per tenant
  const latestActivity = new Map<string, string>();
  if (activities) {
    for (const a of activities) {
      if (!latestActivity.has(a.tenant_id)) {
        latestActivity.set(a.tenant_id, a.created_at);
      }
    }
  }

  // Assemble list
  const list: CustomerListItem[] = allTenants.map((t) => {
    const sub = subByTenant.get(t.id);
    const planCode = sub?.plan || "starter";
    const planName =
      (sub?.plan_id && planById.get(sub.plan_id)) ||
      planByCode.get(planCode) ||
      planCode.toUpperCase();
    const subStatus = sub?.status || t.status || "trialing";
    const lastAct = latestActivity.get(t.id) || null;
    const health = calculateActivityHealth(lastAct);

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      ownerEmail: ownerByTenant.get(t.id) || "",
      planCode,
      planName,
      status: subStatus,
      userCount: usersByTenant.get(t.id) || 1,
      lastActivityAt: lastAct,
      activityHealth: health,
      createdAt: t.created_at,
      currentPeriodEnd: sub?.current_period_end || null,
      mrr: subStatus === "active" ? Number(sub?.monthly_price_snapshot || 0) : 0,
      isDemo: !!t.is_demo,
    };
  });

  // Apply filters
  return list.filter((item) => {
    // Search query
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const matchName = item.name.toLowerCase().includes(q);
      const matchEmail = item.ownerEmail.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      const matchSlug = item.slug.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchId && !matchSlug) return false;
    }

    // Status filter
    if (filters.status && filters.status !== "all") {
      if (filters.status === "inactive") {
        if (item.activityHealth !== "INACTIVE" && item.activityHealth !== "DORMANT") return false;
      } else if (filters.status === "active") {
        if (item.status !== "active") return false;
      } else if (filters.status === "trial") {
        if (item.status !== "trialing") return false;
      } else if (filters.status === "past_due") {
        if (item.status !== "past_due") return false;
      } else if (filters.status === "cancelled") {
        if (item.status !== "cancelled") return false;
      } else if (item.status !== filters.status) {
        return false;
      }
    }

    // Plan filter
    if (filters.plan && filters.plan !== "all") {
      if (item.planCode !== filters.plan) return false;
    }

    return true;
  });
}

/**
 * Returns SaaS Revenue Analytics (MRR, New MRR, Churned MRR, ARPU, 12 Month Chart).
 */
export async function getRevenueAnalytics(): Promise<RevenueAnalytics> {
  const adminDb = createAdminClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

  const [
    { data: activeSubs },
    { data: currentPayments },
    { data: prevPayments },
    { data: newSubs },
    { data: cancelledSubs },
    { data: historicalPayments },
  ] = await Promise.all([
    adminDb.from("subscriptions").select("monthly_price_snapshot").eq("status", "active"),
    adminDb
      .from("billing_transactions")
      .select("amount")
      .eq("status", "approved")
      .eq("type", "payment")
      .gte("paid_at", startOfMonth),
    adminDb
      .from("billing_transactions")
      .select("amount")
      .eq("status", "approved")
      .eq("type", "payment")
      .gte("paid_at", startOfPrevMonth)
      .lte("paid_at", endOfPrevMonth),
    adminDb
      .from("subscriptions")
      .select("monthly_price_snapshot")
      .eq("status", "active")
      .gte("started_at", startOfMonth),
    adminDb
      .from("subscriptions")
      .select("monthly_price_snapshot")
      .eq("status", "cancelled")
      .gte("cancelled_at", startOfMonth),
    adminDb
      .from("billing_transactions")
      .select("amount, paid_at")
      .eq("status", "approved")
      .eq("type", "payment")
      .gte("paid_at", twelveMonthsAgo),
  ]);

  const active = activeSubs || [];
  const mrr = active.reduce((sum, s) => sum + Number(s.monthly_price_snapshot || 0), 0);
  const currentMonthRevenue = (currentPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const previousMonthRevenue = (prevPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const newMrr = (newSubs || []).reduce((sum, s) => sum + Number(s.monthly_price_snapshot || 0), 0);
  const lostMrr = (cancelledSubs || []).reduce((sum, s) => sum + Number(s.monthly_price_snapshot || 0), 0);
  const arpu = active.length > 0 ? Math.round(mrr / active.length) : 0;

  // Build 12-month array
  const monthlyMap = new Map<string, { label: string; realRevenue: number; mrr: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
    monthlyMap.set(key, { label, realRevenue: 0, mrr: 0 });
  }

  if (historicalPayments) {
    for (const p of historicalPayments) {
      if (!p.paid_at) continue;
      const d = new Date(p.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.realRevenue += Number(p.amount || 0);
      }
    }
  }

  // Set latest MRR for current months
  for (const [_, entry] of monthlyMap) {
    entry.mrr = mrr;
  }

  return {
    currentMonthRevenue,
    previousMonthRevenue,
    mrr,
    newMrr,
    lostMrr,
    arpu,
    monthlyHistory: Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      label: data.label,
      realRevenue: data.realRevenue,
      mrr: data.mrr,
    })),
  };
}
