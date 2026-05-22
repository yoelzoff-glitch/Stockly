export function normalizeCompetitors(ownPrice: number, competitors: any[]) {
  if (competitors.length === 0) {
    return {
      min_price: 0,
      max_price: 0,
      avg_price: 0,
      median_price: 0,
      diff_to_avg: 0,
      diff_percent: 0,
      competitors_count: 0,
      free_shipping_count: 0
    };
  }

  const prices = competitors.map(c => c.price).filter(p => typeof p === "number" && !isNaN(p));
  prices.sort((a, b) => a - b);

  const min_price = prices[0];
  const max_price = prices[prices.length - 1];
  const avg_price = prices.reduce((acc, curr) => acc + curr, 0) / prices.length;
  
  let median_price = 0;
  const mid = Math.floor(prices.length / 2);
  if (prices.length % 2 === 0) {
    median_price = (prices[mid - 1] + prices[mid]) / 2;
  } else {
    median_price = prices[mid];
  }

  const diff_to_avg = ownPrice - avg_price;
  const diff_percent = (diff_to_avg / avg_price) * 100;
  
  const free_shipping_count = competitors.filter(c => c.free_shipping).length;

  return {
    min_price: Number(min_price.toFixed(2)),
    max_price: Number(max_price.toFixed(2)),
    avg_price: Number(avg_price.toFixed(2)),
    median_price: Number(median_price.toFixed(2)),
    diff_to_avg: Number(diff_to_avg.toFixed(2)),
    diff_percent: Number(diff_percent.toFixed(2)),
    competitors_count: competitors.length,
    free_shipping_count
  };
}
