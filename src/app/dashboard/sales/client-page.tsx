"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Download,
  DollarSign,
  ShoppingBag,
  Package,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  EyeOff,
  Calendar
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell, Legend } from "recharts";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalToolbar } from "@/components/operational/toolbar";
import { OperationalPanel } from "@/components/operational/panel";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { toggleIgnoreOrderAction } from "@/actions/orders";
import {
  getMidnightInTimezone,
  getTenantDateString,
  getPeriodRangeInTimezone,
  DEFAULT_TIMEZONE
} from "@/lib/dates";

export default function SalesClientPage({
  initialOrders,
  allPeriodOrders,
  totalCount,
  currentPage,
  searchQuery,
  currentStatus,
  currentDays,
  fromDate = "",
  toDate = "",
  ignoredOrderIds = [],
  timezone = DEFAULT_TIMEZONE
}: {
  initialOrders: any[],
  allPeriodOrders: any[],
  totalCount: number,
  currentPage: number,
  searchQuery: string,
  currentStatus: string,
  currentDays: string | number,
  fromDate?: string,
  toDate?: string,
  ignoredOrderIds?: string[],
  timezone?: string
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = () => {
    const fromParam = fromDate ? `&from=${fromDate}` : "";
    const toParam = toDate ? `&to=${toDate}` : "";
    window.location.href = `/api/sales/export?days=${currentDays}&status=${currentStatus}&search=${encodeURIComponent(searchQuery)}${fromParam}${toParam}`;
  };

  const handleToggleIgnore = async (orderId: string, isIgnored: boolean) => {
    startTransition(async () => {
      const res = await toggleIgnoreOrderAction(orderId, isIgnored);
      if (res.error) {
        alert(res.error);
      }
    });
  };

  // Exclude ignored & cancelled orders from main revenue KPI
  const activePeriodOrders = allPeriodOrders.filter(
    o => !ignoredOrderIds.includes(o.meli_order_id) && o.status !== "cancelled"
  );
  const totalSales = activePeriodOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalOrdersCount = activePeriodOrders.length;
  const avgTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  const todayMidnight = getMidnightInTimezone(new Date(), timezone);
  const salesToday = activePeriodOrders
    .filter(o => new Date(o.date_created) >= todayMidnight)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Chart Data preparation
  const { dateFrom: chartStartFrom } = getPeriodRangeInTimezone(currentDays, timezone, fromDate, toDate);
  const daysDiff = Math.max(1, Math.ceil((new Date().getTime() - chartStartFrom.getTime()) / (1000 * 60 * 60 * 24)));
  let chartLength = daysDiff;
  if (currentDays === "current_month") {
    chartLength = Math.max(1, Math.ceil((todayMidnight.getTime() - chartStartFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  } else if (currentDays === "previous_month") {
    const { dateTo: chartEndTo } = getPeriodRangeInTimezone("previous_month", timezone);
    chartLength = Math.max(1, Math.ceil((chartEndTo.getTime() - chartStartFrom.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (typeof currentDays === "number" || (!isNaN(Number(currentDays)) && currentDays !== "custom")) {
    chartLength = Number(currentDays);
  }

  const chartData = Array.from({ length: chartLength }, (_, i) => {
    const dRef = new Date(chartStartFrom.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = getTenantDateString(dRef, timezone);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObjForLabel = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const name = dateObjForLabel.toLocaleDateString("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" });

    return {
      dateStr,
      name,
      total: 0
    };
  });

  activePeriodOrders.forEach(o => {
    const dateStr = getTenantDateString(new Date(o.date_created), timezone);
    const cd = chartData.find(c => c.dateStr === dateStr);
    if (cd) {
      cd.total += (Number(o.total_amount) || 0);
    }
  });

  const productSales: Record<string, number> = {};
  activePeriodOrders.forEach(o => {
    const title = o.product_title || "Varios / Otros";
    productSales[title] = (productSales[title] || 0) + (Number(o.total_amount) || 0);
  });

  const categoryData = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(entry => ({
      name: entry[0].length > 22 ? entry[0].substring(0, 22) + "..." : entry[0],
      value: entry[1]
    }));

  if (categoryData.length === 0) {
    categoryData.push({ name: "Sin datos", value: 1 });
  }

  // Daily performance comparison
  const yesterdayMidnight = getMidnightInTimezone(new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000), timezone);
  const salesYesterday = activePeriodOrders.filter(o => {
    const d = new Date(o.date_created);
    return d >= yesterdayMidnight && d < todayMidnight;
  }).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  let todayVsYesterdayMsg = "Ventas de hoy igualadas con las de ayer.";
  let todayVsYesterdayHighlight: "neutral" | "positive" | "warning" = "neutral";
  let TodayIcon = Activity;

  if (salesToday > salesYesterday) {
    const increase = salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : 100;
    todayVsYesterdayMsg = `Ventas de hoy superan ayer en un +${increase.toFixed(1)}%.`;
    todayVsYesterdayHighlight = "positive";
    TodayIcon = TrendingUp;
  } else if (salesToday < salesYesterday && salesToday > 0) {
    const decrease = salesYesterday > 0 ? ((salesYesterday - salesToday) / salesYesterday) * 100 : 0;
    todayVsYesterdayMsg = `Ventas de hoy ${decrease.toFixed(1)}% debajo de ayer.`;
    todayVsYesterdayHighlight = "warning";
    TodayIcon = TrendingDown;
  }

  const topProduct = Object.entries(productSales).sort((a,b) => b[1] - a[1])[0];
  const topProductMsg = topProduct
    ? `${topProduct[0]} ($${topProduct[1].toLocaleString('es-AR')})`
    : "Sin ventas en este período.";

  const observations = [
    {
      title: "Rendimiento diario",
      text: todayVsYesterdayMsg,
      icon: TodayIcon,
      highlight: todayVsYesterdayHighlight
    },
    {
      title: "Producto con mayor facturación",
      text: topProductMsg,
      icon: ShoppingBag,
      highlight: "neutral" as const
    },
    {
      title: "Ticket promedio del período",
      text: `$${avgTicket.toLocaleString('es-AR', { maximumFractionDigits: 0 })} por orden`,
      icon: DollarSign,
      highlight: "neutral" as const
    }
  ];

  const CHART_COLORS = ['#102A56', '#2563EB', '#F2C94C', '#198754'];

  const periodLabel =
    currentDays === "current_month" ? "Mes actual" :
    currentDays === "previous_month" ? "Mes anterior" :
    currentDays === "custom" ? `${fromDate || "..."} a ${toDate || "..."}` :
    `Últimos ${currentDays} días`;

  const metrics: MetricItem[] = [
    {
      label: "Ventas de hoy",
      value: `$${salesToday.toLocaleString("es-AR")}`,
      subtext: "Facturado desde 00:00 hs",
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      label: `Ventas (${periodLabel})`,
      value: `$${totalSales.toLocaleString("es-AR")}`,
      subtext: "Total acumulado en el período",
      icon: <TrendingUp className="w-4 h-4" />
    },
    {
      label: "Ticket Promedio",
      value: `$${avgTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Promedio neto por transacción",
      icon: <ShoppingBag className="w-4 h-4" />
    },
    {
      label: "Órdenes Totales",
      value: totalOrdersCount.toLocaleString("es-AR"),
      subtext: `${initialOrders.length} visibles en esta página`,
      icon: <Package className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Operación comercial"
        title="Ventas y facturación"
        description="Seguimiento de pedidos, volumen facturado y rendimiento de transacciones en Mercado Libre."
        actions={
          <Button
            onClick={handleExport}
            variant="outline"
            className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#5F6875]" />
            <span>Exportar CSV</span>
          </Button>
        }
      />

      {/* Barra de Filtros y Controles Operativos */}
      <OperationalToolbar>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Selector de estado */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Estado:</span>
            <select
              value={currentStatus}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
            >
              <option value="all">Todos los estados</option>
              <option value="paid">Pagados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>

          {/* Selector de periodo */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Período:</span>
            <select
              value={currentDays}
              onChange={(e) => handleFilterChange("days", e.target.value)}
              className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
            >
              <option value="current_month">Mes actual</option>
              <option value="previous_month">Mes anterior</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 3 meses</option>
              <option value="custom">Personalizado...</option>
            </select>
          </div>

          {/* Rango de fechas para Personalizado */}
          {currentDays === "custom" && (
            <div className="flex items-center gap-2 bg-[#F5F3EE] border border-[#DCDAD4] rounded-md px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#5F6875]" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => handleFilterChange("from", e.target.value)}
                className="bg-transparent border-0 text-xs focus:outline-none p-0 text-[#101828] font-medium"
              />
              <span className="text-[#5F6875] font-semibold text-[11px]">a</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => handleFilterChange("to", e.target.value)}
                className="bg-transparent border-0 text-xs focus:outline-none p-0 text-[#101828] font-medium"
              />
            </div>
          )}
        </div>

        {/* Buscador de órdenes */}
        <div className="w-full sm:w-72">
          <SearchInput placeholder="Buscar orden, comprador, producto..." />
        </div>
      </OperationalToolbar>

      {/* Franja de Indicadores Operativos */}
      <MetricStrip metrics={metrics} columns={4} />

      {/* Observaciones Operativas Compactas */}
      <div className="grid gap-3 sm:grid-cols-3">
        {observations.map((obs, idx) => (
          <div
            key={idx}
            className="p-3 bg-white border border-[#DCDAD4] rounded-lg shadow-sm flex items-start gap-3 text-xs"
          >
            <div className="p-1.5 rounded bg-[#F5F3EE] border border-[#DCDAD4] text-[#5F6875] shrink-0 mt-0.5">
              <obs.icon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold text-[11px] uppercase tracking-wider text-[#5F6875]">
                {obs.title}
              </p>
              <p className="text-xs font-semibold text-[#101828] truncate leading-tight" title={obs.text}>
                {obs.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Paneles de Análisis Gráfico */}
      <div className="grid gap-6 lg:grid-cols-7">
        <OperationalPanel
          title="Evolución de ingresos"
          description={`Facturación bruta acumulada (${periodLabel})`}
          className="lg:col-span-4"
        >
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSalesTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#102A56" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#102A56" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  stroke="#5F6875"
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  stroke="#5F6875"
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DCDAD4',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                  }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`, "Facturación"]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#102A56"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSalesTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </OperationalPanel>

        <OperationalPanel
          title="Distribución por producto"
          description="Participación en la facturación del período"
          className="lg:col-span-3"
        >
          <div className="h-[280px] w-full flex items-center justify-center">
            {activePeriodOrders.length === 0 ? (
              <p className="text-xs text-[#5F6875]">No hay ventas registradas para este período.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DCDAD4',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString('es-AR')}`, "Total"]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </OperationalPanel>
      </div>

      {/* Tabla de Órdenes */}
      <DataTableShell
        isEmpty={initialOrders.length === 0}
        emptyState={
          <OperationalEmptyState
            icon={ShoppingBag}
            title="No hay ventas en este período"
            description="No encontramos transacciones registradas con los filtros seleccionados. Probá ampliar el rango de fechas o sincronizar con Mercado Libre."
          />
        }
        pagination={{
          currentPage,
          totalCount,
          pageSize: 50,
          onPageChange: (newPage) => handleFilterChange("page", newPage.toString()),
          label: (
            <span>
              Mostrando <strong className="text-[#101828] font-semibold">{initialOrders.length}</strong> de{" "}
              <strong className="text-[#101828] font-semibold">{totalCount}</strong> órdenes registradas
            </span>
          )
        }}
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Nº Orden</th>
              <th className="px-4 py-3 font-semibold">Comprador</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold text-right">Cant.</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {initialOrders.map((o) => {
              const isIgnored = ignoredOrderIds.includes(o.meli_order_id);
              return (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/dashboard/sales/${o.id}`)}
                  className={`hover:bg-[#F5F3EE]/40 transition-colors cursor-pointer ${
                    isIgnored ? 'opacity-50 bg-[#F8FAFC] line-through decoration-slate-400' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-[#5F6875] whitespace-nowrap">
                    {new Date(o.date_created).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#101828] font-mono">
                    #{o.meli_order_id}
                  </td>
                  <td className="px-4 py-3 text-[#101828] font-medium truncate max-w-[140px]" title={o.buyer_nickname || "Anónimo"}>
                    {o.buyer_nickname || "Anónimo"}
                  </td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-[#101828]" title={o.product_title || ""}>
                    {o.product_title || "Varios productos"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#101828] font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {o.total_quantity || 1}
                  </td>
                  <td className="px-4 py-3 font-bold text-right text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${Number(o.total_amount).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    {isIgnored ? (
                      <StatusBadge variant="neutral">Omitido</StatusBadge>
                    ) : (
                      <StatusBadge variant={o.status === 'paid' ? 'success' : o.status === 'cancelled' ? 'danger' : 'neutral'}>
                        {o.status === 'paid' ? 'Pagado' : o.status === 'cancelled' ? 'Cancelado' : o.status}
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleIgnore(o.meli_order_id, isIgnored);
                      }}
                      title={isIgnored ? "Incluir en reportes" : "Omitir de reportes"}
                      className="h-7 w-7 p-0 text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
                    >
                      {isIgnored ? (
                        <Eye className="h-3.5 w-3.5 text-[#198754]" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-[#5F6875]" />
                      )}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
}
