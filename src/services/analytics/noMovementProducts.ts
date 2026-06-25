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
  }

  if (filter.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }

  const { data: allProducts, error } = await query;
  
  if (error || !allProducts) {
    return [];
  }

  // Helper to identify products by SKU or a fallback unique identifier if no SKU exists
  const getProductSku = (p: Product) => (p.sku && p.sku.trim() !== "") ? p.sku.trim() : `NO_SKU_${p.id}`;

  // Find all SKUs that had sales (were sold in the period)
  const soldSkus = new Set<string>();
  allProducts.forEach((p) => {
    if (soldProductIds.has(p.id)) {
      soldSkus.add(getProductSku(p));
    }
  });

  // Filter products without movement: exclude any product whose SKU has had sales
  const stagnantProducts = allProducts.filter((p) => !soldSkus.has(getProductSku(p)));

  // Group stagnant products by SKU key
  const groupedProducts: Record<string, Product[]> = {};
  stagnantProducts.forEach((p) => {
    const skuKey = getProductSku(p);
    if (!groupedProducts[skuKey]) {
      groupedProducts[skuKey] = [];
    }
    groupedProducts[skuKey].push(p);
  });

  // Representative sorting: prioritize active status, then highest stock, then highest price
  const getRepresentativeProduct = (products: Product[]): Product => {
    return [...products].sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      if ((a.available_quantity || 0) !== (b.available_quantity || 0)) {
        return (b.available_quantity || 0) - (a.available_quantity || 0);
      }
      return (b.price || 0) - (a.price || 0);
    })[0];
  };

  // Convert groups to representative/aggregated products
  let aggregatedProducts: Product[] = Object.values(groupedProducts).map((group) => {
    const rep = getRepresentativeProduct(group);
    const totalAvailableQuantity = group.reduce((sum, p) => sum + (p.available_quantity || 0), 0);
    const totalSoldQuantity = group.reduce((sum, p) => sum + (p.sold_quantity || 0), 0);
    
    const earliestCreatedAt = group.reduce((earliest, p) => {
      return new Date(p.created_at) < new Date(earliest) ? p.created_at : earliest;
    }, rep.created_at);

    return {
      ...rep,
      available_quantity: totalAvailableQuantity,
      sold_quantity: totalSoldQuantity,
      created_at: earliestCreatedAt,
    };
  });

  // Apply JS-side filters on the aggregated/grouped data
  // Minimum Stock
  if (filter.minStock !== undefined) {
    aggregatedProducts = aggregatedProducts.filter((p) => p.available_quantity >= (filter.minStock as number));
  }

  // Has Cost
  if (filter.hasCost !== undefined) {
    if (filter.hasCost) {
      aggregatedProducts = aggregatedProducts.filter((p) => p.cost !== null && p.cost !== undefined);
    } else {
      aggregatedProducts = aggregatedProducts.filter((p) => p.cost === null || p.cost === undefined);
    }
  }

  // 5. Calculate metrics and recommendations
  const enrichedProducts: NoMovementProduct[] = aggregatedProducts.map((p) => {
    const skuKey = getProductSku(p);
    const group = groupedProducts[skuKey] || [p];
    
    // Sum immobilized cost across all publications in the group
    const immobilizedCost = group.reduce((sum, item) => sum + (item.cost || 0) * (item.available_quantity || 0), 0);

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
