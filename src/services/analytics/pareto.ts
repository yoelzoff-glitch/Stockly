import { createAdminClient } from "@/lib/supabase/admin";

export interface ParetoProduct {
  product_id?: string;
  title: string;
  sku?: string;
  revenue: number;
  units_sold: number;
  cumulative_revenue: number;
  cumulative_percentage: number;
  is_pareto: boolean;
}

export interface ParetoAnalysisResult {
  totalRevenue: number;
  totalProductsSold: number;
  productsToReach80: number;
  percentageOfCatalog: number;
  paretoProducts: ParetoProduct[];
  longTailProducts: ParetoProduct[];
}

export async function getParetoAnalysis({
  tenantId,
  dateFrom,
  dateTo
}: {
  tenantId: string;
  dateFrom?: Date;
  dateTo?: Date;
}): Promise<ParetoAnalysisResult> {
  const supabase = createAdminClient();

  let query = supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .neq("status", "cancelled");

  if (dateFrom) {
    query = query.gte("date_created", dateFrom.toISOString());
  }
  if (dateTo) {
    query = query.lte("date_created", dateTo.toISOString());
  }

  const { data: orders, error } = await query;

  if (error || !orders) {
    console.error("Error fetching orders for pareto:", error);
    return {
      totalRevenue: 0,
      totalProductsSold: 0,
      productsToReach80: 0,
      percentageOfCatalog: 0,
      paretoProducts: [],
      longTailProducts: []
    };
  }

  // Aggregate by product
  const productAgg: Record<string, { title: string, revenue: number, units: number, product_id?: string }> = {};

  let totalRevenue = 0;
  let totalUnits = 0;

  for (const order of orders) {
    const title = order.product_title || "Otros";
    const amount = Number(order.total_amount) || 0;
    const qty = Number(order.total_quantity) || 1;

    totalRevenue += amount;
    totalUnits += qty;

    if (!productAgg[title]) {
      productAgg[title] = { title, revenue: 0, units: 0, product_id: order.meli_product_id };
    }
    productAgg[title].revenue += amount;
    productAgg[title].units += qty;
  }

  // Convert to array and sort by revenue desc
  const sortedProducts = Object.values(productAgg).sort((a, b) => b.revenue - a.revenue);

  let cumulativeRevenue = 0;
  const paretoProducts: ParetoProduct[] = [];
  const longTailProducts: ParetoProduct[] = [];

  let reached80 = false;
  let productsToReach80 = 0;

  for (const p of sortedProducts) {
    cumulativeRevenue += p.revenue;
    const cumulative_percentage = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 0;
    
    const isPareto = !reached80 && cumulative_percentage <= 80;
    
    if (isPareto || (cumulative_percentage > 80 && !reached80)) {
       // Include the one that crosses the 80 threshold as pareto as well
    }

    const product: ParetoProduct = {
      product_id: p.product_id,
      title: p.title,
      revenue: p.revenue,
      units_sold: p.units,
      cumulative_revenue: cumulativeRevenue,
      cumulative_percentage,
      is_pareto: !reached80
    };

    if (!reached80) {
      paretoProducts.push(product);
      productsToReach80++;
      if (cumulative_percentage >= 80) {
        reached80 = true;
      }
    } else {
      longTailProducts.push(product);
    }
  }

  const percentageOfCatalog = sortedProducts.length > 0 
    ? (productsToReach80 / sortedProducts.length) * 100 
    : 0;

  return {
    totalRevenue,
    totalProductsSold: totalUnits,
    productsToReach80,
    percentageOfCatalog,
    paretoProducts,
    longTailProducts
  };
}
