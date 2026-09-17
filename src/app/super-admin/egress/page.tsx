import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantEgressSummary } from "@/lib/observability/egress";
import { Database, AlertTriangle, ShieldCheck, HardDrive } from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminEgressPage() {
  const adminDb = createAdminClient();

  const { data: tenants } = await adminDb
    .from("tenants")
    .select("id, name, is_demo")
    .order("name", { ascending: true });

  const tenantMap = new Map((tenants || []).map((t) => [t.id, t.name]));

  // Get current day telemetry summary
  const egressSummaries = getTenantEgressSummary();

  // Augment with all known tenants if they haven't emitted samples yet today
  const allSummaries = (tenants || []).map((t) => {
    const existing = egressSummaries.find((s) => s.tenantId === t.id);
    if (existing) return existing;
    return {
      tenantId: t.id,
      date: new Date().toISOString().split("T")[0],
      estimatedBytes: 0,
      estimatedMb: 0,
      queryCount: 0,
      topOperation: "none",
      topTable: "none",
      budgetStatus: "NORMAL" as const,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Egress Budget por Tenant (Sprint 39)
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Límites observacionales y monitoreo de transferencia PostgreSQL / Supabase por cliente.
          </p>
        </div>
      </div>

      {/* Threshold Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#059669]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Límite Normal</div>
            <div className="text-lg font-bold text-[#0F172A]">&lt; 100 MB / día</div>
            <div className="text-[10px] text-[#059669] font-medium">Consumo óptimo</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center text-[#D97706]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Alerta Warning</div>
            <div className="text-lg font-bold text-[#0F172A]">100 – 200 MB / día</div>
            <div className="text-[10px] text-[#D97706] font-medium">Requiere observación</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Nivel Crítico</div>
            <div className="text-lg font-bold text-[#0F172A]">&gt; 200 MB / día</div>
            <div className="text-[10px] text-[#DC2626] font-medium">Auditar consultas pesadas</div>
          </div>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-[#3A86FF]" />
            <span>Monitoreo Activo de Egress</span>
          </h2>
          <span className="text-xs text-[#64748B] font-mono">
            Fecha: {new Date().toISOString().split("T")[0]}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-4 py-3 text-right">Egress Estimado</th>
                <th className="px-4 py-3 text-center">Estado Budget</th>
                <th className="px-4 py-3 text-right">Queries</th>
                <th className="px-4 py-3">Top Operación</th>
                <th className="px-4 py-3">Top Tabla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {allSummaries.map((s) => {
                const tenantName = tenantMap.get(s.tenantId) || s.tenantId;
                const isCritical = s.budgetStatus === "CRITICAL";
                const isWarning = s.budgetStatus === "WARNING";

                return (
                  <tr key={s.tenantId} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#0F172A]">
                      <div className="font-semibold">{tenantName}</div>
                      <div className="text-[10px] font-mono text-[#94A3B8]">{s.tenantId}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-[#0F172A]">
                      {s.estimatedMb > 0 ? `${s.estimatedMb} MB` : `${(s.estimatedBytes / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCritical
                            ? "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                            : isWarning
                            ? "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]"
                            : "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]"
                        }`}
                      >
                        {s.budgetStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-[#64748B]">
                      {s.queryCount}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#475569]">
                      {s.topOperation}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-[#475569]">
                      {s.topTable}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
