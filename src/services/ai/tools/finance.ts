import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Obtiene un resumen financiero completo calculando facturación, costos, comisiones,
 * envíos, cancelaciones y margen neto para un período de tiempo determinado.
 * 
 * @param tenantId Identificador del comercio
 * @param daysStr Cantidad de días hacia atrás a analizar (por defecto 30)
 * @returns Promesa que resuelve en un string formateado con el resumen financiero
 */
export async function getFinancialSummary(tenantId: string, daysStr: string = "30") {
  const supabase = createAdminClient();
  const days = parseInt(daysStr) || 30;

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, total_quantity, product_title, meli_product_id")
    .eq("tenant_id", tenantId)
    .eq("status", "paid")
    .gte("date_created", dateFrom.toISOString());

  const { data: products } = await supabase
    .from("products")
    .select("meli_item_id, title, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("refund_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", dateFrom.toISOString());

  if (!orders || !products) {
    return "Error al calcular las finanzas. No se pudieron obtener los datos.";
  }

  let facturacion = 0;
  let costos = 0;
  let comisiones = 0;
  let envios = 0;
  let extra = 0;
  let unitsSold = 0;
  let unitsWithCost = 0;

  const productAgg: Record<string, { revenue: number, net: number, cost: number }> = {};

  orders.forEach(o => {
    const amount = Number(o.total_amount) || 0;
    const qty = Number(o.total_quantity) || 1;
    facturacion += amount;
    unitsSold += qty;

    const p = products.find(prod => prod.meli_item_id === o.meli_product_id || prod.title === o.product_title);
    
    let cost = 0;
    let fee = 0;
    let shipping = 0;
    let ext = 0;

    if (p) {
      if (p.cost) {
        cost = Number(p.cost) * qty;
        unitsWithCost += qty;
      }
      fee = Number(p.estimated_fee || 0) * qty;
      shipping = Number(p.estimated_shipping_cost || 0) * qty;
      ext = (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * qty;
    }

    costos += cost;
    comisiones += fee;
    envios += shipping;
    extra += ext;

    const title = p?.title || o.product_title || "Varios";
    if (!productAgg[title]) {
      productAgg[title] = { revenue: 0, net: 0, cost: 0 };
    }
    productAgg[title].revenue += amount;
    productAgg[title].cost += cost;
    productAgg[title].net += (amount - cost - fee - shipping - ext);
  });

  const cancelaciones = cancellations?.reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0) || 0;

  const gananciaNeta = facturacion - costos - comisiones - envios - extra - cancelaciones;
  const margenNeto = facturacion > 0 ? (gananciaNeta / facturacion) * 100 : 0;
  const precision = unitsSold > 0 ? (unitsWithCost / unitsSold) * 100 : 100;

  const topProductByMargin = Object.entries(productAgg).sort((a, b) => b[1].net - a[1].net)[0];
  const worstProductByMargin = Object.entries(productAgg).sort((a, b) => a[1].net - b[1].net)[0];

  return `
Resumen Financiero (Últimos ${days} días):
Facturación Bruta: $${facturacion.toLocaleString("es-AR")}
Costos de Productos: $${costos.toLocaleString("es-AR")}
Comisiones ML: $${comisiones.toLocaleString("es-AR")}
Envíos: $${envios.toLocaleString("es-AR")}
Promociones y Cuotas: $${extra.toLocaleString("es-AR")}
Cancelaciones: $${cancelaciones.toLocaleString("es-AR")}

Ganancia Neta: $${gananciaNeta.toLocaleString("es-AR")}
Margen Neto: ${margenNeto.toFixed(1)}%

Precisión del cálculo: ${precision.toFixed(1)}% de las ventas tenían costo cargado. ${precision < 95 ? "¡Atención! Ganancia posiblemente sobreestimada." : ""}

Producto que deja más ganancia neta: ${topProductByMargin ? topProductByMargin[0] + ` ($${topProductByMargin[1].net.toLocaleString("es-AR")})` : "N/A"}
Producto que come más margen / deja menos ganancia neta: ${worstProductByMargin ? worstProductByMargin[0] + ` ($${worstProductByMargin[1].net.toLocaleString("es-AR")})` : "N/A"}
  `;
}
