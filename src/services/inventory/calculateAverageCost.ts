// src/services/inventory/calculateAverageCost.ts

/**
 * Calcula el costo promedio ponderado de un item de inventario tras una nueva compra.
 * 
 * Regla:
 * Si ya hay stock y costo promedio:
 * new_average = ((old_stock * old_average_cost) + (new_quantity * new_unit_cost)) / (old_stock + new_quantity)
 * 
 * Si no hay costo nuevo o es nulo:
 * - no modificar average_cost
 * 
 * @param oldStock Stock actual antes de aplicar la compra (puede ser 0 o negativo)
 * @param oldAverageCost Costo promedio actual antes de la compra
 * @param newQuantity Cantidad de la nueva compra
 * @param newUnitCost Costo de la nueva compra
 */
export function calculateAverageCost(
  oldStock: number,
  oldAverageCost: number | null,
  newQuantity: number,
  newUnitCost: number | null
): { averageCost: number | null; lastPurchaseCost: number | null } {
  // Si no se especifica un costo nuevo, preservamos el costo promedio anterior
  if (newUnitCost === null || newUnitCost === undefined) {
    return {
      averageCost: oldAverageCost,
      lastPurchaseCost: oldAverageCost
    };
  }

  const cleanOldStock = oldStock > 0 ? oldStock : 0;
  const cleanOldAvgCost = oldAverageCost && oldAverageCost > 0 ? oldAverageCost : 0;

  // Si no hay stock previo o no teníamos costo promedio previo configurado,
  // el nuevo costo unitario se convierte directamente en el costo promedio.
  if (cleanOldStock === 0 || !oldAverageCost || oldAverageCost === 0) {
    return {
      averageCost: newUnitCost,
      lastPurchaseCost: newUnitCost
    };
  }

  const totalOldCost = cleanOldStock * cleanOldAvgCost;
  const totalNewCost = newQuantity * newUnitCost;
  const totalQuantity = cleanOldStock + newQuantity;

  const newAverage = totalQuantity > 0 ? (totalOldCost + totalNewCost) / totalQuantity : newUnitCost;

  return {
    averageCost: Number(newAverage.toFixed(2)),
    lastPurchaseCost: newUnitCost
  };
}
