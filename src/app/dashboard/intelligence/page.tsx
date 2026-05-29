import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { predictStockOut } from "@/services/predictions";
import { detectDeadProducts } from "@/services/analytics/deadProducts";
import { analyzeBusiness } from "@/services/ai/planner";
import { PackageX, TrendingDown, Bot, Zap, ArrowRight, PlayCircle } from "lucide-react";
import { GlobalDateFilter } from "@/components/filters/global-date-filter";

export default async function IntelligenceCenter() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) {
    return <div>No se encontró la cuenta.</div>;
  }

  const tenantId = profile.tenant_id;

  // Run intelligence models
  const stockOuts = await predictStockOut(tenantId);
  const deadProducts = await detectDeadProducts(tenantId);
  const problems = await analyzeBusiness(tenantId);

  // Sprint 22: Logistics & Cancellations Insights
  const { data: delayedShipments } = await supabase
    .from("shipments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("substatus", "delayed");
    
  if (delayedShipments && delayedShipments.length > 0) {
    problems.unshift({
      product_id: "logistics-delayed",
      sku: "N/A",
      type: "logistics_delay",
      product_title: "Logística: Envíos Demorados",
      severity: "critical",
      details: `Tenés ${delayedShipments.length} envíos demorados actualmente.`,
      action: "Revisa los envíos en la sección de Envíos y contacta a los compradores para evitar reclamos."
    } as any); // Cast as any if we don't have the exact literal types, or just satisfy the base shape
  }

  const { data: recentCancellations } = await supabase
    .from("order_cancellations")
    .select("id, orders(meli_order_id, buyer_nickname)")
    .eq("tenant_id", tenantId)
    .order("date_cancelled", { ascending: false })
    .limit(5);

  if (recentCancellations && recentCancellations.length > 0) {
    problems.unshift({
      product_id: "logistics-cancellations",
      sku: "N/A",
      type: "logistics_cancellations",
      product_title: "Alertas de Cancelación",
      severity: "medium",
      details: `Se registraron ${recentCancellations.length} cancelaciones recientes. Revisa los motivos para detectar patrones.`,
      action: "Analiza el historial en la sección de Ventas Canceladas."
    } as any);
  }

  // Suggested Workflows (Mocked based on problems for now)
  const suggestedWorkflows = [
    { id: 1, title: "Pausar todos los productos sin ventas", risk: "Bajo", type: "dead_products" },
    { id: 2, title: "Aumentar 5% precio de productos con margen crítico", risk: "Medio", type: "low_margin" },
    { id: 3, title: "¿Cuáles son los motivos de mis últimas cancelaciones?", risk: "Bajo", type: "ai_chat" },
    { id: 4, title: "Crear promo 10% para productos con sobrestock", risk: "Medio", type: "promo" },
    { id: 5, title: "Oferta relámpago para productos muertos", risk: "Bajo", type: "promo" }
  ];

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Intelligence Center</h2>
          <p className="text-muted-foreground mt-1">Análisis predictivo y recomendaciones del Operador Autónomo.</p>
        </div>
        <GlobalDateFilter />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        
        {/* Predicciones de Quiebre de Stock */}
        <Card className="col-span-1 border-orange-200 dark:border-orange-900/50">
          <CardHeader className="bg-orange-50/50 dark:bg-orange-500/10 pb-4">
            <div className="flex items-center gap-2">
              <PackageX className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-lg">Predicción de Stock Out</CardTitle>
            </div>
            <CardDescription>Productos que se agotarán pronto basado en consumo de los últimos 30 días.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {stockOuts.length > 0 ? (
              <div className="space-y-4">
                {stockOuts.map(so => (
                  <div key={so.product_id} className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0">
                    <span className="font-semibold text-sm leading-tight">{so.title}</span>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Stock actual</span>
                        <span className="font-medium text-base">{so.current_stock}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Ventas / 30d</span>
                        <span className="font-medium text-base">{so.sales_last_30_days}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-dashed">
                       <StatusBadge variant={so.estimated_days_remaining <= 3 ? "danger" : "warning"}>
                          Quedan {so.estimated_days_remaining} días
                       </StatusBadge>
                       {so.recommended_restock > 0 && (
                         <div className="flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded">
                           Sugerencia: Comprar {so.recommended_restock} un.
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No hay riesgo de quiebres de stock inminentes.</p>
            )}
          </CardContent>
        </Card>

        {/* Productos Muertos */}
        <Card className="col-span-1 border-slate-200 dark:border-slate-800">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <CardTitle className="text-lg">Capital Inmovilizado</CardTitle>
            </div>
            <CardDescription>Productos sin ventas en los últimos 60 días con stock disponible.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {deadProducts.length > 0 ? (
              <div className="space-y-4">
                {deadProducts.slice(0, 4).map((dp: any) => (
                  <div key={dp.product_id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                    <span className="font-semibold text-sm line-clamp-1">{dp.title}</span>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="flex space-x-4">
                        <span><span className="text-muted-foreground">Días sin vender:</span> {dp.dias_sin_vender}</span>
                        <span><span className="text-muted-foreground">Stock:</span> {dp.stock}</span>
                      </div>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        ${dp.valor_inmovilizado?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">¡Excelente! Todo tu inventario tiene rotación activa.</p>
            )}
          </CardContent>
        </Card>

        {/* Recomendaciones Generales de IA */}
        <Card className="col-span-1 xl:col-span-1 md:col-span-2 border-indigo-200 dark:border-indigo-900/50">
          <CardHeader className="bg-indigo-50/50 dark:bg-indigo-500/10 pb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Insights del Operador IA</CardTitle>
            </div>
            <CardDescription>Problemas detectados con acciones sugeridas para corregirlos.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {problems.length > 0 ? (
              <div className="space-y-4">
                {problems.slice(0, 5).map((prob, idx) => (
                  <div key={idx} className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 bg-white/50 dark:bg-slate-950/50 p-3 rounded-lg">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm line-clamp-1 flex-1 pr-2">{prob.product_title}</span>
                      <StatusBadge variant={prob.severity === 'critical' ? "danger" : "warning"} className="shrink-0">
                        {prob.severity === 'critical' ? 'Prioridad Alta' : 'Prioridad Media'}
                      </StatusBadge>
                    </div>
                    <div className="text-xs space-y-1">
                      <p><span className="text-muted-foreground">Problema:</span> {prob.details}</p>
                      <p><span className="text-indigo-600 dark:text-indigo-400 font-medium">Sugerencia:</span> {prob.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">El negocio opera de manera óptima según la IA.</p>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Workflows sugeridos */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          Workflows Sugeridos
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {suggestedWorkflows.map(wf => (
            <Card key={wf.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{wf.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Riesgo de ejecución:</span>
                    <StatusBadge variant={wf.risk === 'Bajo' ? 'success' : 'warning'} className="text-xs font-normal">
                      {wf.risk}
                    </StatusBadge>
                  </div>
                </div>
                <Link href={`/dashboard/messages?msg=${encodeURIComponent(wf.title)}`}>
                  <Button size="icon" className="h-10 w-10 rounded-full shrink-0">
                    <PlayCircle className="h-6 w-6" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
}
