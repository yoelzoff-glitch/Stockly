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
    <select
      value={currentPeriod}
      onChange={handlePeriodChange}
      className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="current_month">Mes Actual</option>
      <option value="last_month">Mes Anterior</option>
      <option value="last_30">Últimos 30 días</option>
      <option value="all">Todo el historial</option>
    </select>
  );
}
