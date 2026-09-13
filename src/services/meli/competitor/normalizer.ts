import { CompetitorSnapshot } from "./types";

export const CRITICAL_FIELDS: (keyof CompetitorSnapshot)[] = ["title", "price"];

export interface NormalizeArgs {
  sourceId: string;
  sourceType: "item" | "catalog";
  itemData?: any;
  productData?: any;
  sellerData?: any;
  description?: string | null;
  resolutionSource: string;
  catalogProductId?: string | null;
}

/**
 * Normalizes raw Mercado Libre payloads (/items, /products, /users, /description)
 * into a single unified CompetitorSnapshot model.
 */
export function normalizeCompetitorData(args: NormalizeArgs): CompetitorSnapshot {
  const {
    sourceId,
    sourceType,
    itemData,
    productData,
    sellerData,
    description = null,
    resolutionSource,
    catalogProductId = null,
  } = args;

  const raw = itemData || productData || {};
  const buyBox = productData?.buy_box_winner || itemData?.buy_box_winner || null;

  // 1. Title
  const title =
    raw.title ||
    raw.name ||
    productData?.name ||
    itemData?.title ||
    null;

  // 2. Price & Currency
  let price: number | null = null;
  if (typeof raw.price === "number") {
    price = raw.price;
  } else if (typeof buyBox?.price === "number") {
    price = buyBox.price;
  } else if (raw.price !== undefined && raw.price !== null && !isNaN(Number(raw.price))) {
    price = Number(raw.price);
  }

  let originalPrice: number | null = null;
  if (typeof raw.original_price === "number") {
    originalPrice = raw.original_price;
  } else if (typeof buyBox?.original_price === "number") {
    originalPrice = buyBox.original_price;
  } else if (raw.original_price) {
    originalPrice = Number(raw.original_price) || null;
  }

  const currencyId =
    raw.currency_id ||
    buyBox?.currency_id ||
    productData?.currency_id ||
    "ARS";

  // 3. Permalink & Thumbnail
  const permalink =
    raw.permalink ||
    productData?.permalink ||
    null;

  let thumbnail: string | null =
    raw.thumbnail ||
    raw.secure_thumbnail ||
    raw.pictures?.[0]?.url ||
    productData?.pictures?.[0]?.url ||
    null;

  if (thumbnail && typeof thumbnail === "string") {
    // High-res substitution
    thumbnail = thumbnail.replace("-I.jpg", "-O.jpg");
  }

  // 4. Listing Type
  const listingTypeId =
    raw.listing_type_id ||
    buyBox?.listing_type_id ||
    null;

  // 5. Shipping
  const shippingRaw = raw.shipping || buyBox?.shipping || null;
  const shipping = {
    freeShipping:
      shippingRaw && typeof shippingRaw.free_shipping === "boolean"
        ? shippingRaw.free_shipping
        : null,
    logisticType: shippingRaw?.logistic_type || null,
  };

  // 6. Seller
  const sellerId =
    sellerData?.id ||
    raw.seller_id ||
    raw.seller?.id ||
    buyBox?.seller_id ||
    null;

  const seller = {
    id: typeof sellerId === "number" ? sellerId : (sellerId ? Number(sellerId) : null),
    nickname: sellerData?.nickname || raw.seller?.nickname || null,
    reputationLevel:
      sellerData?.seller_reputation?.level_id ||
      raw.seller?.seller_reputation?.level_id ||
      null,
    powerSellerStatus:
      sellerData?.seller_reputation?.power_seller_status ||
      raw.seller?.seller_reputation?.power_seller_status ||
      null,
  };

  // 7. Quantities
  const availableQuantity =
    typeof raw.available_quantity === "number"
      ? raw.available_quantity
      : (typeof buyBox?.available_quantity === "number" ? buyBox.available_quantity : null);

  const soldQuantity =
    typeof raw.sold_quantity === "number"
      ? raw.sold_quantity
      : (typeof buyBox?.sold_quantity === "number" ? buyBox.sold_quantity : null);

  // 8. Attributes
  const attributesRaw = Array.isArray(raw.attributes)
    ? raw.attributes
    : (Array.isArray(productData?.attributes) ? productData.attributes : []);

  const attributes = attributesRaw.slice(0, 25).map((attr: any) => ({
    id: attr.id,
    name: String(attr.name || attr.id || "Atributo"),
    value: attr.value_name ? String(attr.value_name) : (attr.values?.[0]?.name ? String(attr.values[0].name) : null),
  }));

  // 9. Catalog Product ID
  const effectiveCatalogProductId =
    catalogProductId ||
    raw.catalog_product_id ||
    productData?.id ||
    null;

  // 10. Check unavailable fields
  const unavailableFields: string[] = [];
  if (!seller.id || !seller.nickname) unavailableFields.push("seller");
  if (soldQuantity === null) unavailableFields.push("soldQuantity");
  if (!description) unavailableFields.push("description");
  if (!listingTypeId) unavailableFields.push("listingTypeId");
  if (shipping.freeShipping === null) unavailableFields.push("shipping");

  const isPartial = unavailableFields.length > 0;

  return {
    sourceId,
    sourceType,
    title,
    price,
    originalPrice,
    currencyId,
    permalink,
    thumbnail,
    listingTypeId,
    shipping,
    seller,
    availableQuantity,
    soldQuantity,
    attributes,
    description: description || null,
    catalogProductId: effectiveCatalogProductId,
    resolution: {
      source: resolutionSource,
      partial: isPartial,
      unavailableFields,
    },
  };
}

/**
 * Validates whether the CompetitorSnapshot satisfies minimum viable fields
 * for strategic benchmarking analysis with Gemini.
 */
export function validateCompetitorSnapshot(snapshot: CompetitorSnapshot): {
  valid: boolean;
  missingCriticalFields: string[];
} {
  const missingCriticalFields: string[] = [];

  if (!snapshot.title || !snapshot.title.trim()) {
    missingCriticalFields.push("title");
  }

  if (snapshot.price === null || isNaN(snapshot.price) || snapshot.price <= 0) {
    missingCriticalFields.push("price");
  }

  return {
    valid: missingCriticalFields.length === 0,
    missingCriticalFields,
  };
}
