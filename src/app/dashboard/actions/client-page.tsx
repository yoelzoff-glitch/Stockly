"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, X, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { Button } from "@/components/ui/button";
import { getAiActionDetail, AiActionDetail } from "./actions";

export interface AiActionListItem {
  id: string;
  action_type: string;
  status: string;
  title: string;
  description: string | null;
  created_at: string;
  executed_at: string | null;
  failed_reason: string | null;
  risk_score: string | null;
  error_message: string | null;
}

interface ActionsClientPageProps {
  initialActions: AiActionListItem[];
  metrics: MetricItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

export function ActionsClientPage({
  initialActions,
  metrics,
  totalCount,
  currentPage,
  pageSize,
}: ActionsClientPageProps) {
  const router = useRouter();
  const [selectedAction, setSelectedAction] = useState<AiActionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailActionId, setDetailActionId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleOpenDetail = async (actionId: string) => {
    setDetailActionId(actionId);
    setIsLoadingDetail(true);
    try {
      const detail = await getAiActionDetail(actionId);
      setSelectedAction(detail);
    } catch (err) {
      console.error("Error loading action detail:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedAction(null);
    setDetailActionId(null);
  };

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

  const getRiskVariant = (risk: string | null): "neutral" | "success" | "warning" | "danger" => {
    switch (risk?.toUpperCase()) {
      case "LOW": return "success";
      case "MEDIUM": return "warning";
      case "HIGH": return "danger";
      default: return "neutral";
    }
  };

  return (
    <>
      <MetricStrip metrics={metrics} columns={4} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Historial de Operaciones</h3>
            <p className="text-xs text-[#5F6875]">Trazabilidad cronológica de eventos y resultados (página {currentPage} de {totalPages}).</p>
          </div>
          <span className="text-xs font-mono text-[#5F6875]">{totalCount} registros totales</span>
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
                  <th className="px-3 py-2.5 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {initialActions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <OperationalEmptyState
                        title="No hay acciones registradas aún"
                        description="Las acciones automáticas o programadas aparecerán en esta tabla cuando se generen alertas o sugerencias operativas."
                      />
                    </td>
                  </tr>
                ) : (
                  initialActions.map((action) => {
                    const risk = action.risk_score || "LOW";
                    const errorMessage = action.error_message || action.failed_reason;

                    return (
                      <tr key={action.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-[#101828] max-w-sm truncate" title={action.title}>
                            {action.title}
                          </div>
                          {errorMessage && (
                            <div className="text-[11px] text-[#D92D20] mt-0.5 font-mono truncate max-w-sm">
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
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>
                          ) : (
                            <span className="text-[#5F6875]">Pendiente de ejecución</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => handleOpenDetail(action.id)}
                            disabled={isLoadingDetail && detailActionId === action.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#2F343B] hover:text-[#0C111D] hover:bg-[#F5F3EE] border border-[#DCDAD4] rounded transition-colors"
                            title="Ver carga útil y resultado (carga bajo demanda)"
                          >
                            <Eye className="w-3 h-3" />
                            {isLoadingDetail && detailActionId === action.id ? "Cargando..." : "Ver"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#DCDAD4] bg-[#FCFCFA]">
              <span className="text-xs text-[#5F6875]">
                Mostrando {Math.min(initialActions.length, pageSize)} de {totalCount} acciones
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => router.push(`/dashboard/actions?page=${currentPage - 1}`)}
                  className="text-xs h-7 px-2.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="text-xs text-[#5F6875] px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => router.push(`/dashboard/actions?page=${currentPage + 1}`)}
                  className="text-xs h-7 px-2.5"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </DataTableShell>
      </div>

      {/* Lazy Detail Modal */}
      {selectedAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-[#DCDAD4] shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DCDAD4]">
              <div>
                <h4 className="text-sm font-semibold text-[#101828]">Detalle de Acción</h4>
                <p className="text-xs text-[#5F6875] font-mono">{selectedAction.id}</p>
              </div>
              <button
                onClick={handleCloseDetail}
                className="text-[#5F6875] hover:text-[#101828] p-1 rounded hover:bg-[#F5F3EE]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <span className="font-semibold text-[#5F6875] uppercase text-[10px] tracking-wider">Título</span>
                <p className="text-sm font-medium text-[#101828] mt-0.5">{selectedAction.title}</p>
              </div>

              {selectedAction.description && (
                <div>
                  <span className="font-semibold text-[#5F6875] uppercase text-[10px] tracking-wider">Descripción</span>
                  <p className="text-[#2F343B] mt-0.5">{selectedAction.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 bg-[#FCFCFA] p-3 rounded border border-[#DCDAD4]">
                <div>
                  <span className="text-[#5F6875] text-[11px]">Tipo de Acción:</span>
                  <p className="font-mono font-medium text-[#101828]">{selectedAction.action_type}</p>
                </div>
                <div>
                  <span className="text-[#5F6875] text-[11px]">Estado:</span>
                  <div className="mt-0.5">
                    <StatusBadge variant={getStatusVariant(selectedAction.status)}>
                      {getStatusLabel(selectedAction.status)}
                    </StatusBadge>
                  </div>
                </div>
                <div>
                  <span className="text-[#5F6875] text-[11px]">Creado:</span>
                  <p className="font-mono text-[#101828]">{new Date(selectedAction.created_at).toLocaleString("es-AR")}</p>
                </div>
                <div>
                  <span className="text-[#5F6875] text-[11px]">Ejecutado:</span>
                  <p className="font-mono text-[#101828]">
                    {selectedAction.executed_at ? new Date(selectedAction.executed_at).toLocaleString("es-AR") : "Pendiente"}
                  </p>
                </div>
              </div>

              {selectedAction.failed_reason && (
                <div className="p-3 rounded bg-[#FEF3F2] border border-[#FECDCA]">
                  <span className="font-semibold text-[#D92D20] text-[11px]">Motivo del fallo:</span>
                  <p className="text-[#B42318] mt-0.5 font-mono">{selectedAction.failed_reason}</p>
                </div>
              )}

              <div>
                <span className="font-semibold text-[#5F6875] uppercase text-[10px] tracking-wider">Payload (Cargado On-Demand)</span>
                <pre className="mt-1 p-3 bg-[#101828] text-[#EAECF0] rounded font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAction.payload, null, 2)}
                </pre>
              </div>

              {selectedAction.result && (
                <div>
                  <span className="font-semibold text-[#5F6875] uppercase text-[10px] tracking-wider">Resultado de Ejecución</span>
                  <pre className="mt-1 p-3 bg-[#101828] text-[#EAECF0] rounded font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedAction.result, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#DCDAD4] bg-[#FCFCFA] flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCloseDetail}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
