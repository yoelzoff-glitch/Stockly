import { logger } from "@/lib/errors/logger";
import { parseCompetitorUrl } from "./urlParser";
import { meliPublicFetch } from "./publicClient";
import { normalizeCompetitorData, validateCompetitorSnapshot } from "./normalizer";
import { getCachedCompetitorSnapshot, setCachedCompetitorSnapshot } from "./cache";
import {
  CompetitorAnalysisError,
  CompetitorSnapshot,
  ResolveCompetitorOptions,
} from "./types";
import { meliFetch } from "@/services/meli/client";

/**
 * Resolves competitor listing or catalog data across multiple resilient strategies.
 * Prioritizes public unauthenticated endpoints, supports partial snapshots,
 * caches results, and prevents 403 Mercado Libre errors from aborting analysis.
 */
export async function resolveCompetitor(
  options: ResolveCompetitorOptions
): Promise<CompetitorSnapshot> {
  const startTime = Date.now();
  const { url, tenantId, correlationId, clientData } = options;

  logger.info({
    event: "COMPETITOR_RESOLUTION_STARTED",
    tenantId,
    correlationId,
    url,
  });

  // 1. Parse URL & derive identifiers
  const parsed = parseCompetitorUrl(url);
  const primaryId = parsed.itemId || parsed.catalogProductId || "UNKNOWN";

  // 2. Check Cache
  const cached = getCachedCompetitorSnapshot(tenantId, primaryId);
  if (cached) {
    logger.info({
      event: "COMPETITOR_CACHE_HIT",
      tenantId,
      correlationId,
      primaryId,
      durationMs: Date.now() - startTime,
    });
    return cached;
  }

  // 3. Strategy 0: Direct browser resolution passed from client
  if (clientData?.itemData || clientData?.productData) {
    try {
      const snapshot = normalizeCompetitorData({
        sourceId: clientData.resolvedId || primaryId,
        sourceType: clientData.productData ? "catalog" : "item",
        itemData: clientData.itemData,
        productData: clientData.productData,
        sellerData: clientData.sellerData,
        description: clientData.description,
        resolutionSource: "browser_public",
        catalogProductId: parsed.catalogProductId,
      });

      const validation = validateCompetitorSnapshot(snapshot);
      if (validation.valid) {
        setCachedCompetitorSnapshot(tenantId, primaryId, snapshot);
        logger.info({
          event: "COMPETITOR_BROWSER_RESOLVED",
          tenantId,
          correlationId,
          primaryId,
          partial: snapshot.resolution.partial,
          durationMs: Date.now() - startTime,
        });
        return snapshot;
      }
    } catch (browserNormalizeErr) {
      logger.warn({
        event: "COMPETITOR_BROWSER_DATA_INVALID",
        tenantId,
        correlationId,
        error: String(browserNormalizeErr),
      });
    }
  }

  // 4. Strategy A: Public Item (/items/{itemId})
  if (parsed.itemId && parsed.probableType !== "catalog") {
    const itemRes = await meliPublicFetch(`/items/${parsed.itemId}`);

    if (itemRes.ok && itemRes.data?.id) {
      const itemData = itemRes.data;
      let sellerData = null;
      let description: string | null = null;

      // Optional enrichment: Description
      const descRes = await meliPublicFetch(`/items/${parsed.itemId}/description`);
      if (descRes.ok && descRes.data?.plain_text) {
        description = descRes.data.plain_text;
      }

      // Optional enrichment: Seller
      const sellerId = itemData.seller_id || itemData.seller?.id;
      if (sellerId) {
        const sellerRes = await meliPublicFetch(`/users/${sellerId}`);
        if (sellerRes.ok && sellerRes.data?.id) {
          sellerData = sellerRes.data;
        }
      }

      const snapshot = normalizeCompetitorData({
        sourceId: parsed.itemId,
        sourceType: "item",
        itemData,
        sellerData,
        description,
        resolutionSource: "server_public_item",
        catalogProductId: itemData.catalog_product_id || parsed.catalogProductId,
      });

      const validation = validateCompetitorSnapshot(snapshot);
      if (validation.valid) {
        setCachedCompetitorSnapshot(tenantId, primaryId, snapshot);
        logger.info({
          event: "COMPETITOR_PUBLIC_ITEM_RESOLVED",
          tenantId,
          correlationId,
          itemId: parsed.itemId,
          partial: snapshot.resolution.partial,
          durationMs: Date.now() - startTime,
        });
        return snapshot;
      }
    } else {
      logger.warn({
        event: itemRes.status === 403 ? "COMPETITOR_PUBLIC_ITEM_403" : "COMPETITOR_PUBLIC_ITEM_FAILED",
        tenantId,
        correlationId,
        itemId: parsed.itemId,
        status: String(itemRes.status),
        error: itemRes.error,
      });
    }
  }

  // 5. Strategy B: Catalog Product (/products/{catalogProductId})
  const catalogIdToTry = parsed.catalogProductId || (parsed.itemId?.startsWith("MLAU") ? parsed.itemId : null);
  if (catalogIdToTry) {
    const idsToTry = [catalogIdToTry];
    if (catalogIdToTry.startsWith("MLAU")) {
      idsToTry.push("MLA" + catalogIdToTry.substring(4));
    }

    for (const catId of idsToTry) {
      const prodRes = await meliPublicFetch(`/products/${catId}`);
      if (prodRes.ok && prodRes.data?.id) {
        const productData = prodRes.data;
        let winnerItemData: any = null;
        let winnerSellerData: any = null;
        let winnerDescription: string | null = null;
        const buyBoxItemId = productData.buy_box_winner?.item_id;

        if (buyBoxItemId) {
          // Attempt to enrich with the buy box winner item
          const winnerRes = await meliPublicFetch(`/items/${buyBoxItemId}`);
          if (winnerRes.ok && winnerRes.data?.id) {
            winnerItemData = winnerRes.data;

            const descRes = await meliPublicFetch(`/items/${buyBoxItemId}/description`);
            if (descRes.ok && descRes.data?.plain_text) {
              winnerDescription = descRes.data.plain_text;
            }

            const sellerId = winnerItemData.seller_id || winnerItemData.seller?.id;
            if (sellerId) {
              const sellerRes = await meliPublicFetch(`/users/${sellerId}`);
              if (sellerRes.ok && sellerRes.data?.id) {
                winnerSellerData = sellerRes.data;
              }
            }
          } else {
            // DO NOT fail! If /items/buyBoxItemId is 403 or unavailable, build partial from productData
            logger.info({
              event: "COMPETITOR_BUYBOX_ITEM_UNAVAILABLE_FALLBACK_TO_PRODUCT",
              tenantId,
              correlationId,
              catId,
              buyBoxItemId,
              status: String(winnerRes.status),
            });
          }
        }

        const snapshot = normalizeCompetitorData({
          sourceId: buyBoxItemId || catId,
          sourceType: "catalog",
          itemData: winnerItemData,
          productData,
          sellerData: winnerSellerData,
          description: winnerDescription,
          resolutionSource: winnerItemData ? "server_catalog_winner" : "server_catalog_partial",
          catalogProductId: catId,
        });

        const validation = validateCompetitorSnapshot(snapshot);
        if (validation.valid) {
          setCachedCompetitorSnapshot(tenantId, primaryId, snapshot);
          logger.info({
            event: "COMPETITOR_CATALOG_RESOLVED",
            tenantId,
            correlationId,
            catId,
            partial: snapshot.resolution.partial,
            durationMs: Date.now() - startTime,
          });
          return snapshot;
        }
      }
    }
  }

  // 6. Strategy C: Tenant OAuth (Optional last resort if connected)
  if (tenantId) {
    const targetItemId = parsed.itemId || parsed.catalogProductId;
    if (targetItemId) {
      try {
        const oauthRes = await meliFetch({
          tenantId,
          endpoint: `/items/${targetItemId}`,
        });

        if (oauthRes && oauthRes.id) {
          const snapshot = normalizeCompetitorData({
            sourceId: targetItemId,
            sourceType: "item",
            itemData: oauthRes,
            resolutionSource: "server_tenant_oauth",
            catalogProductId: oauthRes.catalog_product_id || parsed.catalogProductId,
          });

          const validation = validateCompetitorSnapshot(snapshot);
          if (validation.valid) {
            setCachedCompetitorSnapshot(tenantId, primaryId, snapshot);
            logger.info({
              event: "COMPETITOR_OAUTH_FALLBACK_RESOLVED",
              tenantId,
              correlationId,
              targetItemId,
              durationMs: Date.now() - startTime,
            });
            return snapshot;
          }
        }
      } catch (oauthErr) {
        // OAuth fallback is completely optional and non-blocking
        logger.warn({
          event: "COMPETITOR_OAUTH_FALLBACK_FAILED",
          tenantId,
          correlationId,
          targetItemId,
          error: String(oauthErr),
        });
      }
    }
  }

  // 7. Exhausted all strategies without minimum required fields
  const durationMs = Date.now() - startTime;
  logger.error({
    event: "COMPETITOR_RESOLUTION_FAILED",
    tenantId,
    correlationId,
    primaryId,
    durationMs,
  });

  throw new CompetitorAnalysisError(
    "COMPETITOR_INSUFFICIENT_DATA",
    "No pudimos obtener suficiente información pública de esta publicación. Mercado Libre restringe algunos datos de determinadas publicaciones. Probá con el enlace directo del producto o con otra publicación.",
    422
  );
}
