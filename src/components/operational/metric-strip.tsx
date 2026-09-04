import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricItem {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  highlight?: "neutral" | "positive" | "warning" | "critical";
}

interface MetricStripProps {
  metrics: MetricItem[];
  className?: string;
  columns?: 2 | 3 | 4 | 5;
}

export function MetricStrip({
  metrics,
  className,
  columns,
}: MetricStripProps) {
  const colCount = columns || metrics.length;

  const gridColsClass =
    colCount === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : colCount === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : colCount === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5";

  return (
    <div
      className={cn(
        "grid bg-white border border-[#DCDAD4] rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#DCDAD4] shadow-sm",
        gridColsClass,
        className
      )}
    >
      {metrics.map((m, idx) => {
        const highlightClass =
          m.highlight === "positive"
            ? "text-[#198754]"
            : m.highlight === "warning"
            ? "text-[#B54708]"
            : m.highlight === "critical"
            ? "text-[#D92D20]"
            : "text-[#101828]";

        return (
          <div key={idx} className="p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
              <span>{m.label}</span>
              {m.icon && <span className="text-[#5F6875]">{m.icon}</span>}
            </div>

            <div className="space-y-1">
              <div
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  highlightClass
                )}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {m.value}
              </div>

              {m.trend && (
                <div className="flex items-center gap-1 text-xs">
                  <span
                    className={cn(
                      "font-semibold",
                      m.trend.isPositive ? "text-[#198754]" : "text-[#D92D20]"
                    )}
                  >
                    {m.trend.isPositive ? "↑" : "↓"} {m.trend.value}
                  </span>
                </div>
              )}

              {m.subtext && (
                <p className="text-xs text-[#5F6875] leading-tight">
                  {m.subtext}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
