import { createAdminClient } from "@/lib/supabase/admin";
import { getPersistentTenantEgressSummary } from "@/lib/observability/egress";
import { Database, AlertTriangle, ShieldCheck, HardDrive, Info } from "lucide-react";
import { ClientEgressTable } from "./client-egress-table";

export const revalidate = 0;

export default async function SuperAdminEgressPage() {
  const adminDb = createAdminClient();

  const { data: tenants } = await adminDb
    .from("tenants")
    .select("id, name, is_demo")
    .order("name", { ascending: true });

  const tenantRecord: Record<string, string> = {};
  (tenants || []).forEach((t) => {
    tenantRecord[t.id] = t.name;
  });

  // Get current day telemetry summary backed by real hourly metrics & persistent activity
  const allSummaries = await getPersistentTenantEgressSummary(adminDb);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Egress Budget por Tenant (Sprint 40)
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Telemetría real por hora, operación y tabla. Monitoreo de transferencia PostgreSQL / Supabase y detección de Egress en reposo.
          </p>
        </div>
      </div>

      {/* Observability Disclaimer Notice (Fase 13) */}
      <div className="p-4 rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] text-xs text-[#0369A1] flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0284C7]" />
        <div>
          <strong className="font-semibold">Telemetría Interna de Aplicación vs Supabase Oficial:</strong>
          <span className="ml-1 text-[#0C4A6E]">
            Este panel registra con exactitud los bytes transferidos por consultas de Route Handlers, Server Actions y Background Workers hacia PostgreSQL.
            El Egress total reportado en la consola de Supabase incluye adicionalmente tráfico de Auth, Realtime, Storage y overhead de conexión TLS.
          </span>
        </div>
      </div>

      {/* Threshold Indicators (Fase 17: Normal < 50MB, Warning 50-100MB, Critical > 100MB) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center text-[#059669]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Límite Normal</div>
            <div className="text-lg font-bold text-[#0F172A]">&lt; 50 MB / día</div>
            <div className="text-[10px] text-[#059669] font-medium">Consumo óptimo (&lt; 1 MB/h reposo)</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] flex items-center justify-center text-[#D97706]">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Alerta Warning</div>
            <div className="text-lg font-bold text-[#0F172A]">50 – 100 MB / día</div>
            <div className="text-[10px] text-[#D97706] font-medium">Requiere observación</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Nivel Crítico</div>
            <div className="text-lg font-bold text-[#0F172A]">&gt; 100 MB / día</div>
            <div className="text-[10px] text-[#DC2626] font-medium">Auditar consultas pesadas</div>
          </div>
        </div>
      </div>

      {/* Tenant Table with Clickable Drill-down (Fase 14 & 15) */}
      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-[#3A86FF]" />
            <span>Monitoreo Activo de Egress (Haz clic en un tenant para ver el detalle)</span>
          </h2>
          <span className="text-xs text-[#64748B] font-mono">
            Fecha: {new Date().toISOString().split("T")[0]}
          </span>
        </div>

        <div className="overflow-x-auto">
          <ClientEgressTable summaries={allSummaries} tenantMap={tenantRecord} />
        </div>
      </div>
    </div>
  );
}
