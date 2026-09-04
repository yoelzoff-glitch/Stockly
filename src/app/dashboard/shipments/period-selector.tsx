'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export default function PeriodSelector({ currentPeriod }: { currentPeriod: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams);
    params.set("period", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Período:</span>
      <select
        value={currentPeriod}
        onChange={handlePeriodChange}
        className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-[#102A56]"
      >
        <option value="current_month">Mes Actual</option>
        <option value="last_month">Mes Anterior</option>
        <option value="last_30">Últimos 30 días</option>
        <option value="all">Todo el historial</option>
      </select>
    </div>
  );
}
