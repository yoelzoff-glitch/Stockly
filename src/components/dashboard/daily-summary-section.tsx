import { getOrCreateDailySummary } from "@/services/ai/dailySummary";

interface DailySummarySectionProps {
  tenantId: string;
}

/**
 * Componente que muestra de forma sobria y complementaria la lectura del día generada.
 * Diseñado para cargarse asíncronamente con Suspense sin protagonismo visual excesivo.
 */
export async function DailySummarySection({ tenantId }: DailySummarySectionProps) {
  const dailySummary = await getOrCreateDailySummary(tenantId);
  
  if (!dailySummary) return null;
  
  return (
    <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
        <h3 className="text-sm font-bold text-[#101828]">
          Lectura del día
        </h3>
        <span className="text-[11px] font-semibold text-[#5F6875] bg-[#F5F3EE] px-2.5 py-0.5 rounded border border-[#DCDAD4]">
          Generado automáticamente
        </span>
      </div>
      <p className="text-sm text-[#5F6875] leading-relaxed whitespace-pre-wrap font-normal">
        {dailySummary}
      </p>
    </div>
  );
}
