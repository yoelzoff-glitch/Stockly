import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { TrendingUp, ShoppingBag, CreditCard, AlertTriangle } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Recent orders
  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, date_created")
    .eq("tenant_id", tenantId)
    .order("date_created", { ascending: false });

  // Low stock products
  const { data: lowStockProducts } = await supabase
    .from("products")
    .select("title, available_quantity")
    .eq("tenant_id", tenantId)
    .lte("available_quantity", 5)
    .order("available_quantity", { ascending: true })
    .limit(5);

  // Top products
  const { data: topProducts } = await supabase
    .from("products")
    .select("title, sold_quantity")
    .eq("tenant_id", tenantId)
    .order("sold_quantity", { ascending: false })
    .limit(5);

  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0;
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const chartData = topProducts?.filter(p => p.sold_quantity && p.sold_quantity > 0).map(p => ({
    name: p.title || "Producto",
    value: p.sold_quantity || 0
  })) || [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analíticas</h2>
      </div>
      <p className="text-muted-foreground">Métricas en profundidad del rendimiento de tu negocio.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
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
            <div className="text-2xl font-bold">${averageTicket.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Gasto promedio por orden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riesgo de Quiebre</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Productos con stock crítico (≤ 5)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Histórico de Ventas</CardTitle>
            <CardDescription>
              Resumen de ingresos generados a lo largo del tiempo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart data={orders || []} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Productos Destacados</CardTitle>
            <CardDescription>
              Tus artículos más populares y vendidos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsChart data={chartData} />
          </CardContent>
        </Card>
      </div>
      
      {lowStockProducts && lowStockProducts.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Atención: Stock Bajo</CardTitle>
            <CardDescription>
              Estos productos están a punto de agotarse. Considera reponer inventario pronto.
            </CardDescription>
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
