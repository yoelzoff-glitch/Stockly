import { meliFetch } from "./client";

export interface MeliPromotionResponse {
  promotion_id: string;
  discount_percent: number;
  discount_amount: number;
  status: string;
  raw_data: any;
}

export async function getPromotions(
  item_id: string,
  user_id: string,
  tenantId: string
): Promise<MeliPromotionResponse[]> {
  try {
    const endpoint = `/seller-promotions/items/${item_id}?app_version=v2`;
    
    const data = await meliFetch({
      tenantId,
      endpoint,
      method: "GET"
    });

    const promotions: MeliPromotionResponse[] = [];
    const results = Array.isArray(data) ? data : (data.results || [data]);

    for (const promo of results) {
      if (promo.type === "DEAL" || promo.type === "MARKETPLACE_CAMPAIGN" || promo.type === "VOLUME" || promo.type === "PRE_NEGOTIATED") {
        
        let discountPercent = promo.discount_percentage || 0;
        let discountAmount = promo.discount_amount || 0;
        
        if (promo.benefits && promo.benefits.type === "DISCOUNT") {
          discountPercent = promo.benefits.discount_percentage || discountPercent;
        }

        promotions.push({
          promotion_id: promo.id || promo.promotion_id || "unknown",
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          status: promo.status || "active",
          raw_data: promo
        });
      }
    }

    return promotions;

  } catch (error) {
    console.error(`[Meli API] Exception in getPromotions for ${item_id}:`, error);
    return [];
  }
}
