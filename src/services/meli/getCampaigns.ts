import { meliFetch } from "./client";

export interface MeliCampaignResponse {
  campaign_id: string;
  campaign_type: string;
  fee_extra: number;
  installments: number;
  status: string;
  raw_data: any;
}

export async function getCampaigns(
  item_id: string,
  user_id: string,
  tenantId: string
): Promise<MeliCampaignResponse[]> {
  try {
    const endpoint = `/seller-promotions/items/${item_id}?app_version=v2`;
    
    const data = await meliFetch({
      tenantId,
      endpoint,
      method: "GET"
    });

    const campaigns: MeliCampaignResponse[] = [];
    const results = Array.isArray(data) ? data : (data.results || [data]);

    for (const promo of results) {
      if (promo.type === "CUOTA_SIMPLE" || promo.type === "INSTALLMENT_CAMPAIGN" || promo.type === "AHORA_12" || promo.id) {
        campaigns.push({
          campaign_id: promo.id || promo.promotion_id || "unknown",
          campaign_type: promo.type || "unknown",
          fee_extra: promo.fee_amount || promo.extra_fee || 0,
          installments: promo.installments || 0,
          status: promo.status || "active",
          raw_data: promo
        });
      }
    }

    return campaigns;

  } catch (error) {
    console.error(`[Meli API] Exception in getCampaigns for ${item_id}:`, error);
    return [];
  }
}
