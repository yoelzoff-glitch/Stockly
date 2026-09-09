import { meliAdsFetch } from "./client";
import { ProductAdsAd } from "./types";
import { parseAdsMetrics } from "./metrics";
import { logger } from "@/lib/errors/logger";

export const PRODUCT_ADS_AD_METRICS = [
  "clicks",
  "prints",
  "cost",
  "cpc",
  "ctr",
  "direct_amount",
  "indirect_amount",
  "total_amount",
  "direct_units_quantity",
  "indirect_units_quantity",
  "units_quantity",
  "acos",
  "roas",
  "cvr",
];

export interface GetProductAdsAdsArgs {
  tenantId: string;
  siteId: string;
  adGroupId: string | number;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
}

export async function getProductAdsAds({
  tenantId,
  siteId,
  adGroupId,
  dateFrom,
  dateTo,
  limit = 50,
}: GetProductAdsAdsArgs): Promise<ProductAdsAd[]> {
  const startTime = Date.now();
  logger.info({
    event: "MELI_ADS_ADS_FETCH_STARTED",
    tenantId,
    siteId,
    adGroupId,
  });

  const allAds: ProductAdsAd[] = [];
  let offset = 0;
  let hasMore = true;
  const maxPages = 10; // Safety guard: max 500 ads per ad group
  let pageCount = 0;

  try {
    while (hasMore && pageCount < maxPages) {
      pageCount++;
      const queryParams = new URLSearchParams();
      queryParams.set("limit", String(limit));
      queryParams.set("offset", String(offset));
      if (dateFrom) queryParams.set("date_from", dateFrom);
      if (dateTo) queryParams.set("date_to", dateTo);
      queryParams.set("metrics", PRODUCT_ADS_AD_METRICS.join(","));

      const endpoint = `/advertising/${encodeURIComponent(siteId)}/product_ads/ad_groups/${encodeURIComponent(
        adGroupId
      )}/ads?${queryParams.toString()}`;

      const response = await meliAdsFetch({
        tenantId,
        endpoint,
        apiVersion: "2",
      });

      const results = response?.results || (Array.isArray(response) ? response : []);
      const total = response?.paging?.total !== undefined ? Number(response.paging.total) : results.length;

      for (const raw of results) {
        const parsedMetrics = parseAdsMetrics(raw);
        const itemId = String(raw.item_id || raw.itemId || raw.id || "").trim();

        if (itemId) {
          allAds.push({
            id: raw.id ?? itemId,
            item_id: itemId,
            campaign_id: raw.campaign_id,
            ad_group_id: raw.ad_group_id ?? adGroupId,
            title: raw.title ?? raw.name ?? null,
            price: raw.price !== undefined && raw.price !== null ? Number(raw.price) : null,
            status: raw.status ?? "active",
            sku: raw.sku ?? null,
            thumbnail_url: raw.thumbnail_url ?? raw.thumbnail ?? raw.secure_thumbnail ?? null,
            metrics: parsedMetrics,
            raw,
          });
        }
      }

      offset += results.length;
      if (results.length === 0 || offset >= total || !response?.paging) {
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info({
      event: "MELI_ADS_ADS_FETCH_SUCCESS",
      tenantId,
      siteId,
      adGroupId,
      adsCount: allAds.length,
      durationMs,
    });

    return allAds;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const statusCode = error?.statusCode || error?.status || 500;

    logger.error({
      event: "MELI_ADS_ADS_FETCH_FAILED",
      tenantId,
      siteId,
      adGroupId,
      status: String(statusCode),
      durationMs,
      errorMessage: error?.message,
    });

    throw error;
  }
}
