import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";

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

  const actionList = actions || [];
  const pendingCount = actionList.filter(a => a.status === "pending").length;
  const executedCount = actionList.filter(a => a.status === "executed").length;
  const failedCount = actionList.filter(a => a.status === "failed").length;

  const metrics: MetricItem[] = [
    {
      label: "Total de Acciones",
      value: actionList.length.toString(),
      subtext: "Registradas en el historial operativo"
    },
    {
      label: "Pendientes",
      value: pendingCount.toString(),
      subtext: "Esperando confirmación o ejecución"
    },
    {
      label: "Ejecutadas con Éxito",
      value: executedCount.toString(),
      subtext: "Completadas en Mercado Libre o catálogo"
    },
    {
      label: "Con Error",
      value: failedCount.toString(),
      subtext: "Requieren revisión o reintento"
    }
  ];

  const getStatusVariant = (status: string): "neutral" | "success" | "warning" | "danger" | "info" => {
    switch (status) {
      case "pending": return "warning";
      case "executed": return "success";
      case "cancelled": return "neutral";
      case "failed": return "danger";
      default: return "neutral";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendiente";
      case "executed": return "Ejecutada";
      case "cancelled": return "Cancelada";
      case "failed": return "Error";
      default: return status;
    }
  };

  const getRiskVariant = (risk: string): "neutral" | "success" | "warning" | "danger" => {
    switch (risk?.toUpperCase()) {
      case "LOW": return "success";
      case "MEDIUM": return "warning";
      case "HIGH": return "danger";
      default: return "neutral";
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Registro de Acciones Operativas"
        description="Historial y trazabilidad de acciones preparadas, confirmadas y ejecutadas sobre tu operativa de Mercado Libre."
      />

      <MetricStrip metrics={metrics} columns={4} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Historial de Operaciones</h3>
            <p className="text-xs text-[#5F6875]">Trazabilidad cronológica de eventos y resultados.</p>
          </div>
          <span className="text-xs font-mono text-[#5F6875]">{actionList.length} registros</span>
        </div>

        <DataTableShell>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Acción</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5 text-center">Nivel de Impacto</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-4 py-2.5">Fecha Creación</th>
                  <th className="px-4 py-2.5">Ejecución / Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {actionList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <OperationalEmptyState
                        title="No hay acciones registradas aún"
                        description="Las acciones automáticas o programadas aparecerán en esta tabla cuando se generen alertas o sugerencias operativas."
                      />
                    </td>
                  </tr>
                ) : (
                  actionList.map((action) => {
                    const risk = action.payload?.risk_score || "LOW";
                    const errorMessage = action.payload?.error || action.error_message;

                    return (
                      <tr key={action.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-[#101828] max-w-sm truncate" title={action.title}>
                            {action.title}
                          </div>
                          {errorMessage && (
                            <div className="text-[11px] text-[#D92D20] mt-0.5 font-mono">
                              Error: {errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#5F6875]">
                          <span className="px-1.5 py-0.5 rounded bg-[#F5F3EE] border border-[#DCDAD4] text-[10px] uppercase">
                            {action.action_type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge variant={getRiskVariant(risk)}>
                            {risk}
                          </StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge variant={getStatusVariant(action.status)}>
                            {getStatusLabel(action.status)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#5F6875] text-[11px]">
                          {new Date(action.created_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#101828] text-[11px]">
                          {action.executed_at ? (
                            <span>
                              {new Date(action.executed_at).toLocaleString("es-AR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          ) : (
                            <span className="text-[#5F6875]">Pendiente de ejecución</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      </div>
    </div>
  );
}
