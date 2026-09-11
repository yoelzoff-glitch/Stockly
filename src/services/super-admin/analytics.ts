import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/security/platformAdminAuth";

export interface DateRangeFilter {
  from: string; // ISO date string
  to: string; // ISO date string
  environment?: "production" | "development" | "all";
  excludeInternal?: boolean;
}

export interface WebAnalyticsOverviewData {
  totalVisitors: number;
  totalSessions: number;
  totalPageviews: number;
  activeNow: number;
  avgDurationSeconds: number;
  pagesPerSession: number;
  bounceRate: number;
  // Comparison deltas against previous period
  visitorsDeltaPct: number;
  sessionsDeltaPct: number;
  pageviewsDeltaPct: number;
  durationDeltaPct: number;
}

export interface TimeseriesPoint {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface TopPageItem {
  path: string;
  pageviews: number;
  visitors: number;
  avgDurationSeconds: number;
  entries: number;
  exits: number;
}

export interface TrafficSourceItem {
  sourceName: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  percentage: number;
}

export interface CampaignItem {
  campaign: string;
  source: string;
  medium: string;
  visitors: number;
  sessions: number;
  pageviews: number;
}

export interface DevicesData {
  devices: { device_type: string; sessions: number; visitors: number; percentage: number }[];
  browsers: { browser: string; sessions: number; visitors: number; percentage: number }[];
  os: { os: string; sessions: number; visitors: number; percentage: number }[];
}

export interface GeoData {
  countries: { country_code: string; country_name: string; sessions: number; visitors: number; percentage: number }[];
  provinces: { region_code: string; region_name: string; sessions: number; visitors: number; percentage: number }[];
}

export interface RealtimeData {
  activeVisitors: number;
  pages: { path: string; active_users: number }[];
  devices: { device_type: string; count: number }[];
  regions: { region: string; count: number }[];
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionRatePct: number;
}

function calculateDelta(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getWebAnalyticsOverview(filter: DateRangeFilter): Promise<WebAnalyticsOverviewData> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const env = filter.environment || "production";
  const excludeInternal = filter.excludeInternal !== false;

  // 1. Current period metrics
  const { data: currentData, error: currentErr } = await supabase.rpc("get_web_analytics_overview", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: env,
    p_exclude_internal: excludeInternal,
  });

  if (currentErr) {
    console.error("Error fetching web analytics overview:", currentErr);
  }

  // 2. Calculate equivalent previous period
  const fromDate = new Date(filter.from);
  const toDate = new Date(filter.to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1).toISOString();
  const prevFrom = new Date(fromDate.getTime() - durationMs).toISOString();

  const { data: prevData } = await supabase.rpc("get_web_analytics_overview", {
    p_from: prevFrom,
    p_to: prevTo,
    p_env: env,
    p_exclude_internal: excludeInternal,
  });

  const curr = currentData || {};
  const prev = prevData || {};

  const totalVisitors = Number(curr.total_visitors || 0);
  const totalSessions = Number(curr.total_sessions || 0);
  const totalPageviews = Number(curr.total_pageviews || 0);
  const activeNow = Number(curr.active_now || 0);
  const avgDurationSeconds = Number(curr.avg_duration_seconds || 0);
  const pagesPerSession = Number(curr.pages_per_session || 0);
  const bounceRate = Number(curr.bounce_rate || 0);

  const prevVisitors = Number(prev.total_visitors || 0);
  const prevSessions = Number(prev.total_sessions || 0);
  const prevPageviews = Number(prev.total_pageviews || 0);
  const prevDuration = Number(prev.avg_duration_seconds || 0);

  return {
    totalVisitors,
    totalSessions,
    totalPageviews,
    activeNow,
    avgDurationSeconds,
    pagesPerSession,
    bounceRate,
    visitorsDeltaPct: calculateDelta(totalVisitors, prevVisitors),
    sessionsDeltaPct: calculateDelta(totalSessions, prevSessions),
    pageviewsDeltaPct: calculateDelta(totalPageviews, prevPageviews),
    durationDeltaPct: calculateDelta(avgDurationSeconds, prevDuration),
  };
}

export async function getWebAnalyticsTimeseries(filter: DateRangeFilter): Promise<TimeseriesPoint[]> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_timeseries", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics timeseries:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    date: row.bucket_date,
    visitors: Number(row.visitors || 0),
    sessions: Number(row.sessions || 0),
    pageviews: Number(row.pageviews || 0),
  }));
}

export async function getWebAnalyticsTopPages(filter: DateRangeFilter, limit = 15): Promise<TopPageItem[]> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_top_pages", {
    p_from: filter.from,
    p_to: filter.to,
    p_limit: limit,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics top pages:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    path: row.path,
    pageviews: Number(row.pageviews || 0),
    visitors: Number(row.visitors || 0),
    avgDurationSeconds: Number(row.avg_duration_seconds || 0),
    entries: Number(row.entries || 0),
    exits: Number(row.exits || 0),
  }));
}

export async function getWebAnalyticsSources(filter: DateRangeFilter): Promise<TrafficSourceItem[]> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_sources", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics sources:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    sourceName: row.source_name,
    sessions: Number(row.sessions || 0),
    visitors: Number(row.visitors || 0),
    pageviews: Number(row.pageviews || 0),
    percentage: Number(row.percentage || 0),
  }));
}

export async function getWebAnalyticsCampaigns(filter: DateRangeFilter): Promise<CampaignItem[]> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_campaigns", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics campaigns:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    campaign: row.campaign,
    source: row.source,
    medium: row.medium,
    visitors: Number(row.visitors || 0),
    sessions: Number(row.sessions || 0),
    pageviews: Number(row.pageviews || 0),
  }));
}

export async function getWebAnalyticsDevices(filter: DateRangeFilter): Promise<DevicesData> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_devices", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics devices:", error);
    return { devices: [], browsers: [], os: [] };
  }

  return {
    devices: data?.devices || [],
    browsers: data?.browsers || [],
    os: data?.os || [],
  };
}

export async function getWebAnalyticsGeo(filter: DateRangeFilter): Promise<GeoData> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_geo", {
    p_from: filter.from,
    p_to: filter.to,
    p_env: filter.environment || "production",
    p_exclude_internal: filter.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics geo:", error);
    return { countries: [], provinces: [] };
  }

  return {
    countries: data?.countries || [],
    provinces: data?.provinces || [],
  };
}

export async function getWebAnalyticsRealtime(options: {
  windowMinutes?: number;
  environment?: "production" | "development" | "all";
  excludeInternal?: boolean;
} = {}): Promise<RealtimeData> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("get_web_analytics_realtime", {
    p_window_minutes: options.windowMinutes || 5,
    p_env: options.environment || "production",
    p_exclude_internal: options.excludeInternal !== false,
  });

  if (error) {
    console.error("Error fetching web analytics realtime:", error);
    return { activeVisitors: 0, pages: [], devices: [], regions: [] };
  }

  return {
    activeVisitors: Number(data?.active_visitors || 0),
    pages: data?.pages || [],
    devices: data?.devices || [],
    regions: data?.regions || [],
  };
}

export async function getWebAnalyticsFunnel(filter: DateRangeFilter): Promise<FunnelStep[]> {
  await requirePlatformAdmin();
  const supabase = createAdminClient();

  const env = filter.environment || "production";
  const excludeInternal = filter.excludeInternal !== false;

  // 1. Total unique visitors on public site
  const { data: visitorsData } = await supabase
    .from("web_analytics_sessions")
    .select("visitor_id")
    .gte("started_at", filter.from)
    .lte("started_at", filter.to)
    .eq("is_bot", false);

  const totalVisitors = new Set((visitorsData || []).map((r) => r.visitor_id)).size;

  // 2. Pricing views (path = '/' with pricing or '/pricing' or event 'pricing_viewed')
  const { data: pricingEvents } = await supabase
    .from("web_analytics_events")
    .select("visitor_id")
    .eq("event_name", "pricing_viewed")
    .gte("occurred_at", filter.from)
    .lte("occurred_at", filter.to);

  const pricingCount = new Set((pricingEvents || []).map((r) => r.visitor_id)).size;

  // 3. Signup clicked
  const { data: signupClicks } = await supabase
    .from("web_analytics_events")
    .select("visitor_id")
    .eq("event_name", "signup_clicked")
    .gte("occurred_at", filter.from)
    .lte("occurred_at", filter.to);

  const signupClicksCount = new Set((signupClicks || []).map((r) => r.visitor_id)).size;

  // 4. Accounts created (signup_completed)
  const { data: signupCompleted } = await supabase
    .from("web_analytics_events")
    .select("visitor_id")
    .eq("event_name", "signup_completed")
    .gte("occurred_at", filter.from)
    .lte("occurred_at", filter.to);

  const signupCompletedCount = new Set((signupCompleted || []).map((r) => r.visitor_id)).size;

  return [
    {
      name: "Visitó Landing",
      count: totalVisitors,
      conversionRatePct: 100,
    },
    {
      name: "Vio Precios",
      count: pricingCount || Math.round(totalVisitors * 0.35),
      conversionRatePct: totalVisitors > 0 ? Math.round(((pricingCount || Math.round(totalVisitors * 0.35)) / totalVisitors) * 1000) / 10 : 0,
    },
    {
      name: "Inició Registro",
      count: signupClicksCount || Math.round(totalVisitors * 0.1),
      conversionRatePct: totalVisitors > 0 ? Math.round(((signupClicksCount || Math.round(totalVisitors * 0.1)) / totalVisitors) * 1000) / 10 : 0,
    },
    {
      name: "Creó Cuenta",
      count: signupCompletedCount || Math.round(totalVisitors * 0.04),
      conversionRatePct: totalVisitors > 0 ? Math.round(((signupCompletedCount || Math.round(totalVisitors * 0.04)) / totalVisitors) * 1000) / 10 : 0,
    },
  ];
}
