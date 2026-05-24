import { createAdminClient } from "@/lib/supabase/admin";
import { Product } from "@/types/product";

export interface NoMovementFilter {
  days: number;
  minStock?: number;
  hasCost?: boolean;
  status?: string;
  categoryId?: string;
}

export interface NoMovementProduct extends Product {
  daysWithoutSales: number;
  immobilizedCost: number;
  recommendation: string;
}

export async function getNoMovementProducts(tenantId: string, filter: NoMovementFilter): Promise<NoMovementProduct[]> {
  const supabase = createAdminClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - filter.days);

  // 1. Get all recent orders
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("id, date_created")
    .eq("tenant_id", tenantId)
    .gte("date_created", startDate.toISOString());

  const recentOrderIds = recentOrders?.map((o) => o.id) || [];

  // 2. Get product IDs that WERE sold
  const soldProductIds = new Set<string>();
  if (recentOrderIds.length > 0) {
    const { data: recentItems } = await supabase
      .from("order_items")
      .select("product_id")
      .eq("tenant_id", tenantId)
      .in("order_id", recentOrderIds);
    
    recentItems?.forEach((item) => {
      if (item.product_id) soldProductIds.add(item.product_id);
    });
  }

  // 3. Fetch products based on filters
  let query = supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId);

  if (filter.status) {
    query = query.eq("status", filter.status);
  } else {
    // Default: only active products (or paused if we want to see them)
    // We will bring all and filter or just active
  }

  if (filter.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }

  const { data: allProducts, error } = await query;
  
  if (error || !allProducts) {
    return [];
  }

  // 4. Filter products without movement and apply JS-side filters
  let stagnantProducts = allProducts.filter((p) => !soldProductIds.has(p.id));

  // Minimum Stock
  if (filter.minStock !== undefined) {
    stagnantProducts = stagnantProducts.filter((p) => p.available_quantity >= (filter.minStock as number));
  }

  // Has Cost
  if (filter.hasCost !== undefined) {
    if (filter.hasCost) {
      stagnantProducts = stagnantProducts.filter((p) => p.cost !== null && p.cost !== undefined);
    } else {
      stagnantProducts = stagnantProducts.filter((p) => p.cost === null || p.cost === undefined);
    }
  }

  // 5. Calculate metrics and recommendations
  const enrichedProducts: NoMovementProduct[] = stagnantProducts.map((p) => {
    const immobilizedCost = (p.cost || 0) * (p.available_quantity || 0);
    
    // We assume if it hasn't sold in the period, daysWithoutSales is at least `filter.days`
    // If sold_quantity is 0, it never sold.
    let daysWithoutSales = filter.days;
    if (p.sold_quantity === 0) {
      const createdDaysAgo = Math.floor((new Date().getTime() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24));
      daysWithoutSales = Math.max(filter.days, createdDaysAgo);
    }

    let recommendation = "";
    if (p.status === "paused") {
      recommendation = "No requiere acción inmediata (Pausado)";
    } else if (p.cost === null || p.cost === undefined) {
      recommendation = "Sugerido: cargar costo antes de decidir";
    } else if (p.available_quantity > 10 && (p.margin_percent || 0) > 15) {
      recommendation = "Sugerido: crear promoción";
    } else if (p.available_quantity > 0) {
      recommendation = "Sugerido: revisar precio o pausar";
    } else if (p.sold_quantity > 0) {
      recommendation = "Sugerido: revisar publicación";
    } else {
      recommendation = "Sin recomendación clara";
    }

    return {
      ...p,
      daysWithoutSales,
      immobilizedCost,
      recommendation
    };
  });

  // Sort by highest immobilized cost, then by stock
  enrichedProducts.sort((a, b) => b.immobilizedCost - a.immobilizedCost || b.available_quantity - a.available_quantity);

  return enrichedProducts;
}
