import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ActionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: actions } = await supabase
    .from("ai_actions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-500';
      case 'executed': return 'bg-green-500/10 text-green-500';
      case 'cancelled': return 'bg-gray-500/10 text-gray-500';
      case 'failed': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'LOW': return 'bg-green-500/10 text-green-500';
      case 'MEDIUM': return 'bg-orange-500/10 text-orange-500';
      case 'HIGH': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Acciones IA</h2>
      </div>
      <p className="text-muted-foreground">
        Historial de todas las operaciones preparadas y ejecutadas por el agente de Inteligencia Artificial.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Últimas Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          {actions?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No hay acciones registradas aún.
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Título</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Riesgo</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Estado</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Fecha Creación</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Ejecución</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {actions?.map((action) => {
                    const risk = action.payload?.risk_score || 'LOW';
                    return (
                      <tr key={action.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">{action.title}</td>
                        <td className="p-4 align-middle">{action.action_type}</td>
                        <td className="p-4 align-middle">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRiskColor(risk)}`}>
                            {risk}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(action.status)}`}>
                            {action.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 align-middle">
                          {new Date(action.created_at).toLocaleString('es-AR')}
                        </td>
                        <td className="p-4 align-middle">
                          {action.executed_at ? new Date(action.executed_at).toLocaleString('es-AR') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
