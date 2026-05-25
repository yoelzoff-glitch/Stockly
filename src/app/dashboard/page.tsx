import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { TopProductsChart } from "@/components/dashboard/top-products-chart";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SystemMonitor } from "@/components/dashboard/system-monitor";
import { StatusBadge } from "@/components/ui/status-badge";
import { AlertCircle, CheckCircle2, MessageSquare, Package, RefreshCw, Sparkles, Lightbulb, ArrowRight, HeartPulse, DollarSign, LineChart } from "lucide-react";
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
    <div className="flex-1 space-y-6 md:space-y-8 p-4 md:p-8 pt-4 md:pt-6">
      
      {activation.percentage < 100 && (
        <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex items-center justify-between shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 text-white font-bold w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-sm">
              {activation.percentage}%
            </div>
            <div>
              <h3 className="font-semibold text-indigo-900 text-lg">Te falta completar {activation.totalSteps - activation.completedSteps} pasos de configuración</h3>
              <p className="text-sm text-indigo-700/80 mt-0.5">Termina de configurar tu cuenta para desbloquear todo el poder de la IA.</p>
            </div>
          </div>
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm rounded-full px-6">
            <Link href="/dashboard/get-started">Continuar</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Hola, {formattedName} 👋</h2>
          <p className="text-slate-500 mt-1.5">Aquí está el resumen de tu negocio hoy.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/dashboard/health">
            <StatusBadge variant={healthData.score >= 90 ? 'success' : healthData.score >= 70 ? 'info' : healthData.score >= 50 ? 'warning' : 'danger'} className="px-3 py-1.5 text-sm">
              <HeartPulse className="w-4 h-4 mr-1.5" /> Salud: {healthData.score}/100
            </StatusBadge>
          </Link>

          <StatusBadge variant={meliAccount.status === 'syncing' ? 'info' : meliAccount.status === 'error' ? 'danger' : 'success'} className="px-3 py-1.5 text-sm">
            {meliAccount.status === 'syncing' ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : meliAccount.status === 'error' ? (
              <AlertCircle className="w-4 h-4 mr-1.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
            )}
            {meliAccount.status === 'syncing' 
              ? "Sincronizando..." 
              : meliAccount.status === 'error' 
                ? "Error de sincronización" 
                : `Sincronizado ${meliAccount.last_sync_at ? formatTimeAgo(meliAccount.last_sync_at as string) : 'recientemente'}`
            }
          </StatusBadge>
        </div>
      </div>

      {/* AI Daily Summary Hero */}
      {dailySummary && (
        <Card className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white border-none shadow-[0_12px_32px_rgba(99,102,241,0.2)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 font-medium">
              <Sparkles className="w-5 h-5 text-yellow-300 drop-shadow-sm" />
              Resumen Automático
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap opacity-95">
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
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-900">
                  Faltan costos de productos
                </h3>
                <p className="text-sm text-amber-700/90 mt-1">
                  Tenés {missingCostsCount} productos sin costo cargado. Stockly no puede calcular rentabilidad real.
                </p>
                <div className="mt-3">
                  <Button variant="outline" size="sm" className="h-8 border-amber-300 text-amber-800 hover:bg-amber-100 rounded-full bg-amber-50" asChild>
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Stockly Recomienda
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.map(insight => (
              <Card key={insight.id} className="border-l-[6px]" style={{ borderLeftColor: insight.type === 'positive' ? '#10b981' : insight.type === 'negative' ? '#ef4444' : insight.type === 'warning' ? '#f59e0b' : '#6366f1' }}>
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-900">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <p className="text-xs text-slate-500 mb-4">{insight.description}</p>
                  {insight.actionLabel && (
                    <Button variant="outline" size="sm" className="w-full text-xs h-8 rounded-full" asChild>
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
        <MetricCard 
          title="Ventas Hoy" 
          value={`$${salesToday.toLocaleString()}`} 
          icon={<DollarSign className="w-5 h-5" />} 
          variant="blue" 
        />
        <MetricCard 
          title="Ingresos (7 días)" 
          value={`$${revenueWeek.toLocaleString()}`} 
          icon={<LineChart className="w-5 h-5" />} 
          variant="green" 
        />
        <MetricCard 
          title="Catálogo" 
          value={totalProductsCount} 
          description="Productos activos" 
          icon={<Package className="w-5 h-5" />} 
          variant="slate" 
        />
        <MetricCard 
          title="Stock Crítico" 
          value={lowStockCount} 
          description="Con 5 unidades o menos" 
          icon={<AlertCircle className="w-5 h-5" />} 
          variant="amber" 
        />
        <MetricCard 
          title="Producto Estrella" 
          value={topProduct?.sold_quantity || 0} 
          description={topProduct?.title || "Sin datos"} 
          icon={<Sparkles className="w-5 h-5" />} 
          variant="purple" 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 items-start">
        <div className="col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ventas últimos 7 días</CardTitle>
              <CardDescription>Resumen de ingresos de la última semana.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <OverviewChart data={recentOrders || []} />
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
        </div>
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Productos más vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsChart data={chartData} />
            </CardContent>
          </Card>
          
          {/* Rentabilidad y Agente IA fueron movidos a la columna izquierda */}

          <SystemMonitor />
        </div>
      </div>
    </div>
  );
}
