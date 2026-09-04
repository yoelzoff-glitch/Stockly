"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

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
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-[#5F6875] uppercase tracking-wider hidden sm:inline">
        Período:
      </span>
      <div className="inline-flex rounded-lg border border-[#DCDAD4] bg-[#F5F3EE] p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handlePeriodChange(opt.value)}
            disabled={isPending}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              currentDays === opt.value
                ? "bg-white text-[#101828] shadow-xs"
                : "text-[#5F6875] hover:text-[#101828]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {isPending && (
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#102A56]" />
      )}
    </div>
  );
}
