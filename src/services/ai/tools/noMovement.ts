export async function getNoMovementProducts(tenantId: string, filter: { days: number }) {
  const { getNoMovementProducts: getNoMovement } = await import('@/services/analytics/noMovementProducts');
  const items = await getNoMovement(tenantId, { days: filter.days });
  
  if (!items || items.length === 0) {
    return { success: true, message: `No se encontraron productos sin movimiento en los últimos ${filter.days} días.` };
  }
  
  return {
    success: true,
    total: items.length,
    products: items.slice(0, 50).map(p => ({
      product_id: p.id,
      title: p.title,
      price: p.price,
      stock: p.available_quantity,
      cost: p.cost,
      immobilizedCost: p.immobilizedCost,
      daysWithoutSales: p.daysWithoutSales,
      recommendation: p.recommendation
    }))
  };
}
