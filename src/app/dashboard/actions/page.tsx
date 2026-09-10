import { createClient } from "@/lib/supabase/server";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricItem } from "@/components/operational/metric-strip";
import { ActionsClientPage, AiActionListItem } from "./client-page";

export default async function ActionsPage(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!tenantId) return null;

  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 1. Contadores calculados en la base de datos (0 bytes de filas transferidas)
  const [
    { count: totalCount },
    { count: pendingCount },
    { count: executedCount },
    { count: failedCount },
    { data: actions, error }
  ] = await Promise.all([
    supabase
      .from("ai_actions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("action_type", "like", "webhook_%"),
    supabase
      .from("ai_actions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("action_type", "like", "webhook_%")
      .eq("status", "pending"),
    supabase
      .from("ai_actions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("action_type", "like", "webhook_%")
      .eq("status", "executed"),
    supabase
      .from("ai_actions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("action_type", "like", "webhook_%")
      .eq("status", "failed"),
    // 2. Consulta acotada de máximo 50 filas con columnas explícitas (sin payload ni result masivos)
    supabase
      .from("ai_actions")
      .select("id, action_type, status, title, description, created_at, executed_at, failed_reason, risk_score:payload->>risk_score, error_message:payload->>error")
      .eq("tenant_id", tenantId)
      .not("action_type", "like", "webhook_%")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  ]);

  if (error) {
    console.error("Error fetching ai_actions list:", error);
  }

  const metrics: MetricItem[] = [
    {
      label: "Total de Acciones",
      value: (totalCount || 0).toString(),
      subtext: "Registradas en el historial operativo"
    },
    {
      label: "Pendientes",
      value: (pendingCount || 0).toString(),
      subtext: "Esperando confirmación o ejecución"
    },
    {
      label: "Ejecutadas con Éxito",
      value: (executedCount || 0).toString(),
      subtext: "Completadas en Mercado Libre o catálogo"
    },
    {
      label: "Con Error",
      value: (failedCount || 0).toString(),
      subtext: "Requieren revisión o reintento"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Registro de Acciones Operativas"
        description="Historial y trazabilidad de acciones preparadas, confirmadas y ejecutadas sobre tu operativa de Mercado Libre."
      />

      <ActionsClientPage
        initialActions={(actions || []) as unknown as AiActionListItem[]}
        metrics={metrics}
        totalCount={totalCount || 0}
        currentPage={page}
        pageSize={pageSize}
      />
    </div>
  );
}
