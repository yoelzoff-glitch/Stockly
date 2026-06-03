import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { TrendingUp, TrendingDown, ShoppingBag, CreditCard, AlertTriangle, DollarSign, PackageX, Activity, Cpu, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-[540px] grid-cols-3 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="catalog">Rendimiento Catálogo</TabsTrigger>
          <TabsTrigger value="pareto">Análisis Pareto 80/20</TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: RESUMEN GENERAL */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              title="Ingresos Totales" 
              value={`$${totalRevenue.toLocaleString('es-AR')}`} 
              description="Histórico en plataforma" 
              icon={<TrendingUp className="h-5 w-5" />} 
              variant="blue" 
            />
            <MetricCard 
              title="Ganancia Neta Estimada" 
              value={`$${totalEstimatedProfit.toLocaleString('es-AR')}`} 
              description="Estimada en base a costos" 
              icon={<DollarSign className="h-5 w-5" />} 
              variant="green" 
            />
            <MetricCard 
              title="Órdenes Totales" 
              value={totalOrders} 
              description="Ventas completadas" 
              icon={<ShoppingBag className="h-5 w-5" />} 
              variant="purple" 
            />
            <MetricCard 
              title="Ticket Promedio" 
              value={`$${averageTicket.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`} 
              description="Gasto promedio por orden" 
              icon={<CreditCard className="h-5 w-5" />} 
              variant="slate" 
            />
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-12 lg:col-span-4">
              <Card className="h-full border-indigo-200 dark:border-indigo-900/50 shadow-md">
                <CardHeader className="bg-indigo-50/50 dark:bg-indigo-500/10 pb-4">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    <CardTitle className="text-lg">Recomendaciones IA</CardTitle>
                  </div>
                  <CardDescription>Insights generados en tiempo real.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {aiRecommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3 items-start border-b pb-3 last:border-0 hover:bg-slate-50/50 p-1.5 rounded transition-colors">
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

            <div className="md:col-span-12 lg:col-span-8 grid gap-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Histórico de Ventas</CardTitle>
                    <CardDescription>Resumen de ingresos generados en el tiempo.</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2 h-[260px]">
                    <OverviewChart data={orders || []} />
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Productos Destacados</CardTitle>
                    <CardDescription>Tus artículos más populares y vendidos.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <TopProductsChart data={chartData} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 2: RENDIMIENTO CATÁLOGO */}
        <TabsContent value="catalog" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              title="Tasa de Cancelación" 
              value={`${cancellationRate}%`} 
              description={`${totalCancellations} ventas canceladas`} 
              icon={<Ban className="h-5 w-5" />} 
              variant="red" 
            />
            <MetricCard 
              title="Pérdida por Cancelaciones" 
              value={`$${lostRevenue.toLocaleString('es-AR')}`} 
              description="Monto devuelto acumulado" 
              icon={<TrendingDown className="h-5 w-5" />} 
              variant="red" 
            />
            <MetricCard 
              title="Envíos Demorados" 
              value={delayedShipments} 
              description={`${delayedRate}% de tus envíos`} 
              icon={<AlertTriangle className="h-5 w-5" />} 
              variant="amber" 
            />
            <MetricCard 
              title="Costo Promedio Envío" 
              value={`$${avgShippingCost.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`} 
              description="Por orden de envío" 
              icon={<Activity className="h-5 w-5" />} 
              variant="slate" 
            />
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-12 lg:col-span-8">
              <Card className="shadow-sm h-full">
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
                        <li key={p.id} className="flex justify-between border-b pb-1 hover:bg-slate-50/50 px-1 py-0.5 rounded transition-colors">
                          <span className="truncate pr-2" title={p.title}>{p.title}</span>
                          <Badge variant="secondary" className="shrink-0">{p.sold_quantity} vendidos</Badge>
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
                        <li key={p.id} className="flex justify-between border-b pb-1 hover:bg-slate-50/50 px-1 py-0.5 rounded transition-colors">
                          <span className="truncate pr-2" title={p.title}>{p.title}</span>
                          <Badge variant="outline" className="text-red-500 border-red-200 shrink-0">Stock: {p.available_quantity}</Badge>
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
                        <li key={p.id} className="flex justify-between border-b pb-1 hover:bg-slate-50/50 px-1 py-0.5 rounded transition-colors">
                          <span className="truncate pr-2" title={p.title}>{p.title}</span>
                          <span className="font-semibold text-emerald-600 shrink-0">{p.margin_percent?.toFixed(1)}%</span>
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
                        <li key={p.id} className="flex justify-between border-b pb-1 hover:bg-slate-50/50 px-1 py-0.5 rounded transition-colors">
                          <span className="truncate pr-2" title={p.title}>{p.title}</span>
                          <span className="font-semibold text-orange-500 shrink-0">{p.margin_percent?.toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-12 lg:col-span-4">
              {lowStockProducts && lowStockProducts.length > 0 ? (
                <Card className="border-orange-200 dark:border-orange-900/50 shadow-sm h-full">
                  <CardHeader className="bg-orange-50/50 dark:bg-orange-500/10 pb-4">
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="w-5 h-5 text-orange-500" /> Atención: Stock Crítico
                    </CardTitle>
                    <CardDescription>Reponer inventario pronto.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {lowStockProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0 hover:bg-slate-50/50 p-1 rounded transition-colors">
                        <div className="font-medium text-sm truncate pr-2" title={p.title}>{p.title}</div>
                        <div className="text-sm text-red-500 font-bold shrink-0">{p.available_quantity} en stock</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-200 shadow-sm h-full flex flex-col justify-center items-center p-6 text-center">
                  <Activity className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="font-medium text-slate-800 text-sm">¡Niveles de stock óptimos!</p>
                  <p className="text-xs text-slate-500 mt-1">Ningún producto está en nivel crítico actualmente.</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 3: ANÁLISIS PARETO Y TOP 10 */}
        <TabsContent value="pareto" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-12">
              <ParetoChart data={pareto} />
            </div>

            <div className="md:col-span-12">
              <Card className="shadow-sm">
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
                            <td className="px-4 py-3 max-w-[300px] truncate font-medium text-slate-900" title={p.title}>
                              {p.title}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{p.units_sold}</td>
                            <td className="px-4 py-3 font-semibold text-emerald-600 text-right">${p.revenue.toLocaleString('es-AR')}</td>
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
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

