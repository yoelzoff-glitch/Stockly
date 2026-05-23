import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, PackageX, Ban, Activity, AlertTriangle, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";

import ParetoChart from "./pareto-chart";
import { getParetoAnalysis } from "@/services/analytics/pareto";

export default async function MarketInsightsPage(props: { searchParams: Promise<{ days?: string }> }) {
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

  // KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - days);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    { data: orders },
    { data: cancellations },
    { data: shipments },
    { data: products }
  ] = await Promise.all([
    supabase.from("orders").select("total_amount, date_created").eq("tenant_id", tenantId).gte("date_created", sevenDaysAgo.toISOString()),
    supabase.from("order_cancellations").select("refund_amount").eq("tenant_id", tenantId),
    supabase.from("shipments").select("shipping_cost").eq("tenant_id", tenantId),
    supabase.from("products").select("id, title, sold_quantity, margin_percent, available_quantity, profit_real_estimated, status, estimated_shipping_cost").eq("tenant_id", tenantId)
  ]);

  const salesLast7Days = orders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;
  
  // Real Net Profit estimation
  const totalEstimatedProfit = products?.reduce((acc, p) => acc + (Number(p.profit_real_estimated) || 0), 0) || 0;

  const totalCancellationsCount = cancellations?.length || 0;
  
  const totalShipments = shipments?.length || 0;
  const totalShippingCost = shipments?.reduce((acc, s) => acc + (Number(s.shipping_cost) || 0), 0) || 0;
  
  // Calculate catalog average estimated shipping
  const productsWithShipping = products?.filter(p => Number(p.estimated_shipping_cost) > 0) || [];
  const totalEstimatedShipping = productsWithShipping.reduce((acc, p) => acc + Number(p.estimated_shipping_cost), 0);
  const avgEstimatedShipping = productsWithShipping.length > 0 ? totalEstimatedShipping / productsWithShipping.length : 0;
  
  // Use real shipments if available, otherwise use catalog average
  const avgShippingCost = totalShipments > 0 ? (totalShippingCost / totalShipments) : avgEstimatedShipping;

  // Tendencias Internas
  const topGrowing = [...(products || [])].sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0)).slice(0, 3);
  const topFalling = [...(products || [])].filter(p => p.status === 'active' && (p.sold_quantity || 0) === 0).slice(0, 3); // Simplification of falling
  const bestMargin = [...(products || [])].filter(p => p.margin_percent).sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0)).slice(0, 3);
  const worstMargin = [...(products || [])].filter(p => p.margin_percent).sort((a, b) => (a.margin_percent || 0) - (b.margin_percent || 0)).slice(0, 3);
  const criticalStock = [...(products || [])].filter(p => p.available_quantity <= 5 && p.available_quantity > 0).slice(0, 3);
  const deadProducts = [...(products || [])].filter(p => p.available_quantity > 0 && (p.sold_quantity || 0) === 0).slice(0, 3);

  // Pareto Analysis
  const pareto = await getParetoAnalysis({ tenantId, dateFrom: sevenDaysAgo });

  // IA Recommendations (Static for now, can be populated via DB if we save them)
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

  if (pareto.longTailProducts.length > 10) {
    aiRecommendations.push({ text: `Tenés muchos productos con baja contribución. Revisá la cola larga para liberar capital inmovilizado.`, type: "info" });
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Market Insights</h2>
        <p className="text-muted-foreground mt-1">Análisis profundo de tu negocio basado en datos propios reales.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Ventas Últimos 7 Días" value={`$${salesLast7Days.toLocaleString('es-AR')}`} icon={<TrendingUp className="w-5 h-5" />} variant="blue" />
        <MetricCard title="Ganancia Neta Estimada" value={`$${totalEstimatedProfit.toLocaleString('es-AR')}`} icon={<DollarSign className="w-5 h-5" />} variant="green" />
        <MetricCard title="Total Cancelaciones" value={totalCancellationsCount} icon={<Ban className="w-5 h-5" />} variant="red" />
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

        {/* Pareto Chart */}
        <ParetoChart data={pareto} />

        {/* Top 10 Table */}
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
      </div>
    </div>
  );
}
