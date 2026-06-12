"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TimeFilter({ initialDays }: { initialDays: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDaysChange = (days: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", days);
    router.push(`/dashboard/analytics?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-500">Filtrar por:</span>
      <select
        value={initialDays}
        onChange={(e) => handleDaysChange(e.target.value)}
        className="flex h-10 w-[180px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option value="7">Últimos 7 días</option>
        <option value="30">Últimos 30 días</option>
        <option value="90">Últimos 90 días</option>
      </select>
    </div>
  );
}
