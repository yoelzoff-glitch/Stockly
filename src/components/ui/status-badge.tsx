import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "operative"
  | "critical"
  | "disconnected";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusBadgeVariant;
  dot?: boolean;
  children: React.ReactNode;
}

export function StatusBadge({
  variant = "neutral",
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const variantStyles: Record<StatusBadgeVariant, { container: string; dot: string }> = {
    success: {
      container: "bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]",
      dot: "bg-[#198754]",
    },
    operative: {
      container: "bg-[#ECFDF3] text-[#067647] border-[#ABEFC6]",
      dot: "bg-[#198754]",
    },
    warning: {
      container: "bg-[#FFF9EB] text-[#7A4100] border-[#F2C94C]",
      dot: "bg-[#F2C94C]",
    },
    danger: {
      container: "bg-[#FEF3F2] text-[#912018] border-[#FECDCA]",
      dot: "bg-[#D92D20]",
    },
    critical: {
      container: "bg-[#FEF3F2] text-[#912018] border-[#FECDCA]",
      dot: "bg-[#D92D20]",
    },
    info: {
      container: "bg-[#F0F5FF] text-[#102A56] border-[#B9D5FF]",
      dot: "bg-[#102A56]",
    },
    neutral: {
      container: "bg-[#F8FAFC] text-[#5F6875] border-[#DCDAD4]",
      dot: "bg-[#94A3B8]",
    },
    disconnected: {
      container: "bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1]",
      dot: "bg-[#64748B]",
    },
  };

  const style = variantStyles[variant] || variantStyles.neutral;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold leading-normal",
        style.container,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </div>
  );
}
