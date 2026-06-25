import { generateBusinessInsights } from "@/services/analytics/insights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import Link from "next/link";

interface InsightsSectionProps {
  tenantId: string;
}

/**
 * Server Component that asynchronously fetches and displays Klyvo business insights/recommendations.
 * It is designed to be streamed via Suspense.
 */
export async function InsightsSection({ tenantId }: InsightsSectionProps) {
  const insights = await generateBusinessInsights(tenantId);

  if (!insights || insights.length === 0) return null;

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-500">
      <h3 className="text-xl font-bold flex items-center gap-2.5 text-slate-900 dark:text-white tracking-tight">
        <div className="p-1.5 bg-amber-100 dark:bg-amber-950/40 rounded-lg">
          <Lightbulb className="w-5 h-5 text-amber-500 animate-pulse" />
        </div>
        Klyvo Recomienda
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight) => {
          // Curated status color border configurations
          let borderColor = "#6366f1"; // default: indigo
          if (insight.type === 'positive') borderColor = "#10b981"; // emerald
          else if (insight.type === 'negative') borderColor = "#ef4444"; // rose/red
          else if (insight.type === 'warning') borderColor = "#f59e0b"; // amber

          return (
            <Card 
              key={insight.id} 
              className="group border-l-[6px] border-y-slate-100 border-r-slate-100 dark:border-y-slate-800 dark:border-r-slate-800 hover:border-slate-200 dark:hover:border-slate-700 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 bg-white dark:bg-slate-900 overflow-hidden"
              style={{ borderLeftColor: borderColor }}
            >
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold text-slate-850 dark:text-slate-100 group-hover:text-indigo-650 transition-colors">
                  {insight.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex flex-col justify-between h-[calc(100%-52px)] min-h-[110px]">
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  {insight.description}
                </p>
                {insight.actionLabel && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs h-9 rounded-full font-semibold border-slate-200 dark:border-slate-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-white transition-all duration-200" 
                    asChild
                  >
                    <Link href={insight.actionHref || "#"}>
                      {insight.actionLabel}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
