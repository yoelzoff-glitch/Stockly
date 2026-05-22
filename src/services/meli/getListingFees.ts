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
  access_token: string
): Promise<MeliFeeResponse | null> {
  try {
    const url = `https://api.mercadolibre.com/sites/${site_id}/listing_prices?price=${price}&category_id=${category_id}&listing_type_id=${listing_type_id}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.warn(`[Meli API] getListingFees failed with status ${response.status} for category ${category_id}`);
      return null;
    }

    const data = await response.json();

    // La API de listing_prices devuelve un array con un objeto, o un objeto directo dependiendo del caso.
    // Usualmente es un array con las fee de publicación (si aplica) y comisiones de venta.
    const results = Array.isArray(data) ? data : [data];

    let totalFee = 0;
    let currencyId = "ARS";

    for (const fee of results) {
      // Usualmente sale_fee_amount es la comisión de venta. 
      if (fee.sale_fee_amount) {
        totalFee += fee.sale_fee_amount;
        currencyId = fee.currency_id || currencyId;
      }
    }

    // Calcular un porcentaje si existe totalFee
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
