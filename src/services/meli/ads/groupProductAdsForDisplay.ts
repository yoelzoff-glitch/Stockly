import { ProductAdsMetrics, ProductAdsProductGroup } from "./types";

/**
 * Extracts a structural group key for a publication.
 * Priority:
 * 1. Master Item (master_id / item_relations)
 * 2. Catalog Product ID (catalog_product_id)
 * 3. Family ID (family_id)
 * 4. Parent ID (parent_id / parent_item_id)
 * 5. Stable SKU (non-MLA)
 * 6. Fallback: individual publication ID (never title similarity)
 */
export function extractProductGroupKey(
  publication: ProductAdsMetrics,
  metadata?: any
): string {
  const raw = publication.raw_data || metadata?.raw_data || {};

  // 1. Master ID
  const masterId =
    raw.master_id ||
    raw.masterId ||
    metadata?.master_id ||
    metadata?.masterId;

  if (masterId) {
    return `master:${String(masterId).trim().toLowerCase()}`;
  }

  // Inspect item_relations if present
  const relations = raw.item_relations || raw.relations || metadata?.item_relations || metadata?.relations;
  if (Array.isArray(relations) && relations.length > 0) {
    const parentRel = relations.find(
      (r: any) =>
        r.type === "parent" ||
        r.type === "master" ||
        r.relation_type === "parent" ||
        r.relation_type === "master"
    );
    const relId = parentRel ? parentRel.id || parentRel.item_id : relations[0]?.id || relations[0]?.item_id;
    if (relId) {
      return `master:${String(relId).trim().toLowerCase()}`;
    }
  }

  // 2. Catalog Product ID
  const catalogProductId =
    raw.catalog_product_id ||
    raw.catalogProductId ||
    metadata?.catalog_product_id;

  if (catalogProductId) {
    return `catalog:${String(catalogProductId).trim().toLowerCase()}`;
  }

  // 3. Family ID
  const familyId =
    raw.family_id ||
    raw.familyId ||
    metadata?.family_id;

  if (familyId) {
    return `family:${String(familyId).trim().toLowerCase()}`;
  }

  // 4. Parent ID
  const parentId =
    raw.parent_id ||
    raw.parentId ||
    raw.parent_item_id ||
    metadata?.parent_id ||
    metadata?.parent_item_id;

  if (parentId) {
    return `parent:${String(parentId).trim().toLowerCase()}`;
  }

  // 5. Stable SKU fallback (excluding generic MLA IDs)
  const sku = (publication.sku || metadata?.sku || "").trim();
  if (sku && !sku.toUpperCase().startsWith("MLA")) {
    return `sku:${sku.toLowerCase()}`;
  }

  // 6. Safe fallback: individual publication
  const itemId = publication.meli_item_id || publication.product_id || "unknown";
  return `pub:${String(itemId).trim().toLowerCase()}`;
}

/**
 * Selects the representative publication for a group.
 * Priority:
 * 1. Highest ads_revenue
 * 2. Highest ads_investment
 * 3. First valid publication
 */
export function selectRepresentativePublication(publications: ProductAdsMetrics[]): ProductAdsMetrics {
  let representative = publications[0];

  for (let i = 1; i < publications.length; i++) {
    const current = publications[i];
    if (current.ads_revenue > representative.ads_revenue) {
      representative = current;
    } else if (current.ads_revenue === representative.ads_revenue) {
      if (current.ads_investment > representative.ads_investment) {
        representative = current;
      }
    }
  }

  return representative;
}

/**
 * Groups a list of individual Product Ads publications into master product groups for UI presentation.
 * Pure, deterministic function that preserves granularity without altering the original list.
 */
export function groupProductAdsForDisplay(
  productAdsList: ProductAdsMetrics[],
  productsMetadata?: Map<string, any> | Record<string, any> | any[]
): ProductAdsProductGroup[] {
  if (!productAdsList || productAdsList.length === 0) {
    return [];
  }

  // Helper to resolve metadata from Map, Record or Array
  const getMetadata = (itemId: string, productId: string) => {
    if (!productsMetadata) return undefined;
    const lowerItemId = itemId.toLowerCase();
    const lowerProdId = productId.toLowerCase();

    if (productsMetadata instanceof Map) {
      return productsMetadata.get(lowerItemId) || productsMetadata.get(lowerProdId) || productsMetadata.get(itemId);
    }
    if (Array.isArray(productsMetadata)) {
      return productsMetadata.find(
        (p: any) =>
          (p.meli_item_id && p.meli_item_id.toLowerCase() === lowerItemId) ||
          (p.id && String(p.id).toLowerCase() === lowerProdId)
      );
    }
    return productsMetadata[lowerItemId] || productsMetadata[lowerProdId] || productsMetadata[itemId];
  };

  const groupBuckets = new Map<string, ProductAdsMetrics[]>();

  for (const pub of productAdsList) {
    const meta = getMetadata(pub.meli_item_id, pub.product_id);
    const key = pub.group_key || extractProductGroupKey(pub, meta);

    const bucket = groupBuckets.get(key);
    if (bucket) {
      bucket.push(pub);
    } else {
      groupBuckets.set(key, [pub]);
    }
  }

  const groups: ProductAdsProductGroup[] = [];

  for (const [key, publications] of groupBuckets.entries()) {
    const representative = selectRepresentativePublication(publications);

    // Price range
    const validPrices = publications
      .map((p) => p.price)
      .filter((pr) => typeof pr === "number" && !isNaN(pr) && pr > 0);
    const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
    const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;

    // Cost range
    const validCosts = publications
      .map((p) => p.cost)
      .filter((c): c is number => typeof c === "number" && !isNaN(c) && c !== null);
    const minCost = validCosts.length > 0 ? Math.min(...validCosts) : null;
    const maxCost = validCosts.length > 0 ? Math.max(...validCosts) : null;
    const missingCostCount = publications.filter((p) => p.cost === null || p.cost === undefined).length;

    // Aggregated Metrics
    let totalUnits = 0;
    let totalRevenue = 0;
    let totalInvestment = 0;
    let totalClicks: number | null = null;
    let hasClicks = false;

    for (const pub of publications) {
      totalUnits += pub.ads_units_sold || 0;
      totalRevenue += pub.ads_revenue || 0;
      totalInvestment += pub.ads_investment || 0;
      if (pub.clics !== null && pub.clics !== undefined) {
        hasClicks = true;
        totalClicks = (totalClicks || 0) + pub.clics;
      }
    }

    if (!hasClicks) {
      totalClicks = null;
    }

    // ACOS & ROAS recalculated from group aggregates
    const acos =
      totalRevenue > 0 && totalInvestment > 0
        ? Number(((totalInvestment / totalRevenue) * 100).toFixed(1))
        : null;

    const roas =
      totalInvestment > 0 && totalRevenue > 0
        ? Number((totalRevenue / totalInvestment).toFixed(2))
        : null;

    // Clean Net Profit: strict calculation
    // Publications with actual sales or revenue must have complete profitability
    const activePubs = publications.filter((p) => p.ads_units_sold > 0 || p.ads_revenue > 0);
    let cleanNetProfit: number | null = null;

    if (activePubs.length > 0) {
      const hasIncompleteActive = activePubs.some(
        (p) =>
          p.clean_net_profit === null ||
          p.cost === null ||
          p.cost === undefined ||
          p.profitability_status !== "complete"
      );

      if (!hasIncompleteActive) {
        cleanNetProfit = activePubs.reduce((sum, p) => sum + (p.clean_net_profit || 0), 0);
      }
    }

    groups.push({
      key,
      representative,
      publications,
      publicationCount: publications.length,
      title: representative.title,
      thumbnailUrl: representative.thumbnail_url || null,
      minPrice,
      maxPrice,
      minCost,
      maxCost,
      missingCostCount,
      totalUnits,
      totalRevenue,
      totalInvestment,
      totalClicks,
      acos,
      roas,
      cleanNetProfit,
    });
  }

  // Default ordering: totalRevenue DESC, then totalInvestment DESC
  groups.sort((a, b) => {
    if (b.totalRevenue !== a.totalRevenue) {
      return b.totalRevenue - a.totalRevenue;
    }
    return b.totalInvestment - a.totalInvestment;
  });

  return groups;
}
