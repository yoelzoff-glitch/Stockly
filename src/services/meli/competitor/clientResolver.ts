import { parseCompetitorUrl } from "./urlParser";

export interface ClientResolutionPayload {
  itemData?: any;
  productData?: any;
  sellerData?: any;
  description?: string;
  resolvedId?: string;
}

/**
 * Attempts public client-side resolution of Mercado Libre publications directly in the browser.
 * Operates purely on public endpoints without any tokens or tenant secrets.
 * Returns null silently if client networking fails or is blocked, allowing backend resolver to take over.
 */
export async function resolveCompetitorClient(
  url: string
): Promise<ClientResolutionPayload | null> {
  try {
    const parsed = parseCompetitorUrl(url);
    const { itemId, catalogProductId, probableType } = parsed;

    let itemData: any = null;
    let productData: any = null;
    let sellerData: any = null;
    let description = "";
    let resolvedId = itemId || catalogProductId || "";

    // 1. If Catalog URL
    if (probableType === "catalog" || catalogProductId) {
      const idsToTry = [catalogProductId || itemId || ""];
      if (idsToTry[0]?.startsWith("MLAU")) {
        idsToTry.push("MLA" + idsToTry[0].substring(4));
      }

      for (const idToTry of idsToTry) {
        if (!idToTry) continue;
        try {
          const res = await fetch(`https://api.mercadolibre.com/products/${idToTry}`);
          if (res.ok) {
            productData = await res.json();
            break;
          }
        } catch {
          // Ignore and continue
        }
      }

      if (productData) {
        const buyBoxItemId = productData.buy_box_winner?.item_id;
        if (buyBoxItemId) {
          resolvedId = buyBoxItemId;
          try {
            const itemRes = await fetch(`https://api.mercadolibre.com/items/${buyBoxItemId}`);
            if (itemRes.ok) {
              itemData = await itemRes.json();
            }
          } catch {
            // Non-blocking: we still have productData
          }
        }
      }
    } else if (itemId) {
      // 2. Standard Item
      try {
        const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
        if (itemRes.ok) {
          itemData = await itemRes.json();
          resolvedId = itemId;
        }
      } catch {
        // Continue to server
      }
    }

    if (!itemData && !productData) {
      return null;
    }

    // Optional client description
    const targetDescId = itemData?.id || resolvedId;
    if (targetDescId) {
      try {
        const descRes = await fetch(`https://api.mercadolibre.com/items/${targetDescId}/description`);
        if (descRes.ok) {
          const descJson = await descRes.json();
          description = descJson.plain_text || "";
        }
      } catch {
        // Non-blocking
      }
    }

    // Optional client seller
    const sellerId =
      itemData?.seller_id ||
      itemData?.seller?.id ||
      productData?.buy_box_winner?.seller_id;

    if (sellerId) {
      try {
        const sellerRes = await fetch(`https://api.mercadolibre.com/users/${sellerId}`);
        if (sellerRes.ok) {
          sellerData = await sellerRes.json();
        }
      } catch {
        // Non-blocking
      }
    }

    return {
      itemData,
      productData,
      sellerData,
      description,
      resolvedId,
    };
  } catch {
    return null;
  }
}
