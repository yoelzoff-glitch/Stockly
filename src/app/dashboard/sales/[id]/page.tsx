import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  DollarSign,
  Percent,
  Package,
  Truck,
  CreditCard,
  Tag,
  User,
  Calendar,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalPanel } from "@/components/operational/panel";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";

export default async function SaleDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return notFound();

  // Support both DB UUID and Meli Order ID in URL
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let orderQuery = supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", profile.tenant_id);

  if (isUuid) {
    orderQuery = orderQuery.eq("id", id);
  } else {
    orderQuery = orderQuery.eq("meli_order_id", id);
  }

  const { data: order, error: orderError } = await orderQuery.single();

  if (orderError || !order) {
    return notFound();
  }

  // Fetch order items
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id);

  // Fetch shipment details
  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .eq("order_id", order.id)
    .single();

  const rawData = order.raw_data as any;
  const payments = rawData?.payments || [];
  const klyvoCosts = rawData?.klyvo_operational_costs || {};

  // Financial calculations
  const totalAmount = Number(order.total_amount) || 0;

  // Sum up Mercado Libre fees from items
  const totalMeliFees = items?.reduce(
    (sum, item) => sum + ((Number(item.estimated_fee) || 0) * (Number(item.quantity) || 1)),
    0
  ) || 0;

  // Sum up product costs from items
  const totalProductCost = items?.reduce(
    (sum, item) => sum + ((Number(item.unit_cost) || 0) * (Number(item.quantity) || 1)),
    0
  ) || 0;

  // Logistics costs
  const shippingCost = Number(shipment?.shipping_cost) || 0;
  const packagingCost = Number(klyvoCosts.packaging_cost) || 0;
  const totalLogisticsCost = shippingCost + packagingCost;

  // Net Profit & Margin
  const netProfit = totalAmount - totalMeliFees - totalLogisticsCost - totalProductCost;
  const marginPercent = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0;

  // Payments details
  const primaryPayment = payments[0] || {};
  const installments = primaryPayment.installments || 1;
  const paymentMethod = primaryPayment.payment_method_id || "Desconocido";
  const couponAmount = payments.reduce((sum: number, p: any) => sum + (Number(p.coupon_amount) || 0), 0);
  const couponId = primaryPayment.coupon_id || rawData?.coupon?.id || null;

  // Format date
  const orderDate = new Date(order.date_created).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const financialMetrics: MetricItem[] = [
    {
      label: "Ingreso de Venta",
      value: `$${totalAmount.toLocaleString("es-AR")}`,
      subtext: "Precio bruto cobrado",
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      label: "Comisión ML",
      value: `-$${totalMeliFees.toLocaleString("es-AR")}`,
      subtext: totalAmount > 0 ? `${((totalMeliFees / totalAmount) * 100).toFixed(1)}% de la venta` : "0%",
      icon: <Percent className="w-4 h-4" />
    },
    {
      label: "Costo Logístico",
      value: `-$${totalLogisticsCost.toLocaleString("es-AR")}`,
      subtext: "Envío + Embalaje",
      icon: <Truck className="w-4 h-4" />
    },
    {
      label: "Costo Producto",
      value: `-$${totalProductCost.toLocaleString("es-AR")}`,
      subtext: "Costo de compra/stock",
      icon: <Package className="w-4 h-4" />
    },
    {
      label: "Resultado Neto",
      value: `$${netProfit.toLocaleString("es-AR")}`,
      subtext: `Margen: ${marginPercent.toFixed(1)}%`,
      icon: netProfit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
      highlight: netProfit >= 0 ? "positive" : "critical"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        backLink={{
          href: "/dashboard/sales",
          label: "Volver a Ventas"
        }}
        eyebrow="Detalle de operación comercial"
        title={`Orden #${order.meli_order_id}`}
        description={`Registrada el ${orderDate} en Mercado Libre.`}
        status={
          <StatusBadge variant={order.status === 'paid' ? 'success' : order.status === 'cancelled' ? 'danger' : 'neutral'}>
            {order.status === 'paid' ? 'Pagado' : order.status === 'cancelled' ? 'Cancelado' : order.status}
          </StatusBadge>
        }
        actions={
          <div className="flex items-center gap-2 bg-white border border-[#DCDAD4] px-3 py-1.5 rounded-lg shadow-sm">
            <User className="w-3.5 h-3.5 text-[#5F6875]" />
            <div className="text-xs">
              <span className="text-[#5F6875]">Comprador: </span>
              <strong className="text-[#101828] font-semibold">{order.buyer_nickname || "Anónimo"}</strong>
            </div>
          </div>
        }
      />

      {/* Franja de Indicadores Financieros */}
      <MetricStrip metrics={financialMetrics} columns={5} />

      {/* Grilla Principal: Productos y Desglose Financiero */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna Izquierda: Detalle de Ítems y Análisis Unitario */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabla de Productos */}
          <OperationalPanel
            title="Productos en la orden"
            description="Detalle de cantidades, comisiones y márgenes unitarios calculados."
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold text-center">Cant.</th>
                    <th className="px-4 py-3 font-semibold text-right">Precio Unit.</th>
                    <th className="px-4 py-3 font-semibold text-right">Comisión ML</th>
                    <th className="px-4 py-3 font-semibold text-right">Costo Unit.</th>
                    <th className="px-4 py-3 font-semibold text-right">Utilidad Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {items && items.length > 0 ? (
                    items.map((item) => {
                      const unitPrice = Number(item.unit_price) || 0;
                      const qty = Number(item.quantity) || 1;
                      const subtotal = unitPrice * qty;
                      const fee = (Number(item.estimated_fee) || 0) * qty;
                      const cost = Number(item.unit_cost) || 0;
                      const itemNetProfit = subtotal - fee - (cost * qty);

                      return (
                        <tr key={item.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="space-y-0.5 max-w-[260px]">
                              <p className="font-semibold text-[#101828] leading-tight truncate" title={item.title}>
                                {item.title}
                              </p>
                              <p className="text-[11px] font-mono text-[#5F6875]">
                                SKU: {item.sku || "Sin asignar"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-right text-[#101828] font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                            ${unitPrice.toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-right text-[#B54708] font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                            -${fee.toLocaleString("es-AR")}
                          </td>
                          <td className="px-4 py-3 text-right text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {cost > 0 ? `$${cost.toLocaleString("es-AR")}` : "—"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold tabular-nums ${itemNetProfit >= 0 ? "text-[#198754]" : "text-[#D92D20]"}`}
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            ${itemNetProfit.toLocaleString("es-AR")}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#5F6875]">
                        No se encontraron detalles de productos en esta orden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </OperationalPanel>

          {/* Análisis de Rentabilidad Unitaria */}
          <OperationalPanel
            title="Contribución marginal y rentabilidad"
            description="Evaluación del margen neto resultante después de comisiones, logística y reposición."
          >
            <div className="space-y-4">
              {/* Barra de Progreso Lineal */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-[#5F6875]">
                  <span>Margen Neto sobre Venta</span>
                  <span className={netProfit >= 0 ? "text-[#198754] font-bold" : "text-[#D92D20] font-bold"}>
                    {marginPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-[#F5F3EE] rounded-full overflow-hidden border border-[#DCDAD4]">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      marginPercent >= 20
                        ? "bg-[#198754]"
                        : marginPercent >= 10
                          ? "bg-[#102A56]"
                          : marginPercent >= 0
                            ? "bg-[#F2C94C]"
                            : "bg-[#D92D20]"
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, marginPercent))}%` }}
                  />
                </div>
              </div>

              {/* Mensaje de Diagnóstico */}
              <div className="border border-[#DCDAD4] p-3.5 rounded-lg bg-[#FCFCFA] flex items-start gap-3">
                <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                  marginPercent >= 20
                    ? "text-[#198754]"
                    : marginPercent >= 10
                      ? "text-[#102A56]"
                      : marginPercent >= 0
                        ? "text-[#B54708]"
                        : "text-[#D92D20]"
                }`} />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-[#101828]">
                    {marginPercent >= 20
                      ? "Rentabilidad óptima (supera el 20%)"
                      : marginPercent >= 10
                        ? "Margen operativo aceptable"
                        : marginPercent >= 0
                          ? "Margen reducido"
                          : "Venta a pérdida"}
                  </h4>
                  <p className="text-[#5F6875] leading-relaxed">
                    {marginPercent >= 20
                      ? "Esta operación deja una contribución sólida. Los costos logísticos y de producto están equilibrados frente al precio de venta."
                      : marginPercent >= 10
                        ? "La venta genera resultado positivo. En productos de alta rotación es admisible; para catálogo general considerá optimizar embalaje o ajustar el precio."
                        : marginPercent >= 0
                          ? "El margen es estrecho. El peso combinado de comisiones de Mercado Libre y flete absorbe la mayor parte del ingreso bruto."
                          : "Esta transacción genera pérdida económica neta. Verificá si el costo cargado es correcto o si el subsidio de envío gratuito compromete el margen."}
                  </p>
                </div>
              </div>
            </div>
          </OperationalPanel>
        </div>

        {/* Columna Derecha: Estructura de Costos y Datos de Transacción */}
        <div className="space-y-6">
          {/* Libro de Estructura de Costos */}
          <OperationalPanel
            title="Estructura de costos"
            description="Desglose contable de la orden."
          >
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-[#5F6875]">Venta Bruta</span>
                <span className="font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                  ${totalAmount.toLocaleString("es-AR")}
                </span>
              </div>

              {couponAmount > 0 && (
                <div className="flex justify-between items-center py-1 text-[#B54708]">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Cupón aplicado
                  </span>
                  <span className="font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${couponAmount.toLocaleString("es-AR")}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                <span className="text-[#5F6875]">Comisión Mercado Libre</span>
                <span className="font-bold text-[#B54708] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                  -${totalMeliFees.toLocaleString("es-AR")}
                </span>
              </div>

              {shippingCost > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#5F6875]">Envío (a cargo del vendedor)</span>
                  <span className="font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${shippingCost.toLocaleString("es-AR")}
                  </span>
                </div>
              )}

              {packagingCost > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-[#5F6875]">Embalaje estimado</span>
                  <span className="font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${packagingCost.toLocaleString("es-AR")}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-[#E2E8F0]">
                <span className="text-[#5F6875]">Costo Total Logístico</span>
                <span className="font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                  -${totalLogisticsCost.toLocaleString("es-AR")}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-[#DCDAD4]">
                <span className="text-[#5F6875]">Costo de Reposición</span>
                <span className="font-bold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                  -${totalProductCost.toLocaleString("es-AR")}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 text-sm">
                <span className="font-bold text-[#101828]">Ganancia Neta</span>
                <span
                  className={`font-bold tabular-nums ${netProfit >= 0 ? "text-[#198754]" : "text-[#D92D20]"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  ${netProfit.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          </OperationalPanel>

          {/* Información de Transacción */}
          <OperationalPanel
            title="Pago y logística"
            description="Medio de cobro y despacho asociado."
          >
            <div className="space-y-4 text-xs">
              {/* Pago */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Cobro</span>
                </div>
                <div className="p-2.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#5F6875]">Método:</span>
                    <span className="font-semibold text-[#101828] uppercase">{paymentMethod.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6875]">Financiación:</span>
                    <span className="font-semibold text-[#101828]">
                      {installments === 1 ? "1 pago" : `${installments} cuotas`}
                    </span>
                  </div>
                  {couponId && (
                    <div className="flex justify-between">
                      <span className="text-[#5F6875]">Cupón:</span>
                      <span className="font-mono text-[#B54708] font-bold">{couponId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Logística */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Despacho</span>
                </div>
                <div className="p-2.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#5F6875]">Modalidad:</span>
                    <span className="font-semibold text-[#101828] capitalize">
                      {shipment?.logistic_type?.replace(/_/g, " ") || "No especificada"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5F6875]">Destino:</span>
                    <span className="font-semibold text-[#101828] truncate max-w-[140px]" title={shipment?.receiver_city ? `${shipment.receiver_city}, ${shipment.receiver_state || ""}` : "No especificado"}>
                      {shipment?.receiver_city ? `${shipment.receiver_city}, ${shipment.receiver_state || ""}` : "No especificado"}
                    </span>
                  </div>
                  {shipment?.tracking_number && (
                    <div className="pt-1.5 border-t border-[#E2E8F0] space-y-1">
                      <span className="text-[#5F6875] text-[11px]">Tracking:</span>
                      <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-[#DCDAD4] font-mono text-[11px] text-[#101828]">
                        <span>{shipment.tracking_number}</span>
                        {shipment.tracking_number.startsWith("MEL") && (
                          <a
                            href={`https://www.mercadolibre.com.ar/envios/seguimiento/${shipment.tracking_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#102A56] hover:underline"
                            title="Rastrear en Mercado Libre"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </OperationalPanel>
        </div>
      </div>
    </div>
  );
}
