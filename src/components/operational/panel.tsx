import * as React from "react";
import { cn } from "@/lib/utils";

interface OperationalPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
}

export function OperationalPanel({
  title,
  description,
  action,
  footer,
  className,
  headerClassName,
  bodyClassName,
  children,
  ...props
}: OperationalPanelProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <div
      className={cn(
        "bg-white border border-[#DCDAD4] rounded-lg shadow-sm overflow-hidden",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "px-5 py-4 border-b border-[#DCDAD4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFCFA]",
            headerClassName
          )}
        >
          <div className="space-y-0.5">
            {typeof title === "string" ? (
              <h3 className="text-base font-bold text-[#101828]">{title}</h3>
            ) : (
              title
            )}
            {description && (
              <p className="text-xs text-[#5F6875]">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className={cn("p-5", bodyClassName)}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-[#DCDAD4] bg-[#F8FAFC] text-xs text-[#5F6875]">
          {footer}
        </div>
      )}
    </div>
  );
}
