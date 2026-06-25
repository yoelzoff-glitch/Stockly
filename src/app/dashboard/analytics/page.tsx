import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { TrendingUp, TrendingDown, ShoppingBag, CreditCard, AlertTriangle, DollarSign, PackageX, Activity, Cpu, Ban, Sparkles, ExternalLink, Layers, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import ParetoChart from "./pareto-chart";
import { getParetoAnalysis } from "@/services/analytics/pareto";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { TimeFilter } from "./time-filter";
import { getFinancialData } from "@/services/finance/getFinancialData";
import { getCampaignRecommendations } from "@/services/analytics/campaignRecommendations";

export default async function AnalyticsAndInsightsPage(props: { searchParams: Promise<{ days?: string }> }) {
  const searchParams = await props.searchParams;
  const daysParam = searchParams.days || "current_month";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Fetch Tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone, metadata")
    .eq("id", tenantId)
    .single();
  
  const timezone = tenant?.timezone || 'America/Argentina/Buenos_Aires';
  const tenantMetadata = (tenant?.metadata as any) || {};
  const packagingCost = Number(tenantMetadata.packaging_cost) || 0;
  const ignoredOrderIds = tenantMetadata.ignored_order_ids || [];

  // Get current date parts in tenant's timezone (needed for daysElapsed and currentMonthStart)
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date()); // "YYYY-MM-DD"
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  const today = getMidnightInTimezone(new Date(), timezone);
  let sevenDaysAgo: Date;
  
  if (daysParam === "current_month") {
    sevenDaysAgo = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  } else {
    const daysInt = parseInt(daysParam) || 30;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysInt);
    sevenDaysAgo = getMidnightInTimezone(pastDate, timezone);
  }

  const periodLabel = daysParam === "current_month" ? "En el mes actual" : `En los últimos ${daysParam} días`;
  const productsLabel = daysParam === "current_month" ? "el mes actual" : `los últimos ${daysParam} días`;

  // Queries filtered by the selected period
  const [
    { data: orders },
    { data: cancellations },
    { data: shipments },
    { data: products }
  ] = await Promise.all([
    supabase.from("orders").select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id").eq("tenant_id", tenantId).neq("status", "cancelled").gte("date_created", sevenDaysAgo.toISOString()).order("date_created", { ascending: false }),
    supabase.from("order_cancellations").select("refund_amount").eq("tenant_id", tenantId).gte("date_cancelled", sevenDaysAgo.toISOString()).lte("date_cancelled", new Date().toISOString()),
    supabase.from("shipments").select("substatus, shipping_cost, meli_shipment_id").eq("tenant_id", tenantId).gte("date_created", sevenDaysAgo.toISOString()),
    supabase.from("products").select("id, title, cost, sku, sold_quantity, margin_percent, available_quantity, profit_real_estimated, status, estimated_shipping_cost, meli_item_id, extra_fee_amount, promotion_discount_amount").eq("tenant_id", tenantId)
  ]);

  // Filter out ignored orders
  const activeOrders = (orders || []).filter(o => !ignoredOrderIds.includes(o.meli_order_id));

  // Fetch unified financial data for the selected period
  const periodFinancials = await getFinancialData(
    supabase,
    tenantId,
    sevenDaysAgo,
    new Date(), // now
    packagingCost,
    ignoredOrderIds
  );

  const totalOrders = activeOrders.length;
  const totalRevenue = periodFinancials.facturacionBruta;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const periodProfit = periodFinancials.gananciaNeta;

  // Calculate Monthly Projection using unified financials
  const daysElapsed = tenantDay; // 1 to 31 in tenant's timezone
  const currentMonthStart = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);

  const currentMonthFinancials = await getFinancialData(
    supabase,
    tenantId,
    currentMonthStart,
    new Date(), // now
    packagingCost,
    ignoredOrderIds
  );

  const currentMonthProfit = currentMonthFinancials.gananciaNeta;
  const monthlyProjection = (currentMonthProfit / daysElapsed) * 30;

  // Logistics & cancellations metrics
  const totalCancellations = cancellations?.length || 0;
  const lostRevenue = cancellations?.reduce((acc, c) => acc + (Number(c.refund_amount) || 0), 0) || 0;
  const cancellationRate = totalOrders > 0 ? ((totalCancellations / (totalOrders + totalCancellations)) * 100).toFixed(1) : "0.0";

  const totalShipments = shipments?.length || 0;
  const delayedShipments = shipments?.filter(s => s.substatus === 'delayed').length || 0;
  const delayedRate = totalShipments > 0 ? ((delayedShipments / totalShipments) * 100).toFixed(1) : "0.0";
  
  const totalShippingCost = shipments?.reduce((acc, s) => acc + (Number(s.shipping_cost) || 0), 0) || 0;
  const productsWithShipping = products?.filter(p => Number(p.estimated_shipping_cost) > 0) || [];
  const avgEstimatedShipping = productsWithShipping.length > 0 ? productsWithShipping.reduce((acc, p) => acc + Number(p.estimated_shipping_cost), 0) / productsWithShipping.length : 0;
  const avgShippingCost = totalShipments > 0 ? (totalShippingCost / totalShipments) : avgEstimatedShipping;

  // Pareto Analysis
  const pareto = await getParetoAnalysis({ tenantId, dateFrom: sevenDaysAgo });

  // Campaign Recommendations
  const { topProducts: campaignTopProducts, recommendations: campaignRecommendations } = await getCampaignRecommendations(
    supabase,
    tenantId,
    sevenDaysAgo
  );

  // Chart Data preparation based on the selected period
  const activeProductsFromPeriod = [...pareto.paretoProducts, ...pareto.longTailProducts];
  const chartData = activeProductsFromPeriod.slice(0, 5).map(p => ({
    name: p.sku ? `[${p.sku}] ${p.title}` : p.title || "Producto",
    value: p.units_sold || 0
  }));

  // Aggregate products list by SKU for internal trends representation (unifies standard/premium listings)
  const groupedProductsMap = new Map<string, any>();
  const nonSkuProducts: any[] = [];

  (products || []).forEach(p => {
    const sku = p.sku?.trim();
    if (!sku) {
      nonSkuProducts.push({ ...p });
      return;
    }

    const existing = groupedProductsMap.get(sku);
    if (existing) {
      existing.sold_quantity = (existing.sold_quantity || 0) + (p.sold_quantity || 0);
      existing.available_quantity = Math.max(existing.available_quantity || 0, p.available_quantity || 0);
      if ((p.sold_quantity || 0) > (existing._raw_sold_quantity || 0)) {
        existing.title = p.title;
        existing.margin_percent = p.margin_percent;
        existing.id = p.id;
        existing.meli_item_id = p.meli_item_id;
        existing._raw_sold_quantity = p.sold_quantity || 0;
      }
    } else {
      groupedProductsMap.set(sku, {
        ...p,
        _raw_sold_quantity: p.sold_quantity || 0
      });
    }
  });

  const aggregatedProducts = [
    ...Array.from(groupedProductsMap.values()),
    ...nonSkuProducts
  ];

  // Tendencias Internas (calculated using SKU-aggregated products)
  const topProducts = [...aggregatedProducts].sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0)).slice(0, 5);
  const topGrowing = topProducts.slice(0, 3);
  const deadProducts = [...aggregatedProducts].filter(p => p.status === 'active' && (p.sold_quantity || 0) === 0 && p.available_quantity > 0).slice(0, 3);
  const bestMargin = [...aggregatedProducts].filter(p => p.margin_percent).sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0)).slice(0, 3);
  const worstMargin = [...aggregatedProducts].filter(p => p.margin_percent).sort((a, b) => (a.margin_percent || 0) - (b.margin_percent || 0)).slice(0, 3);
  const lowStockProducts = aggregatedProducts.filter(p => p.available_quantity <= 5 && p.available_quantity > 0).sort((a, b) => a.available_quantity - b.available_quantity).slice(0, 5);

  // IA Recommendations
  const aiRecommendations = [
    { text: `Revisa ${worstMargin[0] ? (worstMargin[0].sku ? `[${worstMargin[0].sku}] ${worstMargin[0].title}` : worstMargin[0].title) : "tus productos con peor margen"}. El margen actual es demasiado bajo.`, type: "warning" },
    { text: `¡Buen trabajo con ${bestMargin[0] ? (bestMargin[0].sku ? `[${bestMargin[0].sku}] ${bestMargin[0].title}` : bestMargin[0].title) : "tus productos líderes"}! Es el producto con mayor rentabilidad.`, type: "positive" }
  ];

  if (pareto.percentageOfCatalog < 20 && pareto.percentageOfCatalog > 0) {
    aiRecommendations.push({ text: `Tu negocio depende mucho de pocos productos (${pareto.productsToReach80} productos).`, type: "warning" });
  } else {
    aiRecommendations.push({ text: `Tienes una distribución de ventas saludable.`, type: "positive" });
  }

  if (pareto.paretoProducts.length > 0) {
    const topProd = pareto.paretoProducts[0];
    const percentage = ((topProd.revenue / pareto.totalRevenue) * 100).toFixed(1);
    const displayTitle = topProd.sku ? `[${topProd.sku}] ${topProd.title}` : topProd.title;
    aiRecommendations.push({ text: `El producto '${displayTitle}' representa el ${percentage}% de la facturación. ¡Cuidá su stock!`, type: "critical" });
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analíticas e Insights</h2>
          <p className="text-muted-foreground mt-1">Métricas en profundidad y análisis inteligente de tu catálogo.</p>
        </div>
        <div className="shrink-0">
          <TimeFilter initialDays={daysParam} />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full max-w-[700px] grid-cols-4 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="catalog">Rendimiento Catálogo</TabsTrigger>
          <TabsTrigger value="pareto">Análisis Pareto 80/20</TabsTrigger>
          <TabsTrigger value="campaigns">Impulso de Campañas</TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: RESUMEN GENERAL */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              title="Ingresos Totales" 
              value={`$${totalRevenue.toLocaleString('es-AR')}`} 
              description={periodLabel} 
              icon={<TrendingUp className="h-5 w-5" />} 
              variant="blue" 
            />
            <MetricCard 
              title="Proyección Ganancia Mensual" 
              value={`$${monthlyProjection.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`} 
              description={`A hoy: $${currentMonthProfit.toLocaleString('es-AR', { maximumFractionDigits: 0 })} (${daysElapsed}d transcurridos)`} 
              icon={<DollarSign className="h-5 w-5" />} 
              variant="green" 
            />
            <MetricCard 
              title="Órdenes Totales" 
              value={totalOrders} 
              description={periodLabel} 
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
                    <CardDescription>Resumen de ingresos generados en el periodo.</CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2 h-[260px]">
                    <OverviewChart data={activeOrders} timezone={timezone} />
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Productos Destacados</CardTitle>
                    <CardDescription>Tus artículos más populares y vendidos en este periodo.</CardDescription>
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
              description="Monto devuelto en el periodo" 
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
                          <span className="truncate pr-2" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                            {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                          </span>
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
                          <span className="truncate pr-2" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                            {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                          </span>
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
                          <span className="truncate pr-2" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                            {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                          </span>
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
                          <span className="truncate pr-2" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                            {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                          </span>
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
                        <div className="font-medium text-sm truncate pr-2" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                          {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                        </div>
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
                  <CardDescription>Los productos que más ingresos generaron en {productsLabel}.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-medium">Rank</th>
                          <th className="px-4 py-3 font-medium">Producto</th>
                          <th className="px-4 py-3 font-medium">SKU</th>
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
                            <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                              {p.sku || "—"}
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
                          <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-500">No hay datos de ventas en este periodo.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 4: IMPULSO DE CAMPAÑAS */}
        <TabsContent value="campaigns" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-12">
            
            {/* Recommendations Column */}
            <div className="md:col-span-12 lg:col-span-8 space-y-6">
              <Card className="shadow-md border-indigo-100 bg-gradient-to-br from-indigo-50/20 to-white">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <CardTitle>Campañas de Impulso Sugeridas</CardTitle>
                  </div>
                  <CardDescription>
                    Agrupaciones inteligentes basadas en categorías y temas de tu catálogo para campañas de publicidad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {campaignRecommendations.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <h4 className="text-slate-800 font-semibold">Sin recomendaciones grupales</h4>
                      <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                        No se detectaron suficientes publicaciones activas del mismo tipo o temática para agruparlas en campañas. ¡Publica productos similares para habilitar sugerencias!
                      </p>
                    </div>
                  ) : (
                    campaignRecommendations.map((campaign, idx) => (
                      <div key={idx} className="p-5 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                          <div className="space-y-0.5">
                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                              {campaign.campaignName}
                            </h3>
                            <p className="text-slate-500 text-xs">{campaign.reason}</p>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                              {campaign.category}
                            </Badge>
                            {campaign.subTheme && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {campaign.subTheme}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: Primary and best publication */}
                          <div className="space-y-3">
                            <div className="bg-emerald-50/30 border border-emerald-100/50 p-3 rounded-lg">
                              <span className="text-xs font-semibold text-emerald-800 block mb-1">PRODUCTO PRINCIPAL (ALTA ROTACIÓN)</span>
                              <span className="font-semibold text-slate-900 text-sm block">
                                {campaign.primaryProduct.sku ? `[${campaign.primaryProduct.sku}] ` : ""}{campaign.primaryProduct.title}
                              </span>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">
                                <span>Vendidos: <strong>{campaign.primaryProduct.unitsSold} u.</strong></span>
                                <span>Ingresos: <strong>${campaign.primaryProduct.revenue.toLocaleString('es-AR')}</strong></span>
                              </div>
                            </div>

                            <div className="bg-indigo-50/30 border border-indigo-100/50 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-indigo-800">MEJOR PUBLICACIÓN PARA ANUNCIAR</span>
                                {campaign.bestPublication.permalink && (
                                  <a 
                                    href={campaign.bestPublication.permalink} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-medium"
                                  >
                                    Ver en ML <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <span className="font-semibold text-slate-800 text-sm block truncate" title={campaign.bestPublication.title}>
                                {campaign.bestPublication.title}
                              </span>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-sm font-bold text-slate-900">${campaign.bestPublication.price.toLocaleString('es-AR')}</span>
                                <Badge variant="secondary" className="text-[10px] py-0 px-2 bg-slate-100 text-slate-700 whitespace-normal text-left">
                                  {campaign.bestPublication.listingType}
                                </Badge>
                                <span className="text-[10px] text-slate-500">({campaign.bestPublication.unitsSold} ventas en periodo)</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Suggested Group */}
                          <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-lg flex flex-col justify-between">
                            <div>
                              <span className="text-xs font-semibold text-slate-600 block mb-2">PRODUCTOS PARA AGRUPAR EN LA CAMPAÑA</span>
                              <div className="space-y-2">
                                {campaign.suggestedGroup.map((item, sIdx) => (
                                  <div key={sIdx} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                    <div className="min-w-0">
                                      <span className="text-xs font-medium text-slate-800 block truncate" title={item.title}>
                                        {item.sku ? `[${item.sku}] ` : ""}{item.title}
                                      </span>
                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                        <span>Precio: ${item.price.toLocaleString('es-AR')}</span>
                                        <span>Stock: {item.available_quantity}</span>
                                      </div>
                                    </div>
                                    {item.permalink && (
                                      <a href={item.permalink} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-indigo-600 shrink-0">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Top Selling Products & Best Pub details */}
            <div className="md:col-span-12 lg:col-span-4 space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <CardTitle className="text-lg">Top Productos del Período</CardTitle>
                  </div>
                  <CardDescription>
                    Desglose por SKU y análisis de la publicación con mejor desempeño.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {campaignTopProducts.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-6">No hay datos de ventas en este periodo.</p>
                  ) : (
                    campaignTopProducts.map((p, idx) => (
                      <div key={idx} className="border-b pb-4 last:border-0 last:pb-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 text-sm block truncate" title={p.title}>
                              #{idx + 1} {p.sku ? `[${p.sku}] ` : ""}{p.title}
                            </span>
                            <span className="text-xs text-slate-500">
                              {p.unitsSold} unidades vendidas · ${p.revenue.toLocaleString('es-AR')}
                            </span>
                          </div>
                        </div>

                        {/* Best performing publication subcard */}
                        <div className="bg-amber-50/30 border border-amber-100/50 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-amber-800 font-semibold">
                            <span>PUBLICACIÓN LÍDER DEL SKU</span>
                            {p.bestPublication.permalink && (
                              <a href={p.bestPublication.permalink} target="_blank" rel="noreferrer" className="text-amber-700 hover:underline flex items-center gap-0.5">
                                Ver <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                          <p className="font-medium text-slate-700 truncate" title={p.bestPublication.title}>
                            {p.bestPublication.title}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                            <span>Precio: <strong>${p.bestPublication.price.toLocaleString('es-AR')}</strong></span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 bg-amber-50 text-amber-700 border-amber-200">
                              {p.bestPublication.listingType}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
