import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { SalesCard } from "@/components/dashboard/sales-card";
import { RevenueCard } from "@/components/dashboard/revenue-card";
import { StockAlertCard } from "@/components/dashboard/stock-alert-card";
import { ProductCard } from "@/components/dashboard/product-card";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  // Check if Meli is connected
  const { count: meliCount } = await supabase
    .from("meli_accounts")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const isMeliConnected = meliCount && meliCount > 0;

  // If no integration, show empty state
  if (!isMeliConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">Todavía no conectaste Mercado Libre</h2>
        <p className="mt-2 mb-6 text-muted-foreground max-w-md">
          Para ver tus métricas de ventas, stock y productos, primero necesitas vincular tu cuenta de Mercado Libre con Stockly.
        </p>
        <Link href="/dashboard/integrations">
          <Button>Ir a Integraciones</Button>
        </Link>
      </div>
    );
  }

  // Fetch real data
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Orders last 7 days
  const { data: recentOrders } = await supabase
    .from("orders")
    .select("total_amount, date_created")
    .eq("tenant_id", tenantId)
    .gte("date_created", sevenDaysAgo.toISOString());

  // Calculate metrics
  let salesToday = 0;
  let revenueWeek = 0;

  recentOrders?.forEach(order => {
    const orderDate = new Date(order.date_created);
    revenueWeek += Number(order.total_amount) || 0;
    if (orderDate >= today) {
      salesToday += Number(order.total_amount) || 0;
    }
  });

  // Low stock products (less than or equal to 5)
  const { count: lowStockCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .lte("available_quantity", 5);

  // Top products
  const { data: topProducts } = await supabase
    .from("products")
    .select("title, sold_quantity")
    .eq("tenant_id", tenantId)
    .order("sold_quantity", { ascending: false })
    .limit(5);

  const topProduct = topProducts?.[0];

  const chartData = topProducts?.filter(p => p.sold_quantity && p.sold_quantity > 0).map(p => ({
    name: p.title || "Producto",
    value: p.sold_quantity || 0
  })) || [];

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SalesCard amount={salesToday} />
        <RevenueCard amount={revenueWeek} />
        <StockAlertCard count={lowStockCount || 0} />
        <ProductCard name={topProduct?.title || "Sin datos"} quantity={topProduct?.sold_quantity || 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas últimos 7 días</CardTitle>
            <CardDescription>
              Resumen de ingresos de la última semana.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart data={recentOrders || []} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>
              Distribución de ventas por producto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsChart data={chartData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
