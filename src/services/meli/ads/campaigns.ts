import { meliAdsFetch } from "./client";
import { MeliAdsCampaign } from "./types";
import { parseAdsMetrics } from "./metrics";
import { logger } from "@/lib/errors/logger";

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
}: GetProductAdsCampaignsArgs): Promise<MeliAdsCampaign[]> {
  const startTime = Date.now();
  logger.info({
    event: "MELI_ADS_CAMPAIGNS_FETCH_STARTED",
    tenantId,
    advertiserId,
    siteId,
  });

  const allCampaigns: MeliAdsCampaign[] = [];
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

      const endpoint = `/advertising/${encodeURIComponent(siteId)}/advertisers/${encodeURIComponent(
        advertiserId
      )}/product_ads/campaigns/search?${queryParams.toString()}`;

      const response = await meliAdsFetch({
        tenantId,
        endpoint,
        apiVersion: "2",
      });

      const results = response?.results || (Array.isArray(response) ? response : []);
      const total = response?.paging?.total !== undefined ? Number(response.paging.total) : results.length;

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
      event: "MELI_ADS_CAMPAIGNS_FETCH_SUCCESS",
      tenantId,
      advertiserId,
      siteId,
      campaignsCount: allCampaigns.length,
      durationMs,
    });

    return allCampaigns;
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
