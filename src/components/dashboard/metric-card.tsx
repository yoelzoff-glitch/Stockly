import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type MetricCardVariant = "blue" | "green" | "amber" | "red" | "purple" | "slate"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ReactNode
  variant?: MetricCardVariant
  trend?: {
    value: string | number
    isPositive: boolean
  }
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  variant = "blue",
  trend
}: MetricCardProps) {
  const variantStyles = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-violet-50 text-violet-600 border-violet-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  }

  return (
    <Card className="overflow-hidden hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-500 text-sm tracking-tight">{title}</h3>
          <div className={cn("p-2.5 rounded-full border transition-transform duration-300 group-hover:scale-110", variantStyles[variant])}>
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                trend.isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {trend.isPositive ? "↑" : "↓"} {trend.value}
              </span>
              {description && <span className="text-xs text-slate-500 ml-1">{description}</span>}
            </div>
          )}
          {!trend && description && (
            <p className="text-sm text-slate-500 mt-2">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
