// src/services/pricing/calculateTargetPrice.ts
/**
 * Calcula el precio objetivo para alcanzar el margen deseado.
 * @param costComponents - objeto con costos: baseCost, commissionRate, shippingCost, taxRate, promotionDiscount
 * @param targetMarginPercent - margen objetivo en porcentaje (0-100)
 * @returns targetPrice - precio objetivo calculado
 */
export function calculateTargetPrice(
  costComponents: {
    baseCost: number;
    commissionRate: number; // porcentaje
    shippingCost: number;
    taxRate: number; // porcentaje
    promotionDiscount?: number; // monto absoluto
  },
  targetMarginPercent: number,
): number {
  // Usa iteración simple para encontrar el precio que satisface el margen objetivo.
  let price = 0;
  const maxIter = 100;
  for (let i = 0; i < maxIter; i++) {
    const commission = (price * costComponents.commissionRate) / 100;
    const tax = ((price + commission) * costComponents.taxRate) / 100;
    const totalCost =
      costComponents.baseCost +
      commission +
      costComponents.shippingCost +
      tax -
      (costComponents.promotionDiscount ?? 0);
    // Si price es 0 evitamos división por cero.
    if (price <= 0) {
      price = totalCost * 1.01; // pequeño margen inicial
      continue;
    }
    const margin = ((price - totalCost) / price) * 100;
    const diff = targetMarginPercent - margin;
    if (Math.abs(diff) < 0.01) break;
    // Ajuste proporcional (Newton‑Raphson simplificado)
    price += price * (diff / 100);
    if (price <= 0) price = totalCost * 1.01;
  }
  return Number(price.toFixed(2));
}
