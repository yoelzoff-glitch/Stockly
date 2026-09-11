import { getRevenueAnalytics } from "@/services/super-admin/metrics";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  BarChart3,
} from "lucide-react";

export const revalidate = 0;

export default async function SuperAdminRevenuePage() {
  const analytics = await getRevenueAnalytics();

  const growthPct =
    analytics.previousMonthRevenue > 0
      ? Math.round(
          ((analytics.currentMonthRevenue - analytics.previousMonthRevenue) /
            analytics.previousMonthRevenue) *
            100
        )
      : null;

  // Find max value in history to scale bars
  const maxHistoryVal = Math.max(
    ...analytics.monthlyHistory.map((m) => Math.max(m.realRevenue, m.mrr)),
    100000
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Revenue & Métricas Financieras
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Ingresos reales devengados, recurrencia mensual (MRR), retención y evolución histórica.
          </p>
        </div>
      </div>

      {/* Top 6 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Ingresos Mes */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Ingresos Mes
          </div>
          <div className="text-xl font-black text-[#0F172A] mt-1.5">
            ${analytics.currentMonthRevenue.toLocaleString("es-AR")}
          </div>
          {growthPct !== null && (
            <div
              className={`text-[10px] font-semibold mt-1 flex items-center gap-1 ${
                growthPct >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
              }`}
            >
              {growthPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`} vs mes ant.</span>
            </div>
          )}
        </div>

        {/* Mes Anterior */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Mes Anterior
          </div>
          <div className="text-xl font-black text-[#64748B] mt-1.5">
            ${analytics.previousMonthRevenue.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-[#94A3B8] mt-1">Total facturado</div>
        </div>

        {/* MRR */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            MRR Actual
          </div>
          <div className="text-xl font-black text-[#3A86FF] mt-1.5">
            ${analytics.mrr.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-[#3A86FF] font-medium mt-1">Suscripciones activas</div>
        </div>

        {/* Nuevo MRR */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            Nuevo MRR
          </div>
          <div className="text-xl font-black text-[#10B981] mt-1.5">
            +${analytics.newMrr.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-[#10B981] font-medium mt-1">Altas este mes</div>
        </div>

        {/* MRR Perdido */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            MRR Perdido
          </div>
          <div className="text-xl font-black text-[#EF4444] mt-1.5">
            -${analytics.lostMrr.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-[#EF4444] font-medium mt-1">Churn este mes</div>
        </div>

        {/* ARPU */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
            ARPU
          </div>
          <div className="text-xl font-black text-[#8B5CF6] mt-1.5">
            ${analytics.arpu.toLocaleString("es-AR")}
          </div>
          <div className="text-[10px] text-[#8B5CF6] font-medium mt-1">Promedio por cliente</div>
        </div>
      </div>

      {/* 12-Month Revenue & MRR Chart */}
      <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#3A86FF]" />
              <span>Evolución Financiera (Últimos 12 Meses)</span>
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Comparativa mensual entre Revenue Real Cobrado y MRR Contratado
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#10B981]" />
              <span className="text-[#334155]">Revenue Real</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-[#3A86FF]" />
              <span className="text-[#334155]">MRR</span>
            </div>
          </div>
        </div>

        {/* Bar Visualization */}
        <div className="grid grid-cols-12 gap-2 h-64 items-end pt-6 px-2">
          {analytics.monthlyHistory.map((item) => {
            const revHeight = Math.max(
              Math.round((item.realRevenue / maxHistoryVal) * 100),
              4
            );
            const mrrHeight = Math.max(Math.round((item.mrr / maxHistoryVal) * 100), 4);

            return (
              <div
                key={item.month}
                className="flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-[#0F172A] text-white text-[10px] px-2 py-1 rounded shadow-lg z-20 pointer-events-none whitespace-nowrap">
                  <span>Rev: ${item.realRevenue.toLocaleString("es-AR")}</span>
                  <span>MRR: ${item.mrr.toLocaleString("es-AR")}</span>
                </div>

                <div className="flex items-end gap-1 w-full justify-center h-full">
                  {/* Revenue bar */}
                  <div
                    style={{ height: `${revHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-[#10B981] rounded-t transition-all group-hover:brightness-110"
                  />
                  {/* MRR bar */}
                  <div
                    style={{ height: `${mrrHeight}%` }}
                    className="w-2.5 sm:w-3.5 bg-[#3A86FF] rounded-t transition-all group-hover:brightness-110"
                  />
                </div>

                <span className="text-[10px] text-[#64748B] font-medium mt-2 capitalize text-center truncate w-full">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-[#94A3B8] pt-2 border-t border-[#F1F5F9]">
          * Revenue Real calculado únicamente sobre transacciones con status = approved y type = payment.
        </div>
      </div>
    </div>
  );
}
