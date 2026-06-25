import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sparkles, Lightbulb } from "lucide-react";

/**
 * Skeleton loader for the AI Daily Summary Section.
 * Mimics the shape and design of DailySummarySection.
 */
export function DailySummarySkeleton() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-fuchsia-500/90 border-none shadow-[0_8px_32px_rgba(99,102,241,0.15)] animate-pulse">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-white/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-yellow-200/50" />
          </div>
          <Skeleton className="h-5 w-48 bg-white/20 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full bg-white/20 rounded-md" />
        <Skeleton className="h-4 w-[92%] bg-white/20 rounded-md" />
        <Skeleton className="h-4 w-[85%] bg-white/20 rounded-md" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton loader for the Business Insights Section.
 * Mimics the shape and design of InsightsSection.
 */
export function InsightsSkeleton() {
  return (
    <div className="space-y-5">
      <h3 className="text-xl font-bold flex items-center gap-2.5 text-slate-900/40 dark:text-white/40 tracking-tight animate-pulse">
        <div className="p-1.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
          <Lightbulb className="w-5 h-5 text-slate-300 dark:text-slate-700" />
        </div>
        <Skeleton className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-l-[6px] border-l-slate-200 dark:border-l-slate-800 border-y-slate-100 border-r-slate-100 dark:border-y-slate-800 dark:border-r-slate-800 shadow-sm animate-pulse bg-white dark:bg-slate-900">
            <CardHeader className="p-5 pb-2">
              <Skeleton className="h-4 w-32 bg-slate-200 dark:bg-slate-850 rounded-md" />
            </CardHeader>
            <CardContent className="p-5 pt-0 flex flex-col justify-between min-h-[110px] space-y-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-full bg-slate-200 dark:bg-slate-850 rounded-md" />
                <Skeleton className="h-3 w-[90%] bg-slate-200 dark:bg-slate-850 rounded-md" />
                <Skeleton className="h-3 w-[75%] bg-slate-200 dark:bg-slate-850 rounded-md" />
              </div>
              <Skeleton className="h-9 w-full bg-slate-200 dark:bg-slate-850 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
