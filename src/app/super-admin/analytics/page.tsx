import { requirePlatformAdmin } from "@/lib/security/platformAdminAuth";
import {
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
import { AnalyticsClient } from "./AnalyticsClient";

export const metadata = {
  title: "Web Analytics | Super Admin",
  description: "Telemetría, adquisición y usuarios activos en tiempo real en LibretaX",
};

export default async function SuperAdminAnalyticsPage() {
  await requirePlatformAdmin();

  // Initial 30-day window
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const filter = {
    from,
    to,
    environment: "production" as const,
    excludeInternal: true,
  };

  const [
    overview,
    timeseries,
    topPages,
    sources,
    campaigns,
    devices,
    geo,
    realtime,
    funnel,
  ] = await Promise.all([
    getWebAnalyticsOverview(filter),
    getWebAnalyticsTimeseries(filter),
    getWebAnalyticsTopPages(filter, 15),
    getWebAnalyticsSources(filter),
    getWebAnalyticsCampaigns(filter),
    getWebAnalyticsDevices(filter),
    getWebAnalyticsGeo(filter),
    getWebAnalyticsRealtime({ environment: "production", excludeInternal: true }),
    getWebAnalyticsFunnel(filter),
  ]);

  return (
    <AnalyticsClient
      initialOverview={overview}
      initialTimeseries={timeseries}
      initialTopPages={topPages}
      initialSources={sources}
      initialCampaigns={campaigns}
      initialDevices={devices}
      initialGeo={geo}
      initialRealtime={realtime}
      initialFunnel={funnel}
    />
  );
}
