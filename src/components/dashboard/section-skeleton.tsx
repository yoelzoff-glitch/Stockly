import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for the subtle Daily Summary Section.
 * Matches the neutral white card style with fine borders.
 */
export function DailySummarySkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-3 animate-pulse">
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
        <Skeleton className="h-4 w-32 bg-[#EAE7DF]" />
        <Skeleton className="h-4 w-36 bg-[#EAE7DF] rounded" />
      </div>
      <div className="space-y-2 pt-1">
        <Skeleton className="h-3.5 w-full bg-[#EAE7DF]" />
        <Skeleton className="h-3.5 w-[90%] bg-[#EAE7DF]" />
        <Skeleton className="h-3.5 w-[75%] bg-[#EAE7DF]" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for the Prioridades de hoy Section.
 * Matches the compact list item layout.
 */
export function InsightsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4 animate-pulse">
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
        <Skeleton className="h-4 w-36 bg-[#EAE7DF]" />
        <Skeleton className="h-4 w-24 bg-[#EAE7DF]" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="p-3.5 rounded-lg border border-[#DCDAD4] bg-[#F5F3EE] space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-40 bg-[#EAE7DF]" />
              <Skeleton className="h-4 w-16 bg-[#EAE7DF] rounded" />
            </div>
            <Skeleton className="h-3 w-[85%] bg-[#EAE7DF]" />
          </div>
        ))}
      </div>
    </div>
  );
}
