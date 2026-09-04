import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricCardVariant = "blue" | "green" | "amber" | "red" | "purple" | "slate";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  variant?: MetricCardVariant;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
}: MetricCardProps) {
  return (
    <Card className="bg-white border-[#DCDAD4] shadow-sm overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
          <span>{title}</span>
          {icon && <span className="text-[#5F6875]">{icon}</span>}
        </div>
        <div className="space-y-1">
          <p
            className="text-2xl font-bold text-[#101828] tracking-tight"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "font-semibold",
                  trend.isPositive ? "text-[#198754]" : "text-[#D92D20]"
                )}
              >
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
              {description && (
                <span className="text-xs text-[#5F6875]">{description}</span>
              )}
            </div>
          )}
          {!trend && description && (
            <p className="text-xs text-[#5F6875]">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
