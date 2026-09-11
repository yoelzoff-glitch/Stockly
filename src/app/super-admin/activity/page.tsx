import { createAdminClient } from "@/lib/supabase/admin";
import { ShieldCheck, Activity, UserCheck } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminActivityPage() {
  const adminDb = createAdminClient();

  const [
    { data: auditLogs },
    { data: activityEvents },
    { data: tenants },
    { data: users },
  ] = await Promise.all([
    adminDb.from("platform_admin_audit_log").select("*").order("created_at", { ascending: false }).limit(50),
    adminDb.from("platform_activity_events").select("*").order("created_at", { ascending: false }).limit(50),
    adminDb.from("tenants").select("id, name"),
    adminDb.from("profiles").select("id, email, full_name"),
  ]);

  const tenantMap = new Map((tenants || []).map((t) => [t.id, t.name]));
  const userMap = new Map((users || []).map((u) => [u.id, u.email || u.full_name || "Admin"]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Actividad & Log de Auditoría
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Trazabilidad de acciones administrativas y registro funcional de interacción de clientes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Platform Admin Audit Log */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3A86FF]" />
              <span>Auditoría Super Admin</span>
            </h2>
            <span className="text-xs text-[#64748B] font-medium">Inmutable</span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {(!auditLogs || auditLogs.length === 0) ? (
              <p className="text-xs text-[#94A3B8] text-center py-8">
                No hay acciones de auditoría registradas aún.
              </p>
            ) : (
              auditLogs.map((log) => {
                const actorEmail = userMap.get(log.actor_user_id) || log.actor_user_id;
                const tenantName = log.target_tenant_id ? tenantMap.get(log.target_tenant_id) || log.target_tenant_id : null;

                return (
                  <div key={log.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#3A86FF] uppercase font-bold text-[11px]">
                        {log.action.replace(/_/g, " ")}
                      </strong>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(log.created_at).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="text-[#475569]">
                      Ejecutado por: <span className="font-semibold text-[#0F172A]">{actorEmail}</span>
                      {tenantName && (
                        <span> sobre cliente: <strong className="text-[#0F172A]">{tenantName}</strong></span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="text-[10px] text-[#64748B] font-mono bg-white p-1.5 rounded border border-[#E2E8F0] truncate">
                        {JSON.stringify(log.metadata)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Customer Functional Activity Feed */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#10B981]" />
              <span>Actividad de Clientes</span>
            </h2>
            <span className="text-xs text-[#64748B] font-medium">Últimos eventos</span>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {(!activityEvents || activityEvents.length === 0) ? (
              <p className="text-xs text-[#94A3B8] text-center py-8">
                No hay eventos funcionales de clientes registrados aún.
              </p>
            ) : (
              activityEvents.map((act) => {
                const tenantName = tenantMap.get(act.tenant_id) || act.tenant_id;

                return (
                  <div key={act.id} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#10B981] font-bold text-[11px]">
                        {act.event_name.replace(/_/g, " ")}
                      </strong>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(act.created_at).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div className="text-[#475569]">
                      Cliente: <strong className="text-[#0F172A]">{tenantName}</strong>
                    </div>
                    {act.metadata && Object.keys(act.metadata).length > 0 && (
                      <div className="text-[10px] text-[#64748B] font-mono bg-white p-1.5 rounded border border-[#E2E8F0] truncate">
                        {JSON.stringify(act.metadata)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
