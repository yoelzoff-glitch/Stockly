export interface MeliShippingEstimate {
  estimated_shipping_cost: number | null;
  currency_id: string | null;
  raw_response: any;
}

export async function getShippingCostEstimate(
  meli_item_id: string,
  access_token: string,
  prefetchedShipping?: any,
  prefetchedSellerId?: number,
  prefetchedCurrencyId?: string
): Promise<MeliShippingEstimate> {
  try {
    let shipping = prefetchedShipping;
    let sellerId = prefetchedSellerId;
    let currencyId = prefetchedCurrencyId || "ARS";
    let rawResponse: any = null;

    if (!shipping) {
      // 1. Obtener detalles del ítem para ver su configuración de envío (solo si no fue pre-cargado)
      const itemUrl = `https://api.mercadolibre.com/items/${meli_item_id}`;
      const itemRes = await fetch(itemUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      });

      if (!itemRes.ok) return { estimated_shipping_cost: null, currency_id: null, raw_response: null };

      const itemData = await itemRes.json();
      shipping = itemData.shipping;
      sellerId = itemData.seller_id;
      currencyId = itemData.currency_id;
      rawResponse = itemData;
    }

    if (!shipping) return { estimated_shipping_cost: null, currency_id: currencyId, raw_response: rawResponse };

    // Si el envío no es gratis, el vendedor no asume costo de envío base (generalmente)
    if (!shipping.free_shipping) {
      return {
        estimated_shipping_cost: 0,
        currency_id: currencyId,
        raw_response: { mode: shipping.mode, free_shipping: false }
      };
    }

    // Si el envío es gratis, ML tiene un endpoint para consultar el costo exacto a cargo del vendedor:
    // GET /users/{user_id}/shipping_options/free?item_id={item_id}
    if (sellerId) {
      const freeShippingUrl = `https://api.mercadolibre.com/users/${sellerId}/shipping_options/free?item_id=${meli_item_id}`;
      const freeRes = await fetch(freeShippingUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      });

      if (freeRes.ok) {
        const freeData = await freeRes.json();
        // Usualmente coverage.cost es el costo a pagar por el vendedor
        if (freeData && freeData.coverage && freeData.coverage.all_country) {
          return {
            estimated_shipping_cost: freeData.coverage.all_country.list_cost || freeData.coverage.all_country.billable_weight_cost || null,
            currency_id: freeData.coverage.all_country.currency_id || currencyId,
            raw_response: freeData
          };
        }
      }
    }

    // Fallback: Sabemos que es gratis pero no pudimos obtener el costo
    return {
      estimated_shipping_cost: null,
      currency_id: currencyId,
      raw_response: { free_shipping: true, detail: "Cost endpoint failed" }
    };

  } catch (error) {
    console.error(`[Meli API] Error in getShippingCostEstimate for ${meli_item_id}:`, error);
    return { estimated_shipping_cost: null, currency_id: null, raw_response: { error: String(error) } };
  }
}
