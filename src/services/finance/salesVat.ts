export const SALES_VAT_RATES = [0, 2.5, 5, 10.5, 21, 27] as const;

export interface SalesVatSettings { enabled: boolean; rate: number }
export interface SalesVatOrder {
  id: string;
  meli_order_id: string | number | null;
  total_amount: number | string | null;
  status: string | null;
  currency_id: string | null;
}
export interface SalesVatSummary {
  gross: number;
  net: number;
  vat: number;
  count: number;
  excluded: number;
}

/** Prices already include VAT. Round each order to cents before accumulating. */
export function calculateSalesVat(
  orders: SalesVatOrder[], rate: number, ignoredOrderIds: string[] = [],
): SalesVatSummary {
  if (!SALES_VAT_RATES.some(value => value === rate)) throw new Error("Alícuota inválida");
  const ignored = new Set(ignoredOrderIds.map(String));
  let grossCents = 0;
  let vatCents = 0;
  let count = 0;
  let excluded = 0;
  for (const order of orders) {
    const amount = Number(order.total_amount);
    if (order.status !== "paid" || order.currency_id !== "ARS" ||
        order.total_amount === null || !Number.isFinite(amount) || amount < 0 ||
        ignored.has(order.id) || ignored.has(String(order.meli_order_id))) {
      excluded++;
      continue;
    }
    const cents = Math.round(amount * 100);
    grossCents += cents;
    vatCents += Math.round(cents * rate / (100 + rate));
    count++;
  }
  return { gross: grossCents / 100, net: (grossCents - vatCents) / 100,
    vat: vatCents / 100, count, excluded };
}
