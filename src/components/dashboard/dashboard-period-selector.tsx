"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Calendar, RefreshCw } from "lucide-react";

export function DashboardPeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentDays = searchParams.get("days") || "7";

  const handlePeriodChange = (days: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", days);
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const options = [
    { value: "7", label: "7 días" },
    { value: "15", label: "15 días" },
    { value: "30", label: "30 días" },
    { value: "90", label: "90 días" },
  ];

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
        {isPending ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        )}
        <span className="hidden sm:inline">Período:</span>
      </div>
      
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-full border border-slate-200/50 dark:border-slate-800/50 shrink-0 shadow-sm">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handlePeriodChange(opt.value)}
            disabled={isPending}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              currentDays === opt.value
                ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/10"
                : "text-slate-500 hover:text-slate-750 dark:hover:text-slate-350"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
