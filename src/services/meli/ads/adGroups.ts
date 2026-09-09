import { meliAdsFetch } from "./client";
import { MeliAdsAdGroup } from "./types";
import { parseAdsMetrics } from "./metrics";
import { logger } from "@/lib/errors/logger";

export interface GetProductAdsAdGroupsArgs {
  tenantId: string;
  siteId: string;
  advertiserId: number;
  campaignId?: string | number;
  campaignIds?: (string | number)[];
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}

export async function getProductAdsAdGroups({
  tenantId,
  siteId,
  advertiserId,
  campaignId,
  campaignIds,
  dateFrom,
  dateTo,
  limit = 50,
}: GetProductAdsAdGroupsArgs): Promise<MeliAdsAdGroup[]> {
  const startTime = Date.now();
  logger.info({
    event: "MELI_ADS_ADGROUPS_FETCH_STARTED",
    tenantId,
    advertiserId,
    siteId,
    campaignId,
  });

  const allAdGroups: MeliAdsAdGroup[] = [];
  let offset = 0;
  let hasMore = true;
  const maxPages = 15; // Max 750 ad groups
  let pageCount = 0;

  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      queryParams.set("offset", String(offset));
      if (campaignId) queryParams.set("campaign_id", String(campaignId));
      if (campaignIds && campaignIds.length > 0) {
        queryParams.set("campaign_ids", campaignIds.map(String).join(","));
      }
      if (dateFrom) queryParams.set("date_from", dateFrom);
      if (dateTo) queryParams.set("date_to", dateTo);

      const endpoint = `/advertising/${encodeURIComponent(siteId)}/advertisers/${encodeURIComponent(
        advertiserId
      )}/product_ads/ad_groups/search?${queryParams.toString()}`;

      const response = await meliAdsFetch({
        tenantId,
        endpoint,
        apiVersion: "2",
      });

      const results = response?.results || (Array.isArray(response) ? response : []);
      const total = response?.paging?.total !== undefined ? Number(response.paging.total) : results.length;

      for (const raw of results) {
        const parsedMetrics = parseAdsMetrics(raw);

        // Extract item IDs associated with this Ad Group
        let itemId: string | undefined = raw.item_id || raw.itemId;
        let itemIds: string[] = [];

        if (Array.isArray(raw.items)) {
          itemIds = raw.items.map((it: any) => (typeof it === "string" ? it : it.id || it.item_id)).filter(Boolean);
        } else if (Array.isArray(raw.item_ids)) {
          itemIds = raw.item_ids.map(String);
        }

        if (!itemId && itemIds.length > 0) {
          itemId = itemIds[0];
        } else if (itemId && itemIds.length === 0) {
          itemIds = [itemId];
        }

        allAdGroups.push({
          id: raw.id ?? raw.ad_group_id,
          campaign_id: raw.campaign_id ?? campaignId,
          name: raw.name ?? `Ad Group ${raw.id}`,
          status: raw.status ?? "active",
          item_id: itemId,
          item_ids: itemIds,
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
      event: "MELI_ADS_ADGROUPS_FETCH_SUCCESS",
      tenantId,
      advertiserId,
      siteId,
      adGroupsCount: allAdGroups.length,
      durationMs,
    });

    return allAdGroups;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const statusCode = error?.statusCode || error?.status || 500;

    logger.error({
      event: "MELI_ADS_ADGROUPS_FETCH_FAILED",
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
