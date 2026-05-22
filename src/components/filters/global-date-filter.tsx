"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

export function GlobalDateFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentRange = searchParams.get("range") || "7d";

  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", value);
    // Reset page on filter change
    if (params.has("page")) {
      params.set("page", "1");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-muted-foreground" />
      <Select value={currentRange} onValueChange={handleRangeChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Filtrar por fecha" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoy</SelectItem>
          <SelectItem value="7d">Últimos 7 días</SelectItem>
          <SelectItem value="14d">Últimos 14 días</SelectItem>
          <SelectItem value="30d">Últimos 30 días</SelectItem>
          <SelectItem value="this_month">Mes actual</SelectItem>
          <SelectItem value="last_month">Mes anterior</SelectItem>
          <SelectItem value="all">Todo el historial</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
