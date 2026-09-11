import Link from "next/link";
import { getSuperAdminOverview } from "@/services/super-admin/metrics";
import {
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  UserCheck,
  UserX,
  ArrowRight,
  ShieldAlert,
  Activity,
} from "lucide-react";

export const revalidate = 0; // Always fresh in super admin

export default async function SuperAdminOverviewPage() {
  const metrics = await getSuperAdminOverview();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Super Admin Overview
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Métricas clave de operación SaaS, salud de cuentas y centro de atención.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/super-admin/customers"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#3A86FF] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Gestionar Clientes</span>
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* MRR */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">MRR</span>
            <DollarSign className="w-4 h-4 text-[#3A86FF]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#0F172A]">
              $ {metrics.mrr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-[#64748B]">USD</span>
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">Recurrente mensual</div>
          </div>
        </div>

        {/* Ingresos del Mes */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Ingresos Mes</span>
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#0F172A]">
              $ {metrics.monthRevenue.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-[#64748B]">USD</span>
            </div>
            <div className="text-[11px] text-[#10B981] font-medium mt-0.5">Pagos aprobados</div>
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Clientes Activos</span>
            <UserCheck className="w-4 h-4 text-[#3A86FF]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#0F172A]">
              {metrics.activeCustomers}
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">
              {metrics.activeSubscriptions} subs activas
            </div>
          </div>
        </div>

        {/* Clientes en Trial */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">En Trial</span>
            <Clock className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-extrabold text-[#0F172A]">
              {metrics.trialingCustomers}
            </div>
            <div className="text-[11px] text-[#F59E0B] font-medium mt-0.5">Período de prueba</div>
          </div>
        </div>

        {/* Altas y Bajas Mes */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#64748B]">
            <span className="text-xs font-semibold uppercase tracking-wider">Altas / Bajas Mes</span>
            <UserX className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#10B981]">
                +{metrics.newCustomersMonth}
              </span>
              <span className="text-xl font-bold text-[#EF4444]">
                -{metrics.cancellationsMonth}
              </span>
            </div>
            <div className="text-[11px] text-[#64748B] mt-0.5">Nuevos vs Cancelados</div>
          </div>
        </div>
      </div>

      {/* Attention Center ("Necesitan Atención") */}
      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#FFFBEB]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Centro de Atención Prioritaria</h2>
              <p className="text-xs text-[#64748B]">
                Cuentas que requieren acción comercial o de soporte inmediata
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309]">
            {metrics.attentionItems.length} alertas
          </span>
        </div>

        {metrics.attentionItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B]">
            Todo en orden. No hay cuentas con alertas urgentes en este momento.
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {metrics.attentionItems.map((item) => (
              <div
                key={item.id}
                className="px-6 py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded bg-[#F1F5F9] text-[#475569]">
                    {item.type === "TRIAL_ENDING" && <Clock className="w-4 h-4 text-[#D97706]" />}
                    {item.type === "PAYMENT_PAST_DUE" && <AlertTriangle className="w-4 h-4 text-[#DC2626]" />}
                    {item.type === "CANCELLATION_PENDING" && (
                      <UserX className="w-4 h-4 text-[#9333EA]" />
                    )}
                    {(item.type === "INACTIVE" || item.type === "DORMANT") && (
                      <Activity className="w-4 h-4 text-[#64748B]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F172A] truncate">
                        {item.tenantName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-[#F1F5F9] text-[#475569] uppercase">
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] truncate">
                      {item.title} — <span className="text-[#334155]">{item.detail}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/super-admin/customers/${item.tenantId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3A86FF] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-md transition-colors shrink-0"
                >
                  <span>Ver cuenta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Plan Distribution & Activity Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Plan */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
              Distribución por Plan
            </h3>
            <Link
              href="/super-admin/plans"
              className="text-xs text-[#3A86FF] font-semibold hover:underline"
            >
              Configurar planes
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[11px] uppercase font-bold text-[#64748B] bg-[#F8FAFC]">
                <tr>
                  <th className="px-3 py-2 rounded-l">Plan</th>
                  <th className="px-3 py-2 text-center">Clientes</th>
                  <th className="px-3 py-2 text-right rounded-r">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {metrics.planDistribution.map((p) => (
                  <tr key={p.planCode} className="hover:bg-[#F8FAFC]/70">
                    <td className="px-3 py-2.5 font-bold text-[#0F172A] capitalize">
                      {p.planName}
                    </td>
                    <td className="px-3 py-2.5 text-center font-semibold text-[#334155]">
                      {p.customerCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#0F172A]">
                      $ {p.mrr.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actividad y Salud de Cuentas */}
        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
              Engagement & Actividad
            </h3>
            <Link
              href="/super-admin/activity"
              className="text-xs text-[#3A86FF] font-semibold hover:underline"
            >
              Ver feed global
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
              <div className="text-[10px] font-bold text-[#166534] uppercase">Activos (0-7d)</div>
              <div className="text-xl font-black text-[#15803D] mt-1">
                {metrics.activityDistribution.active7d}
              </div>
              <div className="text-[10px] text-[#166534] mt-0.5">Uso reciente</div>
            </div>

            <div className="p-3 rounded-lg bg-[#FEFCE8] border border-[#FEF08A]">
              <div className="text-[10px] font-bold text-[#854D0E] uppercase">En Riesgo (8-14d)</div>
              <div className="text-xl font-black text-[#A16207] mt-1">
                {metrics.activityDistribution.atRisk}
              </div>
              <div className="text-[10px] text-[#854D0E] mt-0.5">Alerta temprana</div>
            </div>

            <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA]">
              <div className="text-[10px] font-bold text-[#991B1B] uppercase">Inactivos (+15d)</div>
              <div className="text-xl font-black text-[#B91C1C] mt-1">
                {metrics.inactiveCustomers}
              </div>
              <div className="text-[10px] text-[#991B1B] mt-0.5">Sin uso prolongado</div>
            </div>

            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="text-[10px] font-bold text-[#64748B] uppercase">Tracking Pendiente</div>
              <div className="text-xl font-black text-[#64748B] mt-1">
                {metrics.activityDistribution.trackingPending}
              </div>
              <div className="text-[10px] text-[#94A3B8] mt-0.5">Sin datos previos</div>
            </div>
          </div>

          <div className="text-xs text-[#64748B] pt-2">
            La clasificación de salud se basa estrictamente en interacción humana (vistas de
            órdenes, dashboards, costos, exportaciones) y excluye webhooks automáticos de Mercado
            Libre.
          </div>
        </div>
      </div>
    </div>
  );
}
