import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Obtiene la fecha correspondiente al inicio del día (00:00:00) de una fecha dada
 * en una zona horaria específica, expresada en UTC.
 */
export function getMidnightInTimezone(date: Date, timezone: string = 'America/Argentina/Buenos_Aires'): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // "YYYY-MM-DD"
  const [year, month, day] = dateStr.split('-').map(Number);

  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = timeFormatter.formatToParts(utcDate);
  const pYear = Number(parts.find(p => p.type === 'year')?.value || year);
  const pMonth = Number(parts.find(p => p.type === 'month')?.value || month);
  const pDay = Number(parts.find(p => p.type === 'day')?.value || day);
  const pHour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  
  const localTimeAsUtc = new Date(Date.UTC(pYear, pMonth - 1, pDay, pHour, 0, 0));
  const offsetMs = utcDate.getTime() - localTimeAsUtc.getTime();
  
  return new Date(utcDate.getTime() + offsetMs);
}

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

  // Obtener la zona horaria del tenant
  const { data: tenant } = await supabase.from("tenants").select("timezone").eq("id", tenantId).single();
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';

  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const dateFrom = getMidnightInTimezone(pastDate, timezone);

  // Obtener órdenes (sólo pagadas)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("tenant_id", tenantId)
    .eq("status", "paid")
    .gte("date_created", dateFrom.toISOString());

  // Obtener productos (para buscar costos y fees)
  const { data: products } = await supabase
    .from("products")
    .select("meli_item_id, title, cost, estimated_fee, estimated_shipping_cost, extra_fee_amount, promotion_discount_amount")
    .eq("tenant_id", tenantId);

  // Obtener cancelaciones
  const { data: cancellations } = await supabase
    .from("order_cancellations")
    .select("refund_amount")
    .eq("tenant_id", tenantId)
    .gte("created_at", dateFrom.toISOString());

  if (!orders || !products) {
    return "Error al calcular las finanzas. No se pudieron obtener los datos.";
  }

  // Obtener los detalles de productos para estas órdenes
  const orderIds = orders.map(o => o.id);
  let orderItems: any[] = [];
  if (orderIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("order_id, meli_item_id, title, quantity, total_price, estimated_fee, estimated_shipping_cost")
      .in("order_id", orderIds);
    if (!itemsErr && items) {
      orderItems = items;
    }
  }

  let facturacion = 0;
  let costos = 0;
  let comisiones = 0;
  let envios = 0;
  let extra = 0;
  let unitsSold = 0;
  let unitsWithCost = 0;

  const productAgg: Record<string, { revenue: number, net: number, cost: number, quantity: number }> = {};

  orders.forEach(o => {
    facturacion += Number(o.total_amount) || 0;
    
    // Obtener ítems para esta orden
    const items = orderItems.filter(i => i.order_id === o.id);
    if (items.length > 0) {
      items.forEach(item => {
        const qty = Number(item.quantity) || 1;
        unitsSold += qty;

        const p = products.find(prod => prod.meli_item_id === item.meli_item_id || prod.title === item.title);
        
        let cost = 0;
        let fee = 0;
        let shipping = 0;
        let ext = 0;

        if (p) {
          if (p.cost) {
            cost = Number(p.cost) * qty;
            unitsWithCost += qty;
          }
          fee = Number(item.estimated_fee) || Number(p.estimated_fee) || 0;
          shipping = Number(item.estimated_shipping_cost) || Number(p.estimated_shipping_cost) || 0;
          ext = (Number(p.extra_fee_amount || 0) + Number(p.promotion_discount_amount || 0)) * qty;
        } else {
          fee = Number(item.estimated_fee) || 0;
          shipping = Number(item.estimated_shipping_cost) || 0;
        }

        costos += cost;
        comisiones += fee;
        envios += shipping;
        extra += ext;

        const title = p?.title || item.title || "Varios";
        if (!productAgg[title]) {
          productAgg[title] = { revenue: 0, net: 0, cost: 0, quantity: 0 };
        }
        productAgg[title].revenue += Number(item.total_price) || 0;
        productAgg[title].cost += cost;
        productAgg[title].quantity += qty;
        productAgg[title].net += ((Number(item.total_price) || 0) - cost - fee - shipping - ext);
      });
    } else {
      // Fallback si no tiene ítems cargados
      unitsSold += 1;
      const title = "Varios";
      if (!productAgg[title]) {
        productAgg[title] = { revenue: 0, net: 0, cost: 0, quantity: 0 };
      }
      productAgg[title].revenue += Number(o.total_amount) || 0;
      productAgg[title].quantity += 1;
      productAgg[title].net += Number(o.total_amount) || 0;
    }
  });

  const cancelaciones = cancellations?.reduce((sum, c) => sum + (Number(c.refund_amount) || 0), 0) || 0;

  const gananciaNeta = facturacion - costos - comisiones - envios - extra - cancelaciones;
  const margenNeto = facturacion > 0 ? (gananciaNeta / facturacion) * 100 : 0;
  const precision = unitsSold > 0 ? (unitsWithCost / unitsSold) * 100 : 100;

  const topProductByMargin = Object.entries(productAgg).sort((a, b) => b[1].net - a[1].net)[0];
  const worstProductByMargin = Object.entries(productAgg).sort((a, b) => a[1].net - b[1].net)[0];

  // Construir la lista de productos vendidos
  const soldProductsList = Object.entries(productAgg)
    .filter(([title]) => title !== "Varios" || productAgg[title].quantity > 0)
    .map(([title, stats]) => `- **${stats.quantity}** unidad(es) de "${title}"`)
    .join("\n");

  const soldProductsSection = soldProductsList.length > 0
    ? `\nProductos vendidos en el período:\n${soldProductsList}\n`
    : "\nNo se registraron productos vendidos en el período.\n";

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
${soldProductsSection}
Precisión del cálculo: ${precision.toFixed(1)}% de las ventas tenían costo cargado. ${precision < 95 ? "¡Atención! Ganancia posiblemente sobreestimada." : ""}

Producto que deja más ganancia neta: ${topProductByMargin ? topProductByMargin[0] + ` ($${topProductByMargin[1].net.toLocaleString("es-AR")})` : "N/A"}
Producto que come más margen / deja menos ganancia neta: ${worstProductByMargin ? worstProductByMargin[0] + ` ($${worstProductByMargin[1].net.toLocaleString("es-AR")})` : "N/A"}
  `;
}
