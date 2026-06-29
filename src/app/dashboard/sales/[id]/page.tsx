import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  ChevronLeft, 
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

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
  const totalMeliFees = items?.reduce((sum, item) => sum + (Number(item.estimated_fee) || 0), 0) || 0;
  
  // Sum up product costs from items
  const totalProductCost = items?.reduce((sum, item) => sum + ((Number(item.unit_cost) || 0) * (Number(item.quantity) || 1)), 0) || 0;

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

  return (
    <div className="flex-1 p-8 pt-6 max-w-7xl mx-auto space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/sales">
          <Button variant="ghost" size="sm" className="flex items-center gap-1 hover:bg-slate-100">
            <ChevronLeft className="w-4 h-4" />
            Volver a Ventas
          </Button>
        </Link>
        <Badge variant="outline" className="text-xs font-mono text-slate-500">
          ID Interno: {order.id}
        </Badge>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">Orden #{order.meli_order_id}</h1>
            <StatusBadge variant={order.status === 'paid' ? 'success' : order.status === 'cancelled' ? 'neutral' : 'info'}>
              {order.status === 'paid' ? 'Pagado' : order.status}
            </StatusBadge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 text-sm mt-1">
            <Calendar className="w-4 h-4" />
            Creada el {orderDate}
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 border p-3 rounded-lg">
          <User className="w-5 h-5 text-slate-400" />
          <div>
            <p className="text-xs text-slate-400 font-medium">Comprador</p>
            <p className="text-sm font-semibold text-slate-700">{order.buyer_nickname || "Anónimo"}</p>
          </div>
        </div>
      </div>

      {/* Financial KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ingreso de Venta</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${totalAmount.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Precio abonado</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Comisión ML</CardTitle>
            <Percent className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${totalMeliFees.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAmount > 0 ? `${((totalMeliFees / totalAmount) * 100).toFixed(1)}%` : "0%"} del total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Costo Logístico</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${totalLogisticsCost.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Envío + Embalaje</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Costo de Producto</CardTitle>
            <Package className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${totalProductCost.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground mt-1">Costo de compra/stock</p>
          </CardContent>
        </Card>

        <Card className={`shadow-sm border-2 ${netProfit >= 0 ? "border-emerald-200 bg-emerald-50/20" : "border-red-200 bg-red-50/20"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Resultado Neto</CardTitle>
            {netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              ${netProfit.toLocaleString("es-AR")}
            </div>
            <p className={`text-xs font-semibold mt-1 ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Margen: {marginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Columns: Items & Financial Summary */}
        <div className="md:col-span-2 space-y-6">
          {/* Items Table */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-400" />
                Detalle del Contenido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-center">Cant.</th>
                      <th className="px-4 py-3 text-right">Precio Unit.</th>
                      <th className="px-4 py-3 text-right">Comisión ML</th>
                      <th className="px-4 py-3 text-right">Costo Unit.</th>
                      <th className="px-4 py-3 text-right">Utilidad Neta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items && items.length > 0 ? (
                      items.map((item) => {
                        const unitPrice = Number(item.unit_price) || 0;
                        const qty = Number(item.quantity) || 1;
                        const subtotal = unitPrice * qty;
                        const fee = Number(item.estimated_fee) || 0;
                        const cost = Number(item.unit_cost) || 0;
                        const itemNetProfit = subtotal - fee - (cost * qty);
                        
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-4">
                              <div className="space-y-1 max-w-[280px]">
                                <p className="font-medium text-slate-900 leading-tight">{item.title}</p>
                                <p className="text-xs font-mono text-slate-400">SKU: {item.sku || "N/A"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold text-slate-700">{qty}</td>
                            <td className="px-4 py-4 text-right text-slate-900 font-medium">${unitPrice.toLocaleString("es-AR")}</td>
                            <td className="px-4 py-4 text-right text-orange-600">${fee.toLocaleString("es-AR")}</td>
                            <td className="px-4 py-4 text-right text-slate-500">
                              {cost > 0 ? `$${cost.toLocaleString("es-AR")}` : "-"}
                            </td>
                            <td className={`px-4 py-4 text-right font-semibold ${itemNetProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              ${itemNetProfit.toLocaleString("es-AR")}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No se encontraron detalles de los productos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Unit Economics Analysis */}
          <Card className="shadow-sm bg-slate-50/40">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Análisis de Rentabilidad Unitaria
              </CardTitle>
              <CardDescription>Desglose de la contribución marginal de esta orden.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500">
                  <span>Porcentaje de Margen Neto</span>
                  <span className={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{marginPercent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      marginPercent >= 20 
                        ? "bg-emerald-500" 
                        : marginPercent >= 10 
                          ? "bg-blue-500" 
                          : marginPercent >= 0 
                            ? "bg-amber-500" 
                            : "bg-red-500"
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, marginPercent))}%` }}
                  />
                </div>
              </div>

              {/* Feedback Advice */}
              <div className="border p-4 rounded-lg bg-white flex gap-3 items-start">
                <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  marginPercent >= 20 
                    ? "text-emerald-500" 
                    : marginPercent >= 10 
                      ? "text-blue-500" 
                      : "text-amber-500"
                }`} />
                <div className="text-xs space-y-1">
                  <h5 className="font-semibold text-slate-800">
                    {marginPercent >= 20 
                      ? "¡Excelente rentabilidad!" 
                      : marginPercent >= 10 
                        ? "Rentabilidad aceptable" 
                        : marginPercent >= 0 
                          ? "Margen muy ajustado" 
                          : "Venta a pérdida"}
                  </h5>
                  <p className="text-slate-500 leading-relaxed">
                    {marginPercent >= 20 
                      ? "Esta venta supera el objetivo de margen recomendado del 20%. Los costos de logística y el costo del producto están perfectamente equilibrados." 
                      : marginPercent >= 10 
                        ? "La venta arroja saldo positivo. Si es un producto de alta rotación, es aceptable, pero considera revisar si puedes reducir costos de embalaje o ajustar levemente el precio." 
                        : marginPercent >= 0 
                          ? "Cuidado: el margen neto es muy bajo. El peso de las comisiones de Mercado Libre y la logística están absorbiendo la mayor parte de tu ganancia." 
                          : "Alerta: Estás perdiendo dinero con esta transacción. Revisa de inmediato el costo del producto, las comisiones aplicadas o si el subsidio de envío gratis te está perjudicando."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Financial Ledger & Payment/Shipping details */}
        <div className="space-y-6">
          {/* Financial Ledger */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Estructura de Costos</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Ventas Brutas</span>
                <span className="font-semibold text-slate-900">${totalAmount.toLocaleString("es-AR")}</span>
              </div>
              
              {couponAmount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    Descuento Cupón
                  </span>
                  <span>-${couponAmount.toLocaleString("es-AR")}</span>
                </div>
              )}

              <div className="flex justify-between border-b pb-3 text-slate-500">
                <span>Comisión Mercado Libre</span>
                <span className="font-semibold text-orange-600">-${totalMeliFees.toLocaleString("es-AR")}</span>
              </div>

              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Costo de Envío (Vendedor)</span>
                  <span className="font-medium text-slate-700">-${shippingCost.toLocaleString("es-AR")}</span>
                </div>
              )}

              {packagingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Costo de Embalaje</span>
                  <span className="font-medium text-slate-700">-${packagingCost.toLocaleString("es-AR")}</span>
                </div>
              )}

              <div className="flex justify-between border-b pb-3 text-slate-500">
                <span>Costo Total de Logística</span>
                <span className="font-semibold text-slate-700">-${totalLogisticsCost.toLocaleString("es-AR")}</span>
              </div>

              <div className="flex justify-between border-b pb-3 text-slate-500">
                <span>Costo del Producto</span>
                <span className="font-semibold text-purple-600">-${totalProductCost.toLocaleString("es-AR")}</span>
              </div>

              <div className="flex justify-between pt-2 text-base font-bold">
                <span className="text-slate-800">Ganancia Neta</span>
                <span className={netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                  ${netProfit.toLocaleString("es-AR")}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Logistics details */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold text-slate-800">Detalles de la Transacción</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              {/* Payment info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Pago
                </h4>
                <div className="bg-slate-50 p-2.5 rounded border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Método:</span>
                    <span className="font-semibold text-slate-700 uppercase">{paymentMethod.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Financiación:</span>
                    <span className="font-semibold text-slate-700">
                      {installments === 1 ? "1 pago" : `${installments} cuotas`}
                    </span>
                  </div>
                  {couponId && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cupón Meli:</span>
                      <span className="font-mono text-amber-600 font-semibold">{couponId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipping info */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Logística
                </h4>
                <div className="bg-slate-50 p-2.5 rounded border space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tipo de Envío:</span>
                    <span className="font-semibold text-slate-700 capitalize">
                      {shipment?.logistic_type?.replace(/_/g, " ") || "No especificado"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destino:</span>
                    <span className="font-semibold text-slate-700">
                      {shipment?.receiver_city ? `${shipment.receiver_city}, ${shipment.receiver_state || ""}` : "No especificado"}
                    </span>
                  </div>
                  {shipment?.tracking_number && (
                    <div className="space-y-1 pt-1 border-t">
                      <span className="text-slate-400 block">Número de Tracking:</span>
                      <div className="flex items-center justify-between bg-white px-2 py-1 rounded border font-mono text-[11px] text-slate-700">
                        <span>{shipment.tracking_number}</span>
                        {shipment.tracking_number.startsWith("MEL") && (
                          <a 
                            href={`https://www.mercadolibre.com.ar/envios/seguimiento/${shipment.tracking_number}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
