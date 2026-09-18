"use client";

import React, { useState } from "react";
import { TenantEgressMetricsDetailed } from "@/lib/observability/egress";
import { ChevronDown, ChevronRight, Activity, Clock, Layers, Moon } from "lucide-react";

interface Props {
  summaries: TenantEgressMetricsDetailed[];
  tenantMap: Record<string, string>;
}

export function ClientEgressTable({ summaries, tenantMap }: Props) {
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  const toggleExpand = (tenantId: string) => {
    setExpandedTenantId(expandedTenantId === tenantId ? null : tenantId);
  };

  return (
    <div className="divide-y divide-[#E2E8F0]">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="px-4 py-3">Tenant</th>
            <th className="px-4 py-3 text-right">Egress Real</th>
            <th className="px-4 py-3 text-center">Estado Budget</th>
            <th className="px-4 py-3 text-right">Queries</th>
            <th className="px-4 py-3">Top Operación</th>
            <th className="px-4 py-3">Top Tabla</th>
            <th className="px-4 py-3 text-right">Tasa Reposo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {summaries.map((s) => {
            const tenantName = tenantMap[s.tenantId] || s.tenantId;
            const isCritical = s.budgetStatus === "CRITICAL";
            const isWarning = s.budgetStatus === "WARNING";
            const isExpanded = expandedTenantId === s.tenantId;

            return (
              <React.Fragment key={s.tenantId}>
                <tr
                  onClick={() => toggleExpand(s.tenantId)}
                  className={`cursor-pointer transition-colors ${
                    isExpanded ? "bg-[#F1F5F9]" : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <td className="px-3 py-3.5 text-center text-[#64748B]">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#3A86FF]" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-[#0F172A]">
                    <div className="font-semibold flex items-center gap-2">
                      <span>{tenantName}</span>
                      {s.idleRateMbPerHour > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-700 font-bold">
                          Idle &gt; 1 MB/h
                        </span>
                      )}
                    </div>
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
                  <td className="px-4 py-3.5 text-right font-mono text-[11px] text-[#64748B]">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        s.idleRateMbPerHour < 1 ? "text-[#059669]" : "text-[#D97706] font-semibold"
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      {s.idleRateMbPerHour.toFixed(2)} MB/h
                    </span>
                  </td>
                </tr>

                {/* Drill-down Detail Panel */}
                {isExpanded && (
                  <tr className="bg-[#F8FAFC]">
                    <td colSpan={8} className="p-5 border-y border-[#CBD5E1]">
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-3">
                          <div>
                            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                              <Activity className="w-4 h-4 text-[#3A86FF]" />
                              <span>Desglose Detallado de Egress: {tenantName}</span>
                            </h3>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              Métricas reales registradas por hora, tabla y operación para la fecha seleccionada.
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <div className="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0]">
                              <span className="text-[#64748B]">Egress en Reposo (Idle):</span>{" "}
                              <strong className="text-[#0F172A]">{s.idleEgressMb} MB</strong>
                            </div>
                            <div className="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0]">
                              <span className="text-[#64748B]">Tasa Promedio Idle:</span>{" "}
                              <strong className={s.idleRateMbPerHour < 1 ? "text-[#059669]" : "text-[#DC2626]"}>
                                {s.idleRateMbPerHour} MB/h (Meta &lt; 1 MB/h)
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Top Operations & Top Tables side-by-side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Top Operations */}
                          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-3">
                            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#3A86FF]" />
                              <span>Top Operaciones</span>
                            </h4>
                            {s.topOperations.length === 0 ? (
                              <p className="text-xs text-[#94A3B8] italic py-2">Sin operaciones registradas hoy</p>
                            ) : (
                              <div className="space-y-2">
                                {s.topOperations.slice(0, 6).map((op) => (
                                  <div
                                    key={op.operation}
                                    className="flex items-center justify-between text-xs py-1 border-b border-[#F1F5F9] last:border-0"
                                  >
                                    <span className="font-mono text-[#334155]">{op.operation}</span>
                                    <div className="flex items-center gap-3 font-mono">
                                      <span className="text-[#94A3B8]">{op.queries} queries</span>
                                      <strong className="text-[#0F172A]">{op.mb} MB</strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Top Tables */}
                          <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-3">
                            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-[#10B981]" />
                              <span>Top Tablas Consultadas</span>
                            </h4>
                            {s.topTables.length === 0 ? (
                              <p className="text-xs text-[#94A3B8] italic py-2">Sin tablas registradas hoy</p>
                            ) : (
                              <div className="space-y-2">
                                {s.topTables.slice(0, 6).map((tab) => (
                                  <div
                                    key={tab.table}
                                    className="flex items-center justify-between text-xs py-1 border-b border-[#F1F5F9] last:border-0"
                                  >
                                    <span className="font-mono text-[#334155]">{tab.table}</span>
                                    <div className="flex items-center gap-3 font-mono">
                                      <span className="text-[#94A3B8]">{tab.queries} queries</span>
                                      <strong className="text-[#0F172A]">{tab.mb} MB</strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Hourly Timeline (00 to 23) */}
                        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-3">
                          <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span>Evolución Horaria de Transferencia (00:00 – 23:00 UTC)</span>
                          </h4>
                          <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-24 gap-1 pt-1">
                            {s.hourlyDistribution.map((hd) => {
                              const hasEgress = hd.bytes > 0;
                              return (
                                <div
                                  key={hd.hour}
                                  className={`p-1.5 rounded text-center border ${
                                    hasEgress
                                      ? hd.isActiveUserHour
                                        ? "bg-[#EFF6FF] border-[#BFDBFE]"
                                        : "bg-[#FFFBEB] border-[#FDE68A]"
                                      : "bg-[#F8FAFC] border-[#E2E8F0]"
                                  }`}
                                  title={`Hora ${hd.hour.toString().padStart(2, "0")}:00: ${hd.mb} MB (${hd.queries} queries) - ${
                                    hd.isActiveUserHour ? "Usuario Activo" : "Reposo / Background"
                                  }`}
                                >
                                  <div className="text-[10px] font-mono text-[#64748B]">
                                    {hd.hour.toString().padStart(2, "0")}h
                                  </div>
                                  <div
                                    className={`text-[10px] font-bold font-mono truncate ${
                                      hasEgress
                                        ? hd.mb > 10
                                          ? "text-[#DC2626]"
                                          : hd.mb > 5
                                          ? "text-[#D97706]"
                                          : "text-[#0F172A]"
                                        : "text-[#CBD5E1]"
                                    }`}
                                  >
                                    {hasEgress ? `${hd.mb}M` : "0"}
                                  </div>
                                  <div className="text-[8px] font-mono text-[#94A3B8]">
                                    {hasEgress ? `${hd.queries}q` : "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-[#64748B] pt-2 border-t border-[#F1F5F9]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded bg-[#EFF6FF] border border-[#BFDBFE]"></span>
                              <span>Hora con usuario activo</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded bg-[#FFFBEB] border border-[#FDE68A]"></span>
                              <span>Hora de reposo / sync automático</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]"></span>
                              <span>Sin tráfico</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
