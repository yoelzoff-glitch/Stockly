"use client";

import { ActivationStep, markStepCompletedAction } from "@/actions/activation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

const STEP_DESCRIPTIONS: Record<string, string> = {
  connect_meli: "Vincula tu cuenta oficial para sincronizar publicaciones, órdenes de venta y comisiones de Mercado Libre.",
  sync_products: "Importa el catálogo activo con sus SKUs, stock disponible y precios publicados.",
  sync_orders: "Registra cobros, envíos, comisiones e impuestos de cada venta realizada.",
  load_costs: "Permite calcular el margen neto real por producto y detectar publicaciones a pérdida.",
  config_ai: "Establece reglas operativas y preferencias comerciales para el negocio.",
  connect_whatsapp: "Habilita canal de mensajería para alertas de stock y consultas directas.",
  first_ai_query: "Prueba la consulta de métricas de catálogo o rentabilidad operativa."
};

export default function GetStartedClient({ data }: { data: { steps: ActivationStep[], percentage: number, completedSteps: number, totalSteps: number } }) {
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  const handleManualComplete = async (stepId: string) => {
    setLoadingStep(stepId);
    try {
      await markStepCompletedAction(stepId);
    } catch (e) {
      console.error(e);
    }
    setLoadingStep(null);
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Horizontal Progress Summary Card */}
      <div className="bg-[#FFFFFF] border border-[#DCDAD4] rounded-xl p-5 md:p-6 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#101828]">
              Progreso de activación operativa
            </h2>
            <p className="text-xs text-[#5F6875] mt-0.5">
              {data.completedSteps} de {data.totalSteps} pasos completados ({data.percentage}%)
            </p>
          </div>
          <div className="text-right">
            <span
              className="text-2xl font-extrabold text-[#101828] tabular-nums"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {data.percentage}%
            </span>
          </div>
        </div>

        <div className="w-full bg-[#F5F3EE] h-2.5 rounded-full overflow-hidden border border-[#DCDAD4]/40">
          <div
            className="bg-[#102A56] h-full transition-all duration-500 ease-out"
            style={{ width: `${data.percentage}%` }}
          />
        </div>

        <p className="text-[11px] text-[#5F6875]">
          Cada paso completado habilita una dimensión operativa de cálculo, control de stock y márgenes reales en Klyvo.
        </p>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {data.steps.map((step, idx) => {
          const isManual = step.id === "connect_whatsapp" || step.id === "first_ai_query";
          const desc = STEP_DESCRIPTIONS[step.id] || "Paso de configuración operativa.";

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-4 md:p-5 transition-colors shadow-xs ${
                step.completed
                  ? "bg-[#FFFFFF] border-[#DCDAD4]"
                  : "bg-[#FFFFFF] border-[#DCDAD4] hover:border-[#102A56]/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 shrink-0">
                    {step.completed ? (
                      <div className="w-6 h-6 rounded-full bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-[#198754]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center text-[11px] font-bold text-[#5F6875]">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#101828]">
                        {step.title}
                      </h3>
                      <StatusBadge variant={step.completed ? "success" : "warning"}>
                        {step.completed ? "Completado" : "Pendiente"}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-[#5F6875] leading-relaxed max-w-xl">
                      {desc}
                    </p>
                  </div>
                </div>

                {!step.completed && (
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isManual && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManualComplete(step.id)}
                        disabled={loadingStep === step.id}
                        className="border-[#DCDAD4] text-xs h-8"
                      >
                        {loadingStep === step.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          "Marcar listo"
                        )}
                      </Button>
                    )}
                    {step.actionUrl && (
                      <Button
                        asChild
                        size="sm"
                        className="bg-[#102A56] hover:bg-[#0A1D3C] text-white text-xs h-8"
                      >
                        <Link href={step.actionUrl}>
                          Ir a configurar
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
