import { meliAdsFetch } from "./client";
import { MeliAdsCampaign, GetProductAdsCampaignsResponse, AdsMetrics } from "./types";
import { parseAdsMetrics } from "./metrics";
import { logger } from "@/lib/errors/logger";

export const PRODUCT_ADS_CAMPAIGN_METRICS = [
  "clicks",
  "prints",
  "cost",
  "cpc",
  "ctr",
  "acos",
  "cvr",
  "roas",
  "direct_units_quantity",
  "indirect_units_quantity",
  "units_quantity",
  "direct_amount",
  "indirect_amount",
  "total_amount",
];

export interface GetProductAdsCampaignsArgs {
  tenantId: string;
  siteId: string;
  advertiserId: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}

export async function getProductAdsCampaigns({
  tenantId,
  siteId,
  advertiserId,
  dateFrom,
  dateTo,
  limit = 50,
}: GetProductAdsCampaignsArgs): Promise<GetProductAdsCampaignsResponse> {
  const startTime = Date.now();
  logger.info({
    event: "MELI_ADS_CAMPAIGNS_FETCH_STARTED",
    tenantId,
    advertiserId,
    siteId,
  });

  const allCampaigns: MeliAdsCampaign[] = [];
  let metricsSummary: AdsMetrics | null = null;
  let offset = 0;
  let hasMore = true;
  const maxPages = 10; // Safety guard: max 500 campaigns
  let pageCount = 0;

  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      queryParams.set("offset", String(offset));
      if (dateFrom) queryParams.set("date_from", dateFrom);
      if (dateTo) queryParams.set("date_to", dateTo);
      queryParams.set("metrics", PRODUCT_ADS_CAMPAIGN_METRICS.join(","));
      queryParams.set("metrics_summary", "true");

      const endpoint = `/advertising/${encodeURIComponent(siteId)}/advertisers/${encodeURIComponent(
        advertiserId
      )}/product_ads/campaigns/search?${queryParams.toString()}`;

      logger.info({
        event: "MELI_ADS_CAMPAIGN_METRICS_REQUEST",
        tenantId,
        advertiserId,
        siteId,
        dateFrom,
        dateTo,
        offset,
        endpoint,
      });

      const response = await meliAdsFetch({
        tenantId,
        endpoint,
        apiVersion: "2",
      });

      // Capture metrics_summary if returned on any page
      const rawSummary = response?.metrics_summary || response?.summary?.metrics || response?.summary;
      if (rawSummary && !metricsSummary) {
        metricsSummary = parseAdsMetrics(rawSummary);
      }

      const results = response?.results || (Array.isArray(response) ? response : []);
      const total = response?.paging?.total !== undefined ? Number(response.paging.total) : results.length;

      // Debug logging of payload shape in development environment only
      if (process.env.NODE_ENV !== "production") {
        logger.info({
          event: "MELI_ADS_PAYLOAD_SHAPE_DEBUG",
          campaignCount: results.length,
          firstCampaignKeys: results[0] ? Object.keys(results[0]) : [],
          firstMetricsKeys: results[0]?.metrics ? Object.keys(results[0].metrics) : [],
          metricsSummaryKeys: rawSummary ? Object.keys(rawSummary) : [],
        });
      }

      for (const raw of results) {
        const parsedMetrics = parseAdsMetrics(raw);
        allCampaigns.push({
          id: raw.id ?? raw.campaign_id,
          name: raw.name ?? `Campaña ${raw.id}`,
          status: raw.status ?? "active",
          budget: raw.budget !== undefined ? Number(raw.budget) : null,
          daily_budget: raw.daily_budget !== undefined ? Number(raw.daily_budget) : (raw.budget !== undefined ? Number(raw.budget) : null),
          consumed_budget: parsedMetrics.cost,
          metrics: parsedMetrics,
          raw,
        });
      }

      offset += results.length;
      if (results.length === 0 || offset >= total || !response?.paging) {
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info({
      event: allCampaigns.length === 0 ? "MELI_ADS_CAMPAIGN_METRICS_EMPTY" : "MELI_ADS_CAMPAIGN_METRICS_RESPONSE",
      tenantId,
      advertiserId,
      siteId,
      dateFrom,
      dateTo,
      campaignCount: allCampaigns.length,
      hasMetricsSummary: Boolean(metricsSummary),
      durationMs,
    });

    return {
      campaigns: allCampaigns,
      metricsSummary,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const statusCode = error?.statusCode || error?.status || 500;

    logger.error({
      event: "MELI_ADS_CAMPAIGNS_FETCH_FAILED",
      tenantId,
      advertiserId,
      siteId,
      status: String(statusCode),
      durationMs,
      errorMessage: error?.message,
    });

    throw error;
  }
}
