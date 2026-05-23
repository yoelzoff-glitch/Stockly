import { meliFetch } from "./client";

export interface MeliFeeResponse {
  sale_fee_amount: number;
  sale_fee_percent?: number;
  currency_id: string;
  raw_response: any;
}

export async function getListingFees(
  site_id: string,
  price: number,
  category_id: string,
  listing_type_id: string,
  tenantId: string
): Promise<MeliFeeResponse | null> {
  try {
    const endpoint = `/sites/${site_id}/listing_prices?price=${price}&category_id=${category_id}&listing_type_id=${listing_type_id}`;
    
    const data = await meliFetch({
      tenantId,
      endpoint,
      method: "GET"
    });

    const results = Array.isArray(data) ? data : [data];

    let totalFee = 0;
    let currencyId = "ARS";

    for (const fee of results) {
      if (fee.sale_fee_amount) {
        totalFee += fee.sale_fee_amount;
        currencyId = fee.currency_id || currencyId;
      }
      if (fee.financing_fee_amount) {
        totalFee += fee.financing_fee_amount;
      }
      if (fee.sale_fee_details?.financing_add_on_fee) {
        totalFee += fee.sale_fee_details.financing_add_on_fee;
      }
    }

    const percent = price > 0 ? (totalFee / price) * 100 : 0;

    return {
      sale_fee_amount: totalFee,
      sale_fee_percent: parseFloat(percent.toFixed(2)),
      currency_id: currencyId,
      raw_response: data
    };

  } catch (error) {
    console.error("[Meli API] Exception in getListingFees:", error);
    return null;
  }
}
