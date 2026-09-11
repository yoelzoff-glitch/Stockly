"use server";

import {
  DateRangeFilter,
  getWebAnalyticsOverview,
  getWebAnalyticsTimeseries,
  getWebAnalyticsTopPages,
  getWebAnalyticsSources,
  getWebAnalyticsCampaigns,
  getWebAnalyticsDevices,
  getWebAnalyticsGeo,
  getWebAnalyticsRealtime,
  getWebAnalyticsFunnel,
} from "@/services/super-admin/analytics";

export async function fetchAnalyticsDashboardData(filter: DateRangeFilter) {
  const [
    overview,
    timeseries,
    topPages,
    sources,
    campaigns,
    devices,
    geo,
    funnel,
  ] = await Promise.all([
    getWebAnalyticsOverview(filter),
    getWebAnalyticsTimeseries(filter),
    getWebAnalyticsTopPages(filter, 15),
    getWebAnalyticsSources(filter),
    getWebAnalyticsCampaigns(filter),
    getWebAnalyticsDevices(filter),
    getWebAnalyticsGeo(filter),
    getWebAnalyticsFunnel(filter),
  ]);

  return {
    overview,
    timeseries,
    topPages,
    sources,
    campaigns,
    devices,
    geo,
    funnel,
  };
}

export async function fetchRealtimeData(options: {
  environment?: "production" | "development" | "all";
  excludeInternal?: boolean;
} = {}) {
  return await getWebAnalyticsRealtime(options);
}
