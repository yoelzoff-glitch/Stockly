import { getOrCreateDailySummary } from "@/services/ai/dailySummary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface DailySummarySectionProps {
  tenantId: string;
}

/**
 * Server Component that asynchronously fetches and displays the AI daily summary.
 * It is designed to be streamed via Suspense.
 */
export async function DailySummarySection({ tenantId }: DailySummarySectionProps) {
  const dailySummary = await getOrCreateDailySummary(tenantId);
  
  if (!dailySummary) return null;
  
  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white border-none shadow-[0_8px_32px_rgba(99,102,241,0.25)] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(99,102,241,0.4)]">
      {/* Decorative background glow shapes */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />
      
      <CardHeader className="relative pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl flex items-center gap-2.5 font-bold tracking-tight">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          </div>
          Resumen Automático de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap opacity-95 font-medium font-sans">
          {dailySummary}
        </p>
      </CardContent>
    </Card>
  );
}
