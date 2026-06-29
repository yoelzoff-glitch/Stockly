"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Package, Activity, Eye, EyeOff } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell, Legend } from "recharts";
import { SearchInput } from "@/components/ui/search-input";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MobileFilterDrawer } from "@/components/ui/mobile-filter-drawer";
import { toggleIgnoreOrderAction } from "@/actions/orders";
import { useTransition } from "react";

export default function SalesClientPage({ 
  initialOrders, 
  allPeriodOrders,
  totalCount,
  currentPage,
  searchQuery,
  currentStatus,
  currentDays,
  ignoredOrderIds = []
}: { 
  initialOrders: any[],
  allPeriodOrders: any[],
  totalCount: number,
  currentPage: number,
  searchQuery: string,
  currentStatus: string,
  currentDays: string | number,
  ignoredOrderIds?: string[]
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    params.delete("page"); // Reset page
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = () => {
    window.location.href = `/api/sales/export?days=${currentDays}&status=${currentStatus}&search=${encodeURIComponent(searchQuery)}`;
  };

  const handleToggleIgnore = async (orderId: string, isIgnored: boolean) => {
    startTransition(async () => {
      const res = await toggleIgnoreOrderAction(orderId, isIgnored);
      if (res.error) {
        alert(res.error);
      }
    });
  };

  // KPIs use allPeriodOrders to be accurate regardless of pagination
  // Exclude ignored orders
  const activePeriodOrders = allPeriodOrders.filter(o => !ignoredOrderIds.includes(o.meli_order_id) && o.status !== "cancelled");
  const totalSales = activePeriodOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalOrdersCount = activePeriodOrders.length;
  const avgTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  const salesToday = activePeriodOrders.filter(o => new Date(o.date_created) >= today)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Chart Data preparation
  let chartLength = typeof currentDays === 'number' ? currentDays : parseInt(currentDays as string) || 30;
  let startForChart = new Date();
  if (currentDays === "current_month") {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    chartLength = today.getDate();
    startForChart = startOfMonth;
  } else {
    startForChart.setDate(startForChart.getDate() - (chartLength - 1));
  }
  startForChart.setHours(0,0,0,0);

  const chartData = Array.from({ length: chartLength }, (_, i) => {
    const d = new Date(startForChart);
    d.setDate(d.getDate() + i);
    d.setHours(0,0,0,0);
    return {
      dateObj: d,
      name: d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
      total: 0
    };
  });

  activePeriodOrders.forEach(o => {
    const d = new Date(o.date_created);
    d.setHours(0,0,0,0);
    const dayIndex = chartData.findIndex(cd => cd.dateObj.getTime() === d.getTime());
    if (dayIndex !== -1) {
      chartData[dayIndex].total += (Number(o.total_amount) || 0);
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
    .map(entry => ({ name: entry[0].length > 20 ? entry[0].substring(0, 20) + "..." : entry[0], value: entry[1] }));
    
  if (categoryData.length === 0) {
    categoryData.push({ name: "Sin datos", value: 1 });
  }

  // Dynamic AI Insights
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const salesYesterday = activePeriodOrders.filter(o => {
    const d = new Date(o.date_created);
    d.setHours(0,0,0,0);
    return d.getTime() === yesterday.getTime();
  }).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  let todayVsYesterdayMsg = "Tus ventas de hoy están igualadas con las de ayer.";
  let todayVsYesterdayColor = "text-blue-500";
  let todayVsYesterdayIcon = Activity;

  if (salesToday > salesYesterday) {
    const increase = salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : 100;
    todayVsYesterdayMsg = `Tus ventas de hoy superan las de ayer en un ${increase.toFixed(1)}%.`;
    todayVsYesterdayColor = "text-emerald-500";
    todayVsYesterdayIcon = TrendingUp;
  } else if (salesToday < salesYesterday && salesToday > 0) {
    const decrease = salesYesterday > 0 ? ((salesYesterday - salesToday) / salesYesterday) * 100 : 0;
    todayVsYesterdayMsg = `Tus ventas de hoy están un ${decrease.toFixed(1)}% por debajo de las de ayer.`;
    todayVsYesterdayColor = "text-orange-500";
    todayVsYesterdayIcon = TrendingDown;
  }

  const topProduct = Object.entries(productSales).sort((a,b) => b[1] - a[1])[0];
  const topProductMsg = topProduct ? `Tu producto líder es '${topProduct[0]}' generó $${topProduct[1].toLocaleString('es-AR')} en este periodo.` : "Sin suficientes datos.";

  const insights = [
    { title: "Rendimiento Diario", desc: todayVsYesterdayMsg, icon: todayVsYesterdayIcon, color: todayVsYesterdayColor },
    { title: "Producto Estrella", desc: topProductMsg, icon: ShoppingBag, color: "text-blue-500" },
    { title: "Ticket Promedio", desc: `Tu ticket promedio actual es de $${avgTicket.toLocaleString('es-AR', { maximumFractionDigits: 0 })} por orden.`, icon: DollarSign, color: "text-indigo-500" }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ventas y Analíticas</h2>
          <p className="text-muted-foreground mt-1">Monitorea el rendimiento de tu negocio en tiempo real.</p>
        </div>
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Exportar a CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesToday.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Periodo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground">
              {currentDays === "current_month" ? "Mes actual" : `Últimos ${currentDays} días`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdersCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {insights.map((insight, idx) => (
          <Card key={idx} className="bg-primary/5 border-primary/10">
            <CardContent className="p-4 flex items-start gap-4">
              <div className={`p-2 rounded-full bg-background ${insight.color}`}>
                <insight.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">{insight.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{insight.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ingresos en el tiempo</CardTitle>
          </CardHeader>
          <CardContent className="pl-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Productos Vendidos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pb-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Historial de Órdenes</CardTitle>
              <CardDescription>Detalle de todas tus ventas.</CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="w-full sm:w-64">
                <SearchInput placeholder="Buscar orden, comprador, producto..." />
              </div>

              {/* Desktop Filters */}
              <div className="hidden sm:flex items-center gap-3">
                <select 
                  value={currentStatus} 
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="flex h-9 w-full sm:w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="all">Todos</option>
                  <option value="paid">Pagado</option>
                  <option value="cancelled">Cancelado</option>
                </select>

                <select 
                  value={currentDays} 
                  onChange={(e) => handleFilterChange("days", e.target.value)}
                  className="flex h-9 w-full sm:w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="current_month">Mes actual</option>
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="90">Últimos 3 meses</option>
                </select>
              </div>

              {/* Mobile Filters */}
              <div className="w-full sm:hidden">
                <MobileFilterDrawer
                  onClear={() => {
                    handleFilterChange("status", "all");
                    handleFilterChange("days", "7");
                  }}
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estado</label>
                      <select 
                        value={currentStatus} 
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm"
                      >
                        <option value="all">Todos</option>
                        <option value="paid">Pagado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Período</label>
                      <select 
                        value={currentDays} 
                        onChange={(e) => handleFilterChange("days", e.target.value)}
                        className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm"
                      >
                        <option value="current_month">Mes actual</option>
                        <option value="7">Últimos 7 días</option>
                        <option value="30">Últimos 30 días</option>
                        <option value="90">Últimos 3 meses</option>
                      </select>
                    </div>
                  </div>
                </MobileFilterDrawer>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Nº Orden</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                          <ShoppingBag className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No hay ventas en este período</h3>
                        <p className="text-sm text-slate-500 mt-1">Probá sincronizar órdenes o cambiar el filtro de fechas.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  initialOrders.map((o) => {
                    const isIgnored = ignoredOrderIds.includes(o.meli_order_id);
                    return (
                      <tr 
                        key={o.id} 
                        onClick={() => router.push(`/dashboard/sales/${o.id}`)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isIgnored ? 'opacity-50 bg-slate-100/50 line-through decoration-slate-400' : ''}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(o.date_created).toLocaleDateString("es-AR")}
                        </td>
                        <td className="px-4 py-3 font-medium">#{o.meli_order_id}</td>
                        <td className="px-4 py-3">{o.buyer_nickname || "Anónimo"}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate" title={o.product_title || ""}>
                          {o.product_title || "Varios productos"}
                        </td>
                        <td className="px-4 py-3 text-right">{o.total_quantity || 1}</td>
                        <td className="px-4 py-3 font-medium text-right">
                          ${Number(o.total_amount).toLocaleString("es-AR")}
                        </td>
                        <td className="px-4 py-3">
                          {isIgnored ? (
                            <StatusBadge variant="neutral">Omitido (Prueba)</StatusBadge>
                          ) : (
                            <StatusBadge variant={o.status === 'paid' ? 'success' : 'neutral'}>
                               {o.status === 'paid' ? 'Pagado' : o.status}
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
                            className="h-8 w-8 p-0"
                          >
                            {isIgnored ? (
                              <Eye className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-slate-500" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {totalCount > 50 && (
            <div className="flex items-center justify-between px-4 py-4 border-t bg-muted/10">
              <div className="text-sm text-muted-foreground">
                Mostrando {initialOrders.length} de {totalCount} órdenes
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage <= 1}
                  onClick={() => handleFilterChange("page", (currentPage - 1).toString())}
                >
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage * 50 >= totalCount}
                  onClick={() => handleFilterChange("page", (currentPage + 1).toString())}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
