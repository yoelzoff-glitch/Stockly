import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { predictStockOut } from "@/services/predictions";
import { detectDeadProducts } from "@/services/analytics/deadProducts";
import { analyzeBusiness } from "@/services/ai/planner";

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

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Intelligence Center</h2>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        
        {/* Predicciones de Quiebre de Stock */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Predicción de Stock Out</CardTitle>
            <CardDescription>Productos que se agotarán pronto basado en ventas recientes</CardDescription>
          </CardHeader>
          <CardContent>
            {stockOuts.length > 0 ? (
              <div className="space-y-4">
                {stockOuts.map(so => (
                  <div key={so.product_id} className="flex flex-col gap-1 border-b pb-2">
                    <span className="font-medium text-sm">{so.title}</span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stock: {so.current_stock}</span>
                      <Badge variant={so.estimated_days_remaining <= 3 ? "destructive" : "secondary"}>
                        Se agota en {so.estimated_days_remaining} días
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay riesgo de quiebres de stock inminentes.</p>
            )}
          </CardContent>
        </Card>

        {/* Productos Muertos */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Productos Muertos</CardTitle>
            <CardDescription>Publicaciones sin ventas en los últimos 60 días</CardDescription>
          </CardHeader>
          <CardContent>
            {deadProducts.length > 0 ? (
              <div className="space-y-4">
                {deadProducts.map(dp => (
                  <div key={dp.product_id} className="flex flex-col gap-1 border-b pb-2">
                    <span className="font-medium text-sm line-clamp-1">{dp.title}</span>
                    <span className="text-xs text-red-500 font-medium">{dp.reason}</span>
                    <span className="text-xs text-muted-foreground">Sugerencia: {dp.action}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">¡Excelente! Tienes buena rotación en tu catálogo.</p>
            )}
          </CardContent>
        </Card>

        {/* Recomendaciones Generales de IA */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evaluación del Operador Autónomo</CardTitle>
            <CardDescription>Problemas detectados por el motor de inteligencia</CardDescription>
          </CardHeader>
          <CardContent>
            {problems.length > 0 ? (
              <div className="space-y-4">
                {problems.slice(0, 5).map((prob, idx) => (
                  <div key={idx} className="flex flex-col gap-1 border-b pb-2">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm line-clamp-1">{prob.product_title}</span>
                      <Badge variant={prob.severity === 'critical' ? "destructive" : "outline"}>
                        {prob.severity}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{prob.details}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">El negocio opera de manera óptima según el agente IA.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
