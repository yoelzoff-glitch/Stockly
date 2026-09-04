import { generateBusinessInsights } from "@/services/analytics/insights";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";

interface InsightsSectionProps {
  tenantId: string;
}

/**
 * Server Component que muestra las prioridades operativas de hoy en una lista compacta.
 * Se enfoca en alertas de acción (atención, crítica, informativa) y elimina felicitaciones genéricas.
 */
export async function InsightsSection({ tenantId }: InsightsSectionProps) {
  const rawInsights = await generateBusinessInsights(tenantId);

  // Filtrar recomendaciones positivas genéricas que no implican acción operativa
  const actionableInsights = (rawInsights || []).filter(
    (i) => i.type === "warning" || i.type === "negative" || i.actionLabel
  );

  if (!actionableInsights || actionableInsights.length === 0) return null;

  const getLevelConfig = (type: string) => {
    switch (type) {
      case "negative":
        return {
          label: "Crítica",
          badgeClass: "bg-red-50 text-[#D92D20] border-red-200",
          icon: AlertCircle,
        };
      case "warning":
        return {
          label: "Atención",
          badgeClass: "bg-amber-50 text-[#B54708] border-amber-200",
          icon: AlertTriangle,
        };
      default:
        return {
          label: "Informativa",
          badgeClass: "bg-[#F5F3EE] text-[#102A56] border-[#DCDAD4]",
          icon: Info,
        };
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#DCDAD4] shadow-xs p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
        <div>
          <h3 className="text-base font-bold text-[#101828]">
            Prioridades de hoy
          </h3>
          <p className="text-xs text-[#5F6875] mt-0.5">
            Situaciones que requieren seguimiento o acción en tu cuenta.
          </p>
        </div>
        <span className="text-xs font-semibold text-[#5F6875] tabular-nums">
          {actionableInsights.length} {actionableInsights.length === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      <div className="divide-y divide-[#DCDAD4]">
        {actionableInsights.map((insight) => {
          const config = getLevelConfig(insight.type);
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Icon className={`w-4 h-4 ${insight.type === "negative" ? "text-[#D92D20]" : insight.type === "warning" ? "text-[#B54708]" : "text-[#102A56]"}`} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#101828]">
                      {insight.title}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6875] leading-relaxed max-w-2xl">
                    {insight.description}
                  </p>
                </div>
              </div>

              {insight.actionLabel && (
                <Link
                  href={insight.actionHref || "#"}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#102A56] bg-[#F5F3EE] hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors shrink-0 self-start sm:self-center"
                >
                  <span>{insight.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
