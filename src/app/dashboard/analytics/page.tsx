import { createClient } from "@/lib/supabase/server";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { TrendingUp, TrendingDown, AlertTriangle, PackageX, ExternalLink, Layers, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalPanel } from "@/components/operational/panel";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";

import ParetoChart from "./pareto-chart";
import { getParetoAnalysis } from "@/services/analytics/pareto";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";
import { TimeFilter } from "./time-filter";
import { getFinancialData } from "@/services/finance/getFinancialData";
import { getCampaignRecommendations } from "@/services/analytics/campaignRecommendations";
import SalesAnalytics from "./sales-analytics";
import CompetitorAnalyzer from "./competitor-analyzer";

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

  // Current date parts in tenant's timezone
  const tenantDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tenantDateStr = tenantDateFormatter.format(new Date());
  const [tenantYear, tenantMonth, tenantDay] = tenantDateStr.split('-').map(Number);

  let sevenDaysAgo: Date;

  if (daysParam === "current_month") {
    sevenDaysAgo = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  } else {
    const daysInt = parseInt(daysParam) || 30;
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - daysInt);
    sevenDaysAgo = getMidnightInTimezone(pastDate, timezone);
  }

  const periodLabel = daysParam === "current_month" ? "Mes actual" : `Últimos ${daysParam} días`;
  const productsLabel = daysParam === "current_month" ? "el mes actual" : `los últimos ${daysParam} días`;

  // Parallel database queries
  const [
    { data: orders },
    { data: cancellations },
    { data: shipments },
    { data: products }
  ] = await Promise.all([
    supabase.from("orders").select("id, total_amount, date_created, status, meli_order_id, meli_shipment_id, raw_data").eq("tenant_id", tenantId).neq("status", "cancelled").gte("date_created", sevenDaysAgo.toISOString()).order("date_created", { ascending: false }),
    supabase.from("order_cancellations").select("refund_amount").eq("tenant_id", tenantId).gte("date_cancelled", sevenDaysAgo.toISOString()).lte("date_cancelled", new Date().toISOString()),
    supabase.from("shipments").select("substatus, shipping_cost, meli_shipment_id, receiver_state").eq("tenant_id", tenantId).gte("date_created", sevenDaysAgo.toISOString()),
    supabase.from("products").select("id, title, cost, sku, sold_quantity, margin_percent, available_quantity, profit_real_estimated, status, estimated_shipping_cost, meli_item_id, extra_fee_amount, promotion_discount_amount").eq("tenant_id", tenantId)
  ]);

  const activeOrders = (orders || []).filter(o => !ignoredOrderIds.includes(o.meli_order_id));

  // Unified financial data
  const periodFinancials = await getFinancialData(
    supabase,
    tenantId,
    sevenDaysAgo,
    new Date(),
    packagingCost,
    ignoredOrderIds,
    false,
    timezone
  );

  const totalOrders = activeOrders.length;
  const totalRevenue = periodFinancials.facturacionBruta;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Current Month calculation for monthly projections
  const currentMonthStart = getMidnightInTimezone(new Date(Date.UTC(tenantYear, tenantMonth - 1, 1, 12, 0, 0)), timezone);
  const daysElapsed = Math.max(1, tenantDay);

  const currentMonthFinancials = await getFinancialData(
    supabase,
    tenantId,
    currentMonthStart,
    new Date(),
    packagingCost,
    ignoredOrderIds,
    true,
    timezone
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

  // Top products chart data
  const activeProductsFromPeriod = [...pareto.paretoProducts, ...pareto.longTailProducts];
  const chartData = activeProductsFromPeriod.slice(0, 5).map(p => ({
    name: p.sku ? `[${p.sku}] ${p.title}` : p.title || "Producto",
    value: p.units_sold || 0
  }));

  // Aggregate products by SKU
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

  // Concrete answers to: ¿Qué productos son rentables? ¿Cuáles generan pérdida?
  const bestMargin = [...aggregatedProducts]
    .filter(p => typeof p.margin_percent === 'number' && p.margin_percent > 0)
    .sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0))
    .slice(0, 5);

  const worstMargin = [...aggregatedProducts]
    .filter(p => typeof p.margin_percent === 'number')
    .sort((a, b) => (a.margin_percent || 0) - (b.margin_percent || 0))
    .slice(0, 5);

  // Operational Alerts (honest, no AI hype)
  const operationalAlerts: { text: string; variant: "danger" | "warning" | "success" }[] = [];

  if (worstMargin.length > 0 && (worstMargin[0].margin_percent ?? 100) < 10) {
    const title = worstMargin[0].sku ? `[${worstMargin[0].sku}] ${worstMargin[0].title}` : worstMargin[0].title;
    operationalAlerts.push({
      text: `Margen crítico detectado en ${title} (${worstMargin[0].margin_percent?.toFixed(1)}%). Revisa comisiones y flete asignado.`,
      variant: "danger"
    });
  }

  if (pareto.percentageOfCatalog < 20 && pareto.percentageOfCatalog > 0) {
    operationalAlerts.push({
      text: `Alta concentración de riesgo: ${pareto.productsToReach80} publicaciones (${pareto.percentageOfCatalog.toFixed(1)}% del catálogo) generan el 80% de tus ingresos.`,
      variant: "warning"
    });
  }

  if (totalCancellations > 0 && parseFloat(cancellationRate) > 5) {
    operationalAlerts.push({
      text: `Tasa de cancelación elevada (${cancellationRate}%). Pérdida bruta de $${lostRevenue.toLocaleString('es-AR')} en el período.`,
      variant: "warning"
    });
  }

  if (operationalAlerts.length === 0) {
    operationalAlerts.push({
      text: "Operación financiera equilibrada: sin alertas de margen negativo ni quiebre inminente en publicaciones líderes.",
      variant: "success"
    });
  }

  // 1. Sales by Province
  const provinceSalesMap = new Map<string, { count: number; revenue: number }>();
  const shipmentStateMap = new Map<string, string>();

  shipments?.forEach(s => {
    if (s.meli_shipment_id && s.receiver_state) {
      shipmentStateMap.set(s.meli_shipment_id.toString(), s.receiver_state);
    }
  });

  let unknownProvinceCount = 0;
  let unknownProvinceRevenue = 0;

  activeOrders.forEach(o => {
    const shipmentId = o.meli_shipment_id?.toString();
    const state = shipmentId ? shipmentStateMap.get(shipmentId) : null;
    const amount = Number(o.total_amount) || 0;

    if (state) {
      const existing = provinceSalesMap.get(state) || { count: 0, revenue: 0 };
      provinceSalesMap.set(state, {
        count: existing.count + 1,
        revenue: existing.revenue + amount
      });
    } else {
      unknownProvinceCount++;
      unknownProvinceRevenue += amount;
    }
  });

  const provinceSales = Array.from(provinceSalesMap.entries())
    .map(([province, data]) => ({
      province,
      count: data.count,
      revenue: data.revenue
    }))
    .sort((a, b) => b.count - a.count);

  if (unknownProvinceCount > 0) {
    provinceSales.push({
      province: "No especificado / Retiro en sucursal",
      count: unknownProvinceCount,
      revenue: unknownProvinceRevenue
    });
  }

  // 2. Sales in Installments vs. One Payment
  let singlePaymentCount = 0;
  let singlePaymentRevenue = 0;
  let installmentCount = 0;
  let installmentRevenue = 0;

  const installmentDetailsMap = new Map<number, { count: number; revenue: number }>();

  activeOrders.forEach(o => {
    const rawData = o.raw_data as any;
    const payments = rawData?.payments || [];
    const amount = Number(o.total_amount) || 0;

    let maxInstallments = 1;
    if (payments.length > 0) {
      maxInstallments = payments.reduce((max: number, p: any) => Math.max(max, Number(p.installments) || 1), 1);
    }

    const existingDetail = installmentDetailsMap.get(maxInstallments) || { count: 0, revenue: 0 };
    installmentDetailsMap.set(maxInstallments, {
      count: existingDetail.count + 1,
      revenue: existingDetail.revenue + amount
    });

    if (maxInstallments > 1) {
      installmentCount++;
      installmentRevenue += amount;
    } else {
      singlePaymentCount++;
      singlePaymentRevenue += amount;
    }
  });

  const paymentTypeData = [
    { name: "Un solo pago", count: singlePaymentCount, revenue: singlePaymentRevenue, color: "#102A56" },
    { name: "En cuotas", count: installmentCount, revenue: installmentRevenue, color: "#198754" }
  ];

  const installmentDetails = Array.from(installmentDetailsMap.entries())
    .map(([installments, data]) => ({
      installments,
      name: installments === 1 ? "1 pago" : `${installments} cuotas`,
      count: data.count,
      revenue: data.revenue
    }))
    .sort((a, b) => a.installments - b.installments);

  const topMetricItems: MetricItem[] = [
    {
      label: "¿Cuánto se Vendió?",
      value: `$${totalRevenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: `Facturación bruta (${periodLabel})`
    },
    {
      label: "¿Cuánto Quedó Realmente?",
      value: `$${periodFinancials.gananciaNeta.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: `Margen operativo: ${periodFinancials.margenNeto.toFixed(1)}%`
    },
    {
      label: "Volumen y Ticket",
      value: `${totalOrders} órdenes`,
      subtext: `Ticket promedio: $${averageTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
    },
    {
      label: "Proyección del Mes",
      value: `$${monthlyProjection.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: `Ganancia proyectada (${daysElapsed}d transcurridos)`
    },
    {
      label: "Fugas / Cancelaciones",
      value: `${cancellationRate}%`,
      subtext: `$${lostRevenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })} anulados`
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Analíticas y Rentabilidad"
        description="Indicadores de evolución comercial, contribución marginal, rotación y concentración de ventas."
        actions={<TimeFilter initialDays={daysParam} />}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-[#FFFFFF] border border-[#DCDAD4] p-1 rounded-lg flex flex-wrap h-auto">
          <TabsTrigger value="overview" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Resumen Operativo
          </TabsTrigger>
          <TabsTrigger value="pareto" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Concentración Pareto 80/20
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Agrupación de Campañas
          </TabsTrigger>
          <TabsTrigger value="sales" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Zonas y Financiación
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Benchmarking de Mercado
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: RESUMEN OPERATIVO */}
        <TabsContent value="overview" className="space-y-6 outline-none">
          {/* Top 5 concrete answers */}
          <MetricStrip metrics={topMetricItems} columns={5} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <OperationalPanel
                title="¿Cómo Evolucionan las Ventas?"
                description={`Ingresos y órdenes confirmadas distribuidas en el tiempo (${periodLabel}).`}
                action={<span className="text-[11px] font-mono text-[#5F6875]">Unidad: $ ARS</span>}
              >
                <div className="h-[280px] w-full pt-1">
                  <OverviewChart data={activeOrders} timezone={timezone} />
                </div>
                <div className="mt-3 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875]">
                  Fuente: Órdenes sincronizadas directamente desde Mercado Libre. Excluye cancelaciones.
                </div>
              </OperationalPanel>
            </div>

            <div className="lg:col-span-5">
              <OperationalPanel
                title="Publicaciones con Mayor Rotación"
                description={`Top 5 publicaciones con mayor cantidad de unidades vendidas en ${productsLabel}.`}
                action={<span className="text-[11px] font-mono text-[#5F6875]">Unidad: Unidades</span>}
              >
                <div className="h-[280px] w-full pt-1">
                  <TopProductsChart data={chartData} />
                </div>
                <div className="mt-3 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875]">
                  Fuente: Ventas por publicación asociadas al catálogo activo.
                </div>
              </OperationalPanel>
            </div>
          </div>

          {/* Diagnostic & Profitability Answers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Operational Diagnostics (4 cols) */}
            <div className="lg:col-span-4">
              <OperationalPanel
                title="Diagnóstico de Catálogo y Rentabilidad"
                description="Alertas sobre margen, dependencia de referencias y quiebre de stock."
              >
                <div className="space-y-3 pt-1">
                  {operationalAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-md border text-xs leading-relaxed flex items-start gap-2.5 ${
                        alert.variant === "danger"
                          ? "bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]"
                          : alert.variant === "warning"
                            ? "bg-[#FFFAEB] border-[#FEDF89] text-[#B54708]"
                            : "bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]"
                      }`}
                    >
                      {alert.variant === "danger" && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                      {alert.variant === "warning" && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                      {alert.variant === "success" && <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span className="font-medium">{alert.text}</span>
                    </div>
                  ))}
                </div>
              </OperationalPanel>
            </div>

            {/* Questions Answered: Rentables vs Pérdidas (8 cols) */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ¿Qué productos son rentables? */}
              <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] overflow-hidden flex flex-col">
                <div className="p-3 bg-[#FCFCFA] border-b border-[#DCDAD4]">
                  <span className="text-xs font-bold text-[#101828] block">¿Qué productos son rentables?</span>
                  <span className="text-[11px] text-[#5F6875]">Top publicaciones con mayor margen neto %</span>
                </div>
                <div className="divide-y divide-[#DCDAD4] flex-1">
                  {bestMargin.length === 0 ? (
                    <p className="p-4 text-xs text-[#5F6875] text-center">Sin datos de margen cargados.</p>
                  ) : (
                    bestMargin.map((p, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#F5F3EE]/50">
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-[#101828] truncate block" title={p.title}>
                            {p.sku ? `[${p.sku}] ` : ""}{p.title}
                          </span>
                          <span className="text-[10px] font-mono text-[#5F6875]">{p.sold_quantity} vendidos</span>
                        </div>
                        <StatusBadge variant="success">
                          {p.margin_percent?.toFixed(1)}%
                        </StatusBadge>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ¿Qué productos generan pérdida o riesgo? */}
              <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] overflow-hidden flex flex-col">
                <div className="p-3 bg-[#FCFCFA] border-b border-[#DCDAD4]">
                  <span className="text-xs font-bold text-[#101828] block">¿Qué productos tienen margen crítico?</span>
                  <span className="text-[11px] text-[#5F6875]">Publicaciones con margen bajo o en riesgo</span>
                </div>
                <div className="divide-y divide-[#DCDAD4] flex-1">
                  {worstMargin.length === 0 ? (
                    <p className="p-4 text-xs text-[#5F6875] text-center">Sin datos de margen cargados.</p>
                  ) : (
                    worstMargin.map((p, idx) => {
                      const isCritical = (p.margin_percent ?? 0) <= 10;
                      return (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#F5F3EE]/50">
                          <div className="min-w-0 pr-2">
                            <span className="font-medium text-[#101828] truncate block" title={p.title}>
                              {p.sku ? `[${p.sku}] ` : ""}{p.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#5F6875]">{p.sold_quantity} vendidos</span>
                          </div>
                          <StatusBadge variant={isCritical ? "danger" : "warning"}>
                            {p.margin_percent?.toFixed(1)}%
                          </StatusBadge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: PARETO 80/20 */}
        <TabsContent value="pareto" className="space-y-6 outline-none">
          <div className="grid gap-6">
            <ParetoChart data={pareto} />

            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-bold text-[#101828]">Top 10 Publicaciones por Facturación</h3>
                <p className="text-xs text-[#5F6875]">Las 10 publicaciones con mayor aporte al total de ingresos en {productsLabel}.</p>
              </div>

              <DataTableShell
                isEmpty={pareto.paretoProducts.length === 0}
                emptyState={
                  <OperationalEmptyState
                    title="Sin ventas en el período seleccionado"
                    description="No se registraron ventas suficientes para calcular la participación de catálogo."
                  />
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                        <th className="px-4 py-2.5">Rank</th>
                        <th className="px-4 py-2.5">Publicación</th>
                        <th className="px-3 py-2.5">SKU</th>
                        <th className="px-3 py-2.5 text-right">Unidades</th>
                        <th className="px-3 py-2.5 text-right">Facturación</th>
                        <th className="px-4 py-2.5 text-right">% Facturado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                      {pareto.paretoProducts.concat(pareto.longTailProducts).slice(0, 10).map((p, idx) => (
                        <tr key={p.product_id || idx} className="hover:bg-[#F5F3EE]/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-[#5F6875]">#{idx + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[#101828] max-w-[320px] truncate" title={p.title}>
                            {p.title}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[#5F6875]">
                            {p.sku || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {p.units_sold}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            ${p.revenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <StatusBadge variant={p.is_pareto ? "success" : "neutral"}>
                              {pareto.totalRevenue > 0 ? ((p.revenue / pareto.totalRevenue) * 100).toFixed(1) : 0}%
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableShell>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: IMPULSO DE CAMPAÑAS */}
        <TabsContent value="campaigns" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <OperationalPanel
                title="Estructuración de Campañas por SKU"
                description="Agrupaciones operativas recomendadas según publicaciones líderes y productos complementarios."
              >
                {campaignRecommendations.length === 0 ? (
                  <OperationalEmptyState
                    title="Sin recomendaciones grupales activas"
                    description="No se detectaron suficientes publicaciones con ventas del mismo SKU para agrupar en campañas."
                  />
                ) : (
                  <div className="space-y-4 pt-1">
                    {campaignRecommendations.map((campaign, idx) => (
                      <div key={idx} className="p-4 rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCDAD4] pb-2.5">
                          <div>
                            <h4 className="font-bold text-xs text-[#101828]">{campaign.campaignName}</h4>
                            <p className="text-[11px] text-[#5F6875]">{campaign.reason}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F3EE] text-[#101828] border border-[#DCDAD4]">
                              {campaign.category}
                            </span>
                            {campaign.subTheme && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FCFCFA] text-[#5F6875] border border-[#DCDAD4]">
                                {campaign.subTheme}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded space-y-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#198754] block">
                              Producto Principal (Alta Rotación)
                            </span>
                            <p className="font-medium text-[#101828] truncate" title={campaign.primaryProduct.title}>
                              {campaign.primaryProduct.sku ? `[${campaign.primaryProduct.sku}] ` : ""}{campaign.primaryProduct.title}
                            </p>
                            <div className="text-[11px] font-mono text-[#5F6875] flex justify-between pt-1 border-t border-[#DCDAD4]">
                              <span>{campaign.primaryProduct.unitsSold} vendidas</span>
                              <span className="font-semibold text-[#101828]">${campaign.primaryProduct.revenue.toLocaleString("es-AR")}</span>
                            </div>
                          </div>

                          <div className="p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#102A56]">
                                Publicación Líder para Anunciar
                              </span>
                              {campaign.bestPublication.permalink && (
                                <a
                                  href={campaign.bestPublication.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] text-[#102A56] hover:underline flex items-center gap-0.5 font-semibold"
                                >
                                  Ver <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                            <p className="font-medium text-[#101828] truncate" title={campaign.bestPublication.title}>
                              {campaign.bestPublication.title}
                            </p>
                            <div className="text-[11px] font-mono text-[#5F6875] flex justify-between pt-1 border-t border-[#DCDAD4]">
                              <span>${campaign.bestPublication.price.toLocaleString("es-AR")}</span>
                              <span>{campaign.bestPublication.listingType}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </OperationalPanel>
            </div>

            <div className="lg:col-span-4">
              <OperationalPanel
                title="Top SKUs del Período"
                description="Desglose por referencia y publicación más vendedora."
              >
                <div className="space-y-3 pt-1">
                  {campaignTopProducts.length === 0 ? (
                    <p className="text-xs text-[#5F6875] text-center py-6">Sin ventas en este período.</p>
                  ) : (
                    campaignTopProducts.map((p, idx) => (
                      <div key={idx} className="p-2.5 rounded border border-[#DCDAD4] bg-[#FCFCFA] space-y-1 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-[#101828] truncate max-w-[190px]" title={p.title}>
                            #{idx + 1} {p.sku ? `[${p.sku}] ` : ""}{p.title}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[#5F6875] flex justify-between">
                          <span>{p.unitsSold} u.</span>
                          <span className="font-semibold text-[#101828]">${p.revenue.toLocaleString("es-AR")}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </OperationalPanel>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: ANALÍTICA DE VENTAS */}
        <TabsContent value="sales" className="space-y-6 outline-none">
          <SalesAnalytics
            provinceSales={provinceSales}
            paymentTypeData={paymentTypeData}
            installmentDetails={installmentDetails}
          />
        </TabsContent>

        {/* TAB 5: ANALIZADOR DE COMPETENCIA */}
        <TabsContent value="competitors" className="space-y-6 outline-none">
          <CompetitorAnalyzer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
