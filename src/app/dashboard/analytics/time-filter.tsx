"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TimeFilter({ initialDays }: { initialDays: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDaysChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    router.push(`/dashboard/analytics?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-[#5F6875]">Período:</span>
      <select
        value={initialDays}
        onChange={(e) => handleDaysChange(e.target.value)}
        className="h-9 w-[180px] rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-[#101828] shadow-sm transition-all focus:border-[#102A56] focus:outline-none focus:ring-1 focus:ring-[#102A56]"
      >
        <option value="current_month">Mes actual</option>
        <option value="7">Últimos 7 días</option>
        <option value="30">Últimos 30 días</option>
        <option value="90">Últimos 90 días</option>
      </select>
    </div>
  );
}
