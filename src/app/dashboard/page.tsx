import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { SalesCard } from "@/components/dashboard/sales-card";
import { RevenueCard } from "@/components/dashboard/revenue-card";
import { StockAlertCard } from "@/components/dashboard/stock-alert-card";
import { ProductCard } from "@/components/dashboard/product-card";
import { AlertCircle, CheckCircle2, MessageSquare, Package, RefreshCw, Sparkles, Lightbulb, ArrowRight, HeartPulse } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCachedOrders } from "@/lib/cache";
import { getOrCreateDailySummary } from "@/services/ai/dailySummary";
import { generateBusinessInsights } from "@/services/analytics/insights";
import { calculateBusinessHealth } from "@/services/health/calculateHealth";
import { getActivationProgress } from "@/actions/activation";

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

  // Check Meli account status
  const { data: meliAccount } = await supabase
    .from("meli_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  const isMeliConnected = !!meliAccount;

  if (!isMeliConnected) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight">Todavía no conectaste Mercado Libre</h2>
        <p className="mt-2 mb-6 text-muted-foreground max-w-md">
          Para ver tus métricas de ventas, stock y productos, primero necesitas vincular tu cuenta de Mercado Libre con Stockly.
        </p>
        <Link href="/dashboard/get-started">
          <Button>Ir a Guía de Inicio</Button>
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

  // Orders last 7 days using Cache
  const recentOrders = await getCachedOrders(tenantId);

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

  // Products count & low stock
  const { data: allProducts } = await supabase
    .from("products")
    .select("available_quantity, cost, estimated_fee")
    .eq("tenant_id", tenantId);

  const totalProductsCount = allProducts?.length || 0;
  const lowStockCount = allProducts?.filter(p => p.available_quantity <= 5).length || 0;

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

  // Top products by margin
  const { data: topMarginProducts } = await supabase
    .from("products")
    .select("title, margin_percent, margin_amount")
    .eq("tenant_id", tenantId)
    .not("margin_percent", "is", null)
    .order("margin_percent", { ascending: false })
    .limit(3);

  const { data: bottomMarginProducts } = await supabase
    .from("products")
    .select("title, margin_percent, margin_amount")
    .eq("tenant_id", tenantId)
    .not("margin_percent", "is", null)
    .order("margin_percent", { ascending: true })
    .limit(3);

  const missingFeesCount = allProducts?.filter(p => p.estimated_fee === null || p.estimated_fee === undefined).length || 0;


  // Recent AI Messages
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("text, direction, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(3);

  // 1. Daily Summary
  const dailySummary = await getOrCreateDailySummary(tenantId);
  
  // 2. Business Insights
  const insights = await generateBusinessInsights(tenantId);

  // 3. Billing Usage
  const { data: usage } = await supabase
    .from("subscription_usage")
    .select("ai_requests_used, ai_requests_limit")
    .eq("tenant_id", tenantId)
    .single();
    
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("tenant_id", tenantId)
    .single();

  const aiUsed = usage?.ai_requests_used || 0;
  const aiLimit = sub?.plan === 'business' ? '∞' : (usage?.ai_requests_limit || 500);

  // Sprint 16: Health & Activation
  const activation = await getActivationProgress();
  const healthData = await calculateBusinessHealth(tenantId);

  // Time formatting helper
  const formatTimeAgo = (dateStr: string) => {
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "hace instantes";
    if (diffMins < 60) return `hace ${diffMins} minutos`;
    return `hace ${Math.floor(diffMins / 60)} horas`;
  };

  const userName = user.email ? user.email.split('@')[0] : "Emprendedor";
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      
      {activation.percentage < 100 && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-center justify-between mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground font-bold w-10 h-10 rounded-full flex items-center justify-center">
              {activation.percentage}%
            </div>
            <div>
              <h3 className="font-semibold text-primary">Te falta completar {activation.totalSteps - activation.completedSteps} pasos de configuración</h3>
              <p className="text-sm text-muted-foreground">Termina de configurar tu cuenta para desbloquear todo el poder de la IA.</p>
            </div>
          </div>
          <Button asChild variant="default" size="sm">
            <Link href="/dashboard/get-started">Continuar</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hola, {formattedName} 👋</h2>
          <p className="text-muted-foreground mt-1">Aquí está el resumen de tu negocio hoy.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Health Score Badge */}
          <Link href="/dashboard/health" className="flex items-center gap-2 px-4 py-2 bg-background border rounded-full text-sm font-medium hover:bg-accent transition-colors">
            <HeartPulse className={`w-4 h-4 ${healthData.score >= 90 ? 'text-emerald-500' : healthData.score >= 70 ? 'text-blue-500' : healthData.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`} />
            <span>Salud: {healthData.score}/100</span>
          </Link>

          {/* Sync Status Badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-full text-sm font-medium">
          {meliAccount.status === 'syncing' ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : meliAccount.status === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>
            {meliAccount.status === 'syncing' 
              ? "Sincronizando Mercado Libre..." 
              : meliAccount.status === 'error' 
                ? "Error de sincronización" 
                : `Sincronizado ${meliAccount.last_sync_at ? formatTimeAgo(meliAccount.last_sync_at as string) : 'recientemente'}`
            }
          </span>
        </div>
        </div>
      </div>

      {/* AI Daily Summary Hero */}
      {dailySummary && (
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              Resumen Automático
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
              {dailySummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Missing Costs Alert */}
      {(() => {
        const missingCostsCount = allProducts?.filter(p => p.cost === null || p.cost === undefined).length || 0;
        if (missingCostsCount > 0) {
          return (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Faltan costos de productos
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Tenés {missingCostsCount} productos sin costo cargado. Stockly no puede calcular rentabilidad real.
                </p>
                <div className="mt-2">
                  <Button variant="outline" size="sm" className="h-8 border-yellow-300 text-yellow-800 hover:bg-yellow-100" asChild>
                    <Link href="/dashboard/products">Cargar costos ahora</Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Stockly Recommends */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Stockly Recomienda
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.map(insight => (
              <Card key={insight.id} className="border-l-4 overflow-hidden" style={{ borderLeftColor: insight.type === 'positive' ? '#10b981' : insight.type === 'negative' ? '#ef4444' : insight.type === 'warning' ? '#f59e0b' : '#3b82f6' }}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{insight.description}</p>
                  {insight.actionLabel && (
                    <Button variant="outline" size="sm" className="w-full text-xs h-7" asChild>
                      <Link href={insight.actionHref || "#"}>{insight.actionLabel}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <SalesCard amount={salesToday} />
        <RevenueCard amount={revenueWeek} />
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProductsCount}</div>
            <p className="text-xs text-muted-foreground">En tu catálogo</p>
          </CardContent>
        </Card>

        <StockAlertCard count={lowStockCount} />
        <ProductCard name={topProduct?.title || "Sin datos"} quantity={topProduct?.sold_quantity || 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ventas últimos 7 días</CardTitle>
            <CardDescription>Resumen de ingresos de la última semana.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <OverviewChart data={recentOrders || []} />
          </CardContent>
        </Card>
        
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Productos más vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsChart data={chartData} />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Rentabilidad Estimada</CardTitle>
              <CardDescription>Basado en productos con costos cargados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-green-600">Mejor Margen Neto</h4>
                {topMarginProducts && topMarginProducts.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {topMarginProducts.map((p, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span className="truncate max-w-[180px]">{p.title}</span>
                        <span className="font-medium text-green-600">{p.margin_percent?.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No hay datos suficientes</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-red-500">Peor Margen Neto</h4>
                {bottomMarginProducts && bottomMarginProducts.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {bottomMarginProducts.map((p, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span className="truncate max-w-[180px]">{p.title}</span>
                        <span className="font-medium text-red-500">{p.margin_percent?.toFixed(1)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No hay datos suficientes</p>
                )}
              </div>
              {missingFeesCount > 0 && (
                <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                  {missingFeesCount} productos no tienen comisión ML estimada.
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Agente IA</CardTitle>
                <CardDescription>Actividad reciente</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/messages">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ir al Chat
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentMessages && recentMessages.length > 0 ? (
                <div className="space-y-3">
                  {recentMessages.map((msg, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-semibold text-xs uppercase text-muted-foreground mr-2">
                        {msg.direction === 'inbound' ? 'Tú' : 'Stockly'}
                      </span>
                      <span className="line-clamp-1">{msg.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tienes mensajes recientes con la Inteligencia Artificial.</p>
              )}
            </CardContent>
          </Card>

          {/* Usage Widget */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                Uso Mensual
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href="/dashboard/billing">Ver plan</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Consultas IA</span>
                <span className="text-muted-foreground">{aiUsed} / {aiLimit}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
