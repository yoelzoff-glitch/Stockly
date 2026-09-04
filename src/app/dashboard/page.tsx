import { createClient } from "@/lib/supabase/server";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { SystemMonitor } from "@/components/dashboard/system-monitor";
import { OperationalMetricsStrip } from "@/components/dashboard/operational-metrics-strip";
import { AlertCircle, CheckCircle2, RefreshCw, ArrowRight, MessageSquare, ShieldCheck, HelpCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCachedOrders } from "@/lib/cache";
import { getActivationProgress } from "@/actions/activation";
import { DashboardPeriodSelector } from "@/components/dashboard/dashboard-period-selector";
import { Suspense } from "react";
import { DailySummarySection } from "@/components/dashboard/daily-summary-section";
import { InsightsSection } from "@/components/dashboard/insights-section";
import { DailySummarySkeleton, InsightsSkeleton } from "@/components/dashboard/section-skeleton";
import { getMidnightInTimezone } from "@/services/ai/tools/finance";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage(props: PageProps) {
  const resolvedParams = await props.searchParams;
  const daysParam = typeof resolvedParams?.days === "string" ? resolvedParams.days : "7";
  const days = ["7", "15", "30", "90"].includes(daysParam) ? parseInt(daysParam, 10) : 7;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Check Meli account status
  const { data: meliAccount, error: meliAccountError } = await supabase
    .from("meli_accounts")
    .select("id, status, last_sync_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (meliAccountError) {
    throw new Error("No se pudo verificar la conexión con Mercado Libre");
  }

  const isMeliConnected = !!meliAccount;

  if (!isMeliConnected) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white border border-[#DCDAD4] shadow-xs">
          <AlertCircle className="h-8 w-8 text-[#5F6875]" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-[#101828]">
          Todavía no conectaste Mercado Libre
        </h2>
        <p className="mt-1.5 mb-6 text-sm text-[#5F6875] max-w-md">
          Para ver tus métricas de ventas, stock y productos, primero necesitas vincular tu cuenta de Mercado Libre con Klyvo.
        </p>
        <Link
          href="/dashboard/get-started"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors"
        >
          Ir a Guía de Inicio
        </Link>
      </div>
    );
  }

  // Fetch all real data in parallel to maximize performance
  const [
    { data: tenant },
    recentOrdersRaw,
    { data: allProducts },
    { data: recentMessages },
    activation,
  ] = await Promise.all([
    supabase.from("tenants").select("timezone, metadata").eq("id", tenantId).maybeSingle(),
    getCachedOrders(tenantId, days + 1),
    supabase.from("products").select("id, title, cost, sku, available_quantity, sold_quantity, margin_percent, margin_amount, estimated_fee").eq("tenant_id", tenantId),
    supabase.from("messages").select("text, direction, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(3),
    getActivationProgress(),
  ]);

  const timezone = tenant?.timezone || "America/Argentina/Buenos_Aires";
  const ignoredOrderIds = (tenant?.metadata as any)?.ignored_order_ids || [];
  const today = getMidnightInTimezone(new Date(), timezone);

  const recentOrders = (recentOrdersRaw || []).filter(
    (o) => o.status !== "cancelled" && !ignoredOrderIds.includes(o.meli_order_id)
  );

  // Calculate metrics
  let salesToday = 0;
  let revenuePeriod = 0;

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - days);
  const periodStart = getMidnightInTimezone(pastDate, timezone);

  recentOrders?.forEach((order) => {
    const orderDate = new Date(order.date_created);
    if (orderDate >= periodStart) {
      revenuePeriod += Number(order.total_amount) || 0;
    }
    if (orderDate >= today) {
      salesToday += Number(order.total_amount) || 0;
    }
  });

  // Group products by SKU to unify standard/premium listings
  const groupedProductsMap = new Map<string, any>();
  const nonSkuProducts: any[] = [];

  (allProducts || []).forEach((p) => {
    const sku = p.sku?.trim();
    if (!sku) {
      nonSkuProducts.push({ ...p });
      return;
    }

    const existing = groupedProductsMap.get(sku);
    if (existing) {
      existing.sold_quantity = (existing.sold_quantity || 0) + (p.sold_quantity || 0);
      existing.available_quantity = Math.max(existing.available_quantity || 0, p.available_quantity || 0);
      if (p.margin_percent !== null && p.margin_percent !== undefined) {
        if (existing.margin_percent !== null && existing.margin_percent !== undefined) {
          existing.margin_percent = (existing.margin_percent + p.margin_percent) / 2;
        } else {
          existing.margin_percent = p.margin_percent;
        }
      }
      if ((p.sold_quantity || 0) > (existing._raw_sold_quantity || 0)) {
        existing.title = p.title;
        existing._raw_sold_quantity = p.sold_quantity || 0;
      }
    } else {
      groupedProductsMap.set(sku, {
        ...p,
        _raw_sold_quantity: p.sold_quantity || 0,
      });
    }
  });

  const aggregatedProducts = [
    ...Array.from(groupedProductsMap.values()),
    ...nonSkuProducts,
  ];

  const totalProductsCount = aggregatedProducts.length;
  const lowStockCount = aggregatedProducts.filter((p) => p.available_quantity <= 5).length;
  const missingCostsCount = (allProducts || []).filter((p) => p.cost === null || p.cost === undefined).length;

  // Top products
  const topProducts = [...aggregatedProducts]
    .sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0))
    .slice(0, 5);
  const topProduct = topProducts[0];

  const chartData = topProducts
    .filter((p) => p.sold_quantity && p.sold_quantity > 0)
    .map((p) => ({
      name: p.sku ? `[${p.sku}] ${p.title}` : p.title || "Producto",
      value: p.sold_quantity || 0,
    }));

  // Top products by margin
  const topMarginProducts = [...aggregatedProducts]
    .filter((p) => p.margin_percent !== null && p.margin_percent !== undefined)
    .sort((a, b) => (b.margin_percent || 0) - (a.margin_percent || 0))
    .slice(0, 3);

  const bottomMarginProducts = [...aggregatedProducts]
    .filter((p) => p.margin_percent !== null && p.margin_percent !== undefined)
    .sort((a, b) => (a.margin_percent || 0) - (b.margin_percent || 0))
    .slice(0, 3);

  const missingFeesCount = aggregatedProducts.filter(
    (p) => p.estimated_fee === null || p.estimated_fee === undefined
  ).length;

  // Time formatting helper
  const formatTimeAgo = (dateStr: string) => {
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "hace instantes";
    if (diffMins < 60) return `hace ${diffMins} min`;
    return `hace ${Math.floor(diffMins / 60)} hs`;
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 max-w-[1400px] mx-auto">
      
      {/* 4.1 Encabezado operativo y barra de controles compacta */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#DCDAD4] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#101828]">
            Resumen de la operación
          </h1>
          <p className="text-xs sm:text-sm text-[#5F6875] mt-1">
            Ventas, rentabilidad y estado del negocio para el período seleccionado.
          </p>
        </div>

        {/* Barra de controles compacta */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border border-[#DCDAD4] shadow-xs">
          <DashboardPeriodSelector />

          <div className="h-4 w-px bg-[#DCDAD4] hidden sm:block" />

          {/* Estado de sincronización */}
          <div className="flex items-center gap-2 text-xs font-semibold px-2">
            {meliAccount.status === "syncing" ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-[#102A56] animate-spin" />
                <span className="text-[#102A56]">Sincronizando...</span>
              </>
            ) : meliAccount.status === "error" ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-[#D92D20]" />
                <span className="text-[#D92D20]">Error de sync</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#198754]" />
                <span className="text-[#101828]">
                  Sincronizado {meliAccount.last_sync_at ? formatTimeAgo(meliAccount.last_sync_at as string) : "recientemente"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4.2 Configuración inicial compacta */}
      {activation.percentage < 100 && (
        <div className="bg-white border border-[#DCDAD4] p-5 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Configuración inicial
              </span>
              <span className="text-xs text-[#5F6875]">•</span>
              <span className="text-xs font-semibold text-[#101828] tabular-nums">
                {activation.completedSteps} de {activation.totalSteps} pasos completados
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#5F6875] leading-relaxed">
              Completá los datos necesarios para calcular correctamente costos, márgenes y rentabilidad.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <div className="h-2 w-48 bg-[#F5F3EE] rounded-full overflow-hidden border border-[#DCDAD4]">
                <div
                  className="h-full bg-[#102A56] rounded-full transition-all duration-300"
                  style={{ width: `${activation.percentage}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#101828] tabular-nums">
                {activation.percentage}%
              </span>
            </div>
          </div>

          <Link
            href="/dashboard/get-started"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shrink-0"
          >
            <span>Continuar configuración</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4.3 Alerta operativa de productos sin costo */}
      {missingCostsCount > 0 && (
        <div className="bg-white border border-[#DCDAD4] border-l-4 border-l-[#F2C94C] p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#B54708] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#101828]">
                Hay {missingCostsCount} {missingCostsCount === 1 ? "producto" : "productos"} sin costo
              </h2>
              <p className="text-xs text-[#5F6875] mt-0.5">
                La rentabilidad de las ventas asociadas todavía no puede calcularse correctamente.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#101828] bg-[#F5F3EE] hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors shrink-0"
          >
            <span>Cargar costos ahora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* 4.4 Franja estructurada de indicadores */}
      <OperationalMetricsStrip
        salesToday={salesToday}
        revenuePeriod={revenuePeriod}
        days={days}
        totalProductsCount={totalProductsCount}
        lowStockCount={lowStockCount}
        topProduct={topProduct}
      />

      {/* 4.5 Prioridades de hoy */}
      <Suspense fallback={<InsightsSkeleton />}>
        <InsightsSection tenantId={tenantId} />
      </Suspense>

      {/* 4.7 Área principal de análisis con jerarquía clara */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Columna Principal (7 cols): Ventas, Rentabilidad y Top Productos */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Evolución de ventas e ingresos */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#101828]">
                  Evolución de ventas e ingresos
                </h2>
                <p className="text-xs text-[#5F6875] mt-0.5">
                  Facturación bruta diaria en los últimos {days} días.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#5F6875] tabular-nums">
                $ {revenuePeriod.toLocaleString("es-AR")}
              </span>
            </div>
            <OverviewChart data={recentOrders || []} days={days} timezone={timezone} />
          </div>

          {/* Rentabilidad estimada */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#101828]">
                  Rentabilidad estimada
                </h2>
                <p className="text-xs text-[#5F6875] mt-0.5">
                  Márgenes calculados sobre productos con costos de reposición cargados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Mejor margen */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#198754] block">
                  Mejor margen neto
                </span>
                {topMarginProducts && topMarginProducts.length > 0 ? (
                  <ul className="divide-y divide-[#DCDAD4]/60">
                    {topMarginProducts.map((p, i) => (
                      <li key={i} className="py-2 flex justify-between items-center text-xs">
                        <span className="truncate max-w-[180px] font-medium text-[#101828]" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                          {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                        </span>
                        <span className="font-bold text-[#198754] tabular-nums ml-2">
                          {p.margin_percent?.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#5F6875] italic py-2">
                    Cargá los costos para comenzar a calcular márgenes.
                  </p>
                )}
              </div>

              {/* Peor margen */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#D92D20] block">
                  Menor margen neto
                </span>
                {bottomMarginProducts && bottomMarginProducts.length > 0 ? (
                  <ul className="divide-y divide-[#DCDAD4]/60">
                    {bottomMarginProducts.map((p, i) => (
                      <li key={i} className="py-2 flex justify-between items-center text-xs">
                        <span className="truncate max-w-[180px] font-medium text-[#101828]" title={p.sku ? `[${p.sku}] ${p.title}` : p.title}>
                          {p.sku ? `[${p.sku}] ${p.title}` : p.title}
                        </span>
                        <span className="font-bold text-[#D92D20] tabular-nums ml-2">
                          {p.margin_percent?.toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#5F6875] italic py-2">
                    No hay suficientes publicaciones con margen asignado.
                  </p>
                )}
              </div>
            </div>

            {missingFeesCount > 0 && (
              <p className="text-[11px] text-[#5F6875] pt-3 border-t border-[#DCDAD4] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#B54708] shrink-0" />
                <span>{missingFeesCount} publicaciones pendientes de estimación de comisión de Mercado Libre.</span>
              </p>
            )}
          </div>

          {/* Productos más vendidos */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#101828]">
                  Productos más vendidos
                </h2>
                <p className="text-xs text-[#5F6875] mt-0.5">
                  Volumen de unidades despachadas en el período.
                </p>
              </div>
            </div>
            <TopProductsChart data={chartData} />
          </div>

        </div>

        {/* Columna Secundaria (5 cols): Estado de Operación, Resumen, Monitoreo y Actividad */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Panel: Estado de la operación */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <h2 className="text-sm font-bold text-[#101828]">
                Estado de la operación
              </h2>
              <span className="text-[11px] font-semibold text-[#198754] bg-[#F5F3EE] px-2 py-0.5 rounded border border-[#DCDAD4]">
                Operativo
              </span>
            </div>

            <div className="divide-y divide-[#DCDAD4] text-xs">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5F6875]">Conexión Mercado Libre</span>
                <span className="font-semibold text-[#101828] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#198754]" /> Activa (OAuth)
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5F6875]">Última sincronización</span>
                <span className="font-semibold text-[#101828]">
                  {meliAccount.last_sync_at ? formatTimeAgo(meliAccount.last_sync_at as string) : "Reciente"}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5F6875]">Publicaciones sin costo</span>
                <span className={`font-semibold tabular-nums ${missingCostsCount > 0 ? "text-[#B54708]" : "text-[#198754]"}`}>
                  {missingCostsCount}
                </span>
              </div>
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#5F6875]">Publicaciones en stock crítico</span>
                <span className={`font-semibold tabular-nums ${lowStockCount > 0 ? "text-[#D92D20]" : "text-[#101828]"}`}>
                  {lowStockCount}
                </span>
              </div>
            </div>
          </div>

          {/* 4.6 Lectura del día (Daily Summary) */}
          <Suspense fallback={<DailySummarySkeleton />}>
            <DailySummarySection tenantId={tenantId} />
          </Suspense>

          {/* Monitoreo del sistema en posición secundaria */}
          <SystemMonitor />

          {/* Actividad reciente */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#101828]">
                  Actividad reciente
                </h2>
                <p className="text-[11px] text-[#5F6875]">
                  Consultas y registros recientes
                </p>
              </div>
              <Link
                href="/dashboard/messages"
                className="text-xs font-semibold text-[#102A56] hover:underline"
              >
                Ver mensajes
              </Link>
            </div>

            {recentMessages && recentMessages.length > 0 ? (
              <div className="space-y-2.5">
                {recentMessages.map((msg, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#F5F3EE] text-xs space-y-0.5">
                    <span className="font-bold text-[#101828] uppercase text-[10px] block">
                      {msg.direction === "inbound" ? "Consulta" : "Klyvo"}
                    </span>
                    <p className="line-clamp-1 text-[#5F6875]">
                      {msg.text}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5F6875] italic py-1">
                No hay actividad reciente registrada en este canal.
              </p>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
