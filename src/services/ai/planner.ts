import { createAdminClient } from "@/lib/supabase/admin";

export type ProblemSeverity = "low" | "medium" | "critical";

export interface BusinessProblem {
  type: "low_stock" | "low_margin" | "no_sales";
  severity: ProblemSeverity;
  product_id: string;
  product_title: string;
  sku: string | null;
  details: string;
}

export async function analyzeBusiness(tenantId: string): Promise<BusinessProblem[]> {
  const supabase = createAdminClient();
  const problems: BusinessProblem[] = [];

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, sku, price, cost, available_quantity, sold_quantity, status")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (error || !products) {
    return problems;
  }

  for (const product of products) {
    // 1. Low stock
    if (product.available_quantity <= 5 && product.available_quantity > 0) {
      problems.push({
        type: "low_stock",
        severity: product.available_quantity <= 2 ? "critical" : "medium",
        product_id: product.id,
        product_title: product.title,
        sku: product.sku,
        details: `Stock crítico: Solo quedan ${product.available_quantity} unidades.`,
      });
    }

    // 2. No sales
    if (product.sold_quantity === 0 && product.available_quantity > 0) {
      problems.push({
        type: "no_sales",
        severity: "low",
        product_id: product.id,
        product_title: product.title,
        sku: product.sku,
        details: "El producto no tiene ventas registradas.",
      });
    }

    // 3. Low margin
    if (product.cost && product.cost > 0 && product.price > 0) {
      const margin = (product.price - product.cost) / product.price;
      if (margin < 0.15) {
        problems.push({
          type: "low_margin",
          severity: margin <= 0.05 ? "critical" : "medium",
          product_id: product.id,
          product_title: product.title,
          sku: product.sku,
          details: `Margen bajo: ${(margin * 100).toFixed(1)}%. Precio: $${product.price}, Costo: $${product.cost}.`,
        });
      }
    }
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 1, medium: 2, low: 3 };
  problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return problems;
}
