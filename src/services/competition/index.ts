import { refreshMeliToken } from "../meli/refreshToken";

export async function getCompetitorPrices(tenantId: string, query: string, categoryId?: string) {
  const accessToken = await refreshMeliToken(tenantId);

  let url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=10`;
  if (categoryId) {
    url += `&category=${categoryId}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) return null;

  const data = await response.json();
  const prices = data.results.map((r: any) => r.price).filter((p: number) => typeof p === "number");

  if (prices.length === 0) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

  return {
    min,
    max,
    avg: Math.round(avg),
    samples: prices.length
  };
}

export async function analyzeMarketPosition(tenantId: string, myPrice: number, query: string, categoryId?: string) {
  const market = await getCompetitorPrices(tenantId, query, categoryId);
  if (!market) return null;

  let suggestion = "Mantener precio actual";
  let action = "none";
  let suggestedPrice = myPrice;

  // Simple heuristic
  if (myPrice > market.avg * 1.1) {
    suggestion = `Tu precio está alto. Podrías bajar a $${market.avg} (promedio).`;
    action = "decrease";
    suggestedPrice = market.avg;
  } else if (myPrice < market.avg * 0.9) {
    suggestion = `Tu precio está muy bajo. Podrías subir a $${market.avg} y ganar margen.`;
    action = "increase";
    suggestedPrice = market.avg;
  }

  return {
    market,
    suggestion,
    action,
    suggestedPrice
  };
}
