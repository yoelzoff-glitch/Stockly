import { createAdminClient } from "@/lib/supabase/admin";
import { predictStockOut } from "../predictions";
import { detectDeadProducts } from "../analytics/deadProducts";

export type ProblemSeverity = "low" | "medium" | "critical";

export interface BusinessProblem {
  type: "low_stock" | "low_margin" | "no_sales" | "dead_product" | "stock_out_warning";
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
    .select("id, title, sku, price, cost, available_quantity, sold_quantity, status, margin_percent")
    .eq("tenant_id", tenantId)
    .eq("status", "active");

  if (error || !products) {
    return problems;
  }

  // 1. Check dead products
  const deadProducts = await detectDeadProducts(tenantId);
  const deadIds = new Set(deadProducts.map(d => d.product_id));
  
  for (const dp of deadProducts) {
    problems.push({
      type: "dead_product",
      severity: "medium",
      product_id: dp.product_id,
      product_title: dp.title,
      sku: null,
      details: dp.reason,
    });
  }

  // 2. Check stock out predictions
  const stockOuts = await predictStockOut(tenantId);
  for (const so of stockOuts) {
    problems.push({
      type: "stock_out_warning",
      severity: so.estimated_days_remaining <= 3 ? "critical" : "medium",
      product_id: so.product_id,
      product_title: so.title,
      sku: null,
      details: `Riesgo de quiebre de stock en ${so.estimated_days_remaining} días.`,
    });
  }

  // 3. Basic analysis for remaining properties
  for (const product of products) {
    // Low margin (using the new margin_percent field from Sprint 12B)
    if (product.margin_percent !== null && product.margin_percent !== undefined) {
      if (product.margin_percent < 15) {
        problems.push({
          type: "low_margin",
          severity: product.margin_percent <= 5 ? "critical" : "medium",
          product_id: product.id,
          product_title: product.title,
          sku: product.sku,
          details: `Margen bajo: ${product.margin_percent.toFixed(1)}%.`,
        });
      }
    }
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 1, medium: 2, low: 3 };
  problems.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return problems;
}

