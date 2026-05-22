"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Search, TrendingUp, TrendingDown, DollarSign, ShoppingBag, Package } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Legend } from "recharts";

export default function SalesClientPage({ initialOrders }: { initialOrders: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30"); // days

  // Filter logic
  const filteredOrders = initialOrders.filter((o) => {
    const matchesSearch = o.buyer_nickname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.meli_order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.product_title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    
    const orderDate = new Date(o.date_created);
    const today = new Date();
    const diffDays = Math.ceil((today.getTime() - orderDate.getTime()) / (1000 * 3600 * 24));
    const matchesDate = diffDays <= parseInt(dateRange);

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Export Logic
  const handleExport = () => {
    window.location.href = `/api/sales/export?days=${dateRange}&status=${statusFilter}&search=${encodeURIComponent(searchTerm)}`;
  };

  // KPIs
  const totalSales = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  const salesToday = filteredOrders.filter(o => new Date(o.date_created) >= today)
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  // Mocked AI Insights
  const insights = [
    { title: "Tendencia Positiva", desc: "Tus ventas aumentaron un 12% respecto a la semana pasada.", icon: TrendingUp, color: "text-green-500" },
    { title: "Atención", desc: "El producto 'Zapatillas Running' bajó sus ventas en un 30%.", icon: TrendingDown, color: "text-red-500" },
    { title: "Oportunidad", desc: "El margen neto promedio subió a 22%. Recomendamos mantener estrategia.", icon: TrendingUp, color: "text-green-500" }
  ];

  // Chart Data preparation (Mocked/Simplified for demo)
  // In a real app, we'd group by day.
  const chartData = [
    { name: "Lun", total: 4000 },
    { name: "Mar", total: 3000 },
    { name: "Mie", total: 2000 },
    { name: "Jue", total: 2780 },
    { name: "Vie", total: 1890 },
    { name: "Sab", total: 2390 },
    { name: "Dom", total: 3490 },
  ];

  const categoryData = [
    { name: "Electrónica", value: 400 },
    { name: "Ropa", value: 300 },
    { name: "Hogar", value: 300 },
    { name: "Otros", value: 200 },
  ];
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      
      {/* Header & Export */}
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

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${salesToday.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground">+20.1% respecto a ayer</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Periodo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toLocaleString("es-AR")}</div>
            <p className="text-xs text-muted-foreground">Últimos {dateRange} días</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">Por orden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes Totales</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdersCount}</div>
            <p className="text-xs text-muted-foreground">Completadas exitosamente</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights IA */}
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

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ingresos en el tiempo</CardTitle>
            <CardDescription>Evolución de ventas en el periodo seleccionado</CardDescription>
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
            <CardTitle>Distribución por Categoría</CardTitle>
            <CardDescription>Top categorías vendidas</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pb-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
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

      {/* Table Section */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Historial de Órdenes</CardTitle>
              <CardDescription>Detalle de todas tus ventas recientes.</CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar orden, SKU o comprador..."
                  className="pl-9 bg-muted/50 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full sm:w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="all">Todos</option>
                <option value="paid">Pagado</option>
                <option value="cancelled">Cancelado</option>
              </select>

              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className="flex h-9 w-full sm:w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="7">Últimos 7 días</option>
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 3 meses</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Nº Orden</th>
                  <th className="px-4 py-3 font-medium">Comprador</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No se encontraron órdenes con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Intl.DateTimeFormat("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        }).format(new Date(o.date_created))}
                      </td>
                      <td className="px-4 py-3 font-medium">#{o.meli_order_id}</td>
                      <td className="px-4 py-3">{o.buyer_nickname || "Anónimo"}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={o.product_title || "Varios productos"}>
                        {o.product_title || "Varios productos"}
                      </td>
                      <td className="px-4 py-3 text-right">{o.total_quantity || 1}</td>
                      <td className="px-4 py-3 font-medium text-right">
                        ${Number(o.total_amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={o.status === 'paid' ? 'default' : 'secondary'} className={o.status === 'paid' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                          {o.status === 'paid' ? 'Pagado' : o.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
