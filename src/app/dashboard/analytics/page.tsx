import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { TrendingUp, TrendingDown, ShoppingBag, CreditCard, AlertTriangle, DollarSign, PackageX, Activity, Cpu, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";

import ParetoChart from "./pareto-chart";
import { getParetoAnalysis } from "@/services/analytics/pareto";

export default async function AnalyticsAndInsightsPage(props: { searchParams: Promise<{ days?: string }> }) {
  const searchParams = await props.searchParams;
  const days = parseInt(searchParams.days || "30");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Dates
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - days);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Queries
  const [
    { data: orders },
    { data: cancellations },
    { data: shipments },
    { data: products }
  ] = await Promise.all([
    supabase.from("orders").select("total_amount, date_created").eq("tenant_id", tenantId).order("date_created", { ascending: false }),
    supabase.from("order_cancellations").select("refund_amount").eq("tenant_id", tenantId),
    supabase.from("shipments").select("substatus, shipping_cost").eq("tenant_id", tenantId),
    supabase.from("products").select("id, title, sold_quantity, margin_percent, available_quantity, profit_real_estimated, status, estimated_shipping_cost").eq("tenant_id", tenantId)
  ]);

  // Analytics Metrics
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const salesLast7Days = orders?.filter(o => new Date(o.date_created) >= sevenDaysAgo).reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;

  const totalEstimatedProfit = products?.reduce((acc, p) => acc + (Number(p.profit_real_estimated) || 0), 0) || 0;
  const lowStockProducts = products?.filter(p => p.available_quantity <= 5 && p.available_quantity > 0).sort((a, b) => a.available_quantity - b.available_quantity).slice(0, 5) || [];

  const totalCancellations = cancellations?.length || 0;
  const lostRevenue = cancellations?.reduce((acc, c) => acc + (Number(c.refund_amount) || 0), 0) || 0;
  const cancellationRate = totalOrders > 0 ? ((totalCancellations / totalOrders) * 100).toFixed(1) : "0.0";

  const totalShipments = shipments?.length || 0;
  const delayedShipments = shipments?.filter(s => s.substatus === 'delayed').length || 0;
  const delayedRate = totalShipments > 0 ? ((delayedShipments / totalShipments) * 100).toFixed(1) : "0.0";
  
  const totalShippingCost = shipments?.reduce((acc, s) => acc + (Number(s.shipping_cost) || 0), 0) || 0;
  const productsWithShipping = products?.filter(p => Number(p.estimated_shipping_cost) > 0) || [];
  const avgEstimatedShipping = productsWithShipping.length > 0 ? productsWithShipping.reduce((acc, p) => acc + Number(p.estimated_shipping_cost), 0) / productsWithShipping.length : 0;
  const avgShippingCost = totalShipments > 0 ? (totalShippingCost / totalShipments) : avgEstimatedShipping;

  // Tendencias Internas
  const topProducts = [...(products || [])].sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0)).slice(0, 5);
  const topGrowing = topProducts.slice(0, 3);
  const deadProducts = [...(products || [])].filter(p => p.status === 'active' && (p.sold_quantity || 0) === 0 && p.available_quantity > 0).slice(0, 3);
  const bestMargin = [...(products || [])].filter(p => p.margin_percent).sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0)).slice(0, 3);
  const worstMargin = [...(products || [])].filter(p => p.margin_percent).sort((a, b) => (a.margin_percent || 0) - (b.margin_percent || 0)).slice(0, 3);

  // Pareto Analysis
  const pareto = await getParetoAnalysis({ tenantId, dateFrom: sevenDaysAgo });

  const chartData = topProducts.filter(p => p.sold_quantity && p.sold_quantity > 0).map(p => ({
    name: p.title || "Producto",
    value: p.sold_quantity || 0
  }));

  // IA Recommendations
  const aiRecommendations = [
    { text: `Revisa ${worstMargin[0]?.title || "tus productos con peor margen"}. El margen actual es demasiado bajo.`, type: "warning" },
    { text: `¡Buen trabajo con ${bestMargin[0]?.title || "tus productos líderes"}! Es el producto con mayor rentabilidad.`, type: "positive" }
  ];

  if (pareto.percentageOfCatalog < 20 && pareto.percentageOfCatalog > 0) {
    aiRecommendations.push({ text: `Tu negocio depende mucho de pocos productos (${pareto.productsToReach80} productos).`, type: "warning" });
  } else {
    aiRecommendations.push({ text: `Tienes una distribución de ventas saludable.`, type: "positive" });
  }

  if (pareto.paretoProducts.length > 0) {
    const topProd = pareto.paretoProducts[0];
    const percentage = ((topProd.revenue / pareto.totalRevenue) * 100).toFixed(1);
    aiRecommendations.push({ text: `El producto '${topProd.title}' representa el ${percentage}% de la facturación. ¡Cuidá su stock!`, type: "critical" });
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analíticas e Insights</h2>
          <p className="text-muted-foreground mt-1">Métricas en profundidad y análisis inteligente de tu catálogo.</p>
        </div>
      </div>

      {/* KPIs Level 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Histórico en plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Ventas completadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${averageTicket.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Gasto promedio por orden</p>
          </CardContent>
        </Card>
        <MetricCard title="Ganancia Neta Estimada" value={`$${totalEstimatedProfit.toLocaleString('es-AR')}`} icon={<DollarSign className="w-5 h-5" />} variant="green" />
      </div>

      {/* KPIs Level 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Cancelación</CardTitle>
            <Ban className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancellationRate}%</div>
            <p className="text-xs text-muted-foreground">{totalCancellations} ventas canceladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pérdida por Cancelaciones</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">${lostRevenue.toLocaleString('es-AR')}</div>
            <p className="text-xs text-muted-foreground">Monto devuelto acumulado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Envíos Demorados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{delayedShipments}</div>
            <p className="text-xs text-muted-foreground">{delayedRate}% de tus envíos</p>
          </CardContent>
        </Card>
        <MetricCard title="Costo Promedio Envío" value={`$${avgShippingCost.toFixed(2)}`} icon={<Activity className="w-5 h-5" />} variant="amber" />
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* IA Panel */}
        <div className="md:col-span-12 lg:col-span-4">
          <Card className="h-full border-indigo-200 dark:border-indigo-900/50">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-500/10 pb-4">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg">Recomendaciones IA</CardTitle>
              </div>
              <CardDescription>Insights generados en tiempo real.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {aiRecommendations.map((rec, i) => (
                <div key={i} className="flex gap-3 items-start border-b pb-3 last:border-0">
                  {rec.type === 'warning' && <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />}
                  {rec.type === 'positive' && <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                  {rec.type === 'critical' && <PackageX className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                  {rec.type === 'info' && <Activity className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium">{rec.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tendencias */}
        <div className="md:col-span-12 lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Tendencias Internas del Catálogo</CardTitle>
              <CardDescription>Clasificación de productos según su desempeño.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-4 h-4" /> Líderes en Ventas
                </h4>
                <ul className="space-y-2 text-sm">
                  {topGrowing.map(p => (
                    <li key={p.id} className="flex justify-between border-b pb-1">
                      <span className="truncate pr-2">{p.title}</span>
                      <Badge variant="secondary">{p.sold_quantity} vendidos</Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-500">
                  <TrendingDown className="w-4 h-4" /> Capital Inmovilizado (Muertos)
                </h4>
                <ul className="space-y-2 text-sm">
                  {deadProducts.map(p => (
                    <li key={p.id} className="flex justify-between border-b pb-1">
                      <span className="truncate pr-2">{p.title}</span>
                      <Badge variant="outline" className="text-red-500 border-red-200">Stock: {p.available_quantity}</Badge>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-emerald-600">
                  <DollarSign className="w-4 h-4" /> Mejores Márgenes
                </h4>
                <ul className="space-y-2 text-sm">
                  {bestMargin.map(p => (
                    <li key={p.id} className="flex justify-between border-b pb-1">
                      <span className="truncate pr-2">{p.title}</span>
                      <span className="font-semibold text-emerald-600">{p.margin_percent?.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="w-4 h-4" /> Peores Márgenes
                </h4>
                <ul className="space-y-2 text-sm">
                  {worstMargin.map(p => (
                    <li key={p.id} className="flex justify-between border-b pb-1">
                      <span className="truncate pr-2">{p.title}</span>
                      <span className="font-semibold text-orange-500">{p.margin_percent?.toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Histórico de Ventas</CardTitle>
            <CardDescription>Resumen de ingresos generados a lo largo del tiempo.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart data={orders || []} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Productos Destacados</CardTitle>
            <CardDescription>Tus artículos más populares y vendidos.</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsChart data={chartData} />
          </CardContent>
        </Card>
      </div>

      <ParetoChart data={pareto} />

      <Card className="col-span-12">
        <CardHeader>
          <CardTitle>Top 10 productos por facturación</CardTitle>
          <CardDescription>Los productos que más ingresos generaron en los últimos {days} días.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Unidades</th>
                  <th className="px-4 py-3 font-medium text-right">Facturación</th>
                  <th className="px-4 py-3 font-medium text-right">% Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pareto.paretoProducts.concat(pareto.longTailProducts).slice(0, 10).map((p, idx) => (
                  <tr key={p.product_id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium">#{idx + 1}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate" title={p.title}>{p.title}</td>
                    <td className="px-4 py-3 text-right">{p.units_sold}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600 text-right">${p.revenue.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.is_pareto ? "default" : "secondary"}>
                        {pareto.totalRevenue > 0 ? ((p.revenue / pareto.totalRevenue) * 100).toFixed(1) : 0}%
                      </Badge>
                    </td>
                  </tr>
                ))}
                {pareto.paretoProducts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-500">No hay datos de ventas en este periodo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Atención: Stock Crítico</CardTitle>
            <CardDescription>Estos productos están a punto de agotarse. Considera reponer inventario pronto.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="font-medium text-sm">{p.title}</div>
                  <div className="text-sm text-red-500 font-bold">{p.available_quantity} en stock</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
