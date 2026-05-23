import { BusinessProblem } from "./planner";

/**
 * Representa una acción sugerida y preparada de manera automática para resolver un problema de negocio.
 */
export interface SuggestedAction {
  action_type: "update_stock" | "update_price" | "pause_product";
  product_id: string;
  product_title: string;
  sku: string | null;
  reason: string;
  proposed_value: any;
}

/**
 * Traduce una lista de problemas diagnosticados en recomendaciones de acción concretas.
 * - Advertencias de stock y quiebres $\rightarrow$ Sugiere actualizar/reponer stock a 20 unidades.
 * - Productos estancados sin ventas $\rightarrow$ Sugiere pausar la publicación.
 * - Márgenes bajos $\rightarrow$ Sugiere subir el precio un 15% para absorber la pérdida.
 * 
 * @param problems Lista de problemas comerciales diagnosticados
 * @returns Lista de acciones sugeridas que pueden estructurarse en un workflow transaccional
 */
export function generateRecommendations(problems: BusinessProblem[]): SuggestedAction[] {
  const recommendations: SuggestedAction[] = [];

  for (const problem of problems) {
    if (problem.type === "low_stock" || problem.type === "stock_out_warning") {
      recommendations.push({
        action_type: "update_stock",
        product_id: problem.product_id,
        product_title: problem.product_title,
        sku: problem.sku,
        reason: problem.details,
        proposed_value: 20, // Sugerimos reponer a 20 unidades
      });
    }

    if (problem.type === "no_sales" || problem.type === "dead_product") {
      recommendations.push({
        action_type: "pause_product",
        product_id: problem.product_id,
        product_title: problem.product_title,
        sku: problem.sku,
        reason: problem.details,
        proposed_value: "paused",
      });
    }

    if (problem.type === "low_margin") {
      // Calcular un aumento del 15% para mejorar margen
      recommendations.push({
        action_type: "update_price",
        product_id: problem.product_id,
        product_title: problem.product_title,
        sku: problem.sku,
        reason: problem.details,
        proposed_value: { percentageChange: 15 }, 
      });
    }
  }

  return recommendations;
}
