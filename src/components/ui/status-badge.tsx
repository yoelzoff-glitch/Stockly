import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusBadgeVariant = 
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusBadgeVariant
  children: React.ReactNode
}

export function StatusBadge({
  variant = "neutral",
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const variantStyles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
