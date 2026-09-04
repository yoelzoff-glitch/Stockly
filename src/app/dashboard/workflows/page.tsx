import { createClient } from "@/lib/supabase/server";
import { WorkflowActions } from "@/components/dashboard/workflow-actions";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalPanel } from "@/components/operational/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export default async function WorkflowsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: workflows } = await supabase
    .from("action_workflows")
    .select("*, workflow_steps(*, ai_actions(action_type, title, status))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const workflowList = workflows || [];
  const pendingCount = workflowList.filter(w => w.status === "pending").length;
  const completedCount = workflowList.filter(w => w.status === "completed").length;
  const failedCount = workflowList.filter(w => w.status === "failed").length;

  const metrics: MetricItem[] = [
    {
      label: "Workflows Activos",
      value: workflowList.length.toString(),
      subtext: "Procesos configurados en el sistema"
    },
    {
      label: "Pendientes de Aprobación",
      value: pendingCount.toString(),
      subtext: "Esperando confirmación operativa"
    },
    {
      label: "Ejecutados con Éxito",
      value: completedCount.toString(),
      subtext: "Secuencias concluidas normalmente"
    },
    {
      label: "Fallidos / Interrumpidos",
      value: failedCount.toString(),
      subtext: "Detenidos por error o validación"
    }
  ];

  const getStatusVariant = (status: string): "neutral" | "success" | "warning" | "danger" | "info" => {
    switch (status) {
      case "pending": return "warning";
      case "executing": return "info";
      case "completed": return "success";
      case "failed": return "danger";
      default: return "neutral";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Pendiente de Aprobación";
      case "executing": return "En Ejecución";
      case "completed": return "Completado";
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
        title="Workflows y Procesos Operativos"
        description="Gestión y supervisión de secuencias de automatización de stock, precios y operaciones de catálogo."
      />

      <MetricStrip metrics={metrics} columns={4} />

      <OperationalPanel
        title="Historial de Procesos y Automatizaciones"
        description="Ejecuciones programadas y planes de acción paso a paso."
      >
        {workflowList.length === 0 ? (
          <OperationalEmptyState
            title="No hay workflows registrados aún"
            description="Cuando se generen rutinas de automatización o planes de ajuste de catálogo, se listarán aquí para su supervisión."
          />
        ) : (
          <div className="space-y-4 pt-1">
            {workflowList.map((wf) => (
              <div key={wf.id} className="border border-[#DCDAD4] rounded-lg p-4 bg-[#FFFFFF] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm text-[#101828]">{wf.title}</h3>
                      <StatusBadge variant={getStatusVariant(wf.status)}>
                        {getStatusLabel(wf.status)}
                      </StatusBadge>
                      <StatusBadge variant={getRiskVariant(wf.risk_score)}>
                        Impacto {wf.risk_score || "BAJO"}
                      </StatusBadge>
                    </div>
                    {wf.summary && (
                      <p className="text-xs text-[#5F6875] mt-1">{wf.summary}</p>
                    )}
                  </div>
                  <div className="text-right text-xs font-mono text-[#5F6875] shrink-0">
                    <div>Creado: {new Date(wf.created_at).toLocaleDateString("es-AR")}</div>
                    {wf.updated_at && (
                      <div className="text-[11px] text-[#5F6875]">Última mod: {new Date(wf.updated_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
                    )}
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-[#101828]">
                    Pasos del Proceso ({wf.workflow_steps?.length || 0})
                  </div>
                  <div className="divide-y divide-[#DCDAD4] border border-[#DCDAD4] rounded-md bg-[#FCFCFA] overflow-hidden">
                    {wf.workflow_steps?.map((step: any, idx: number) => {
                      const stepCompleted = step.status === "completed";
                      const stepFailed = step.status === "failed";

                      return (
                        <div key={step.id || idx} className="p-2.5 px-3 flex items-center justify-between text-xs gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {stepCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-[#198754] shrink-0" />
                            ) : stepFailed ? (
                              <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-[#B54708] shrink-0" />
                            )}
                            <span className="font-medium text-[#101828] truncate">
                              {step.ai_actions?.title || step.step_name || `Paso #${idx + 1}`}
                            </span>
                          </div>
                          <StatusBadge variant={stepCompleted ? "success" : stepFailed ? "danger" : "warning"}>
                            {step.status}
                          </StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {wf.status === "pending" && (
                  <WorkflowActions workflowId={wf.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </OperationalPanel>
    </div>
  );
}
