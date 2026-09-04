import * as React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeVariant = "info" | "warning" | "error" | "success";

interface OperationalNoticeProps {
  variant?: NoticeVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function OperationalNotice({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: OperationalNoticeProps) {
  const variantConfig = {
    info: {
      container: "bg-[#F0F5FF] border-[#B9D5FF] text-[#102A56]",
      icon: <Info className="w-4 h-4 text-[#102A56] shrink-0 mt-0.5" />,
    },
    warning: {
      container: "bg-[#FFF9EB] border-[#F2C94C] text-[#7A4100]",
      icon: <AlertTriangle className="w-4 h-4 text-[#B54708] shrink-0 mt-0.5" />,
    },
    error: {
      container: "bg-[#FEF3F2] border-[#FECDCA] text-[#912018]",
      icon: <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />,
    },
    success: {
      container: "bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]",
      icon: <CheckCircle2 className="w-4 h-4 text-[#198754] shrink-0 mt-0.5" />,
    },
  };

  const current = variantConfig[variant];

  return (
    <div
      className={cn(
        "border rounded-lg p-3.5 flex items-start justify-between gap-3 text-sm",
        current.container,
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {current.icon}
        <div className="space-y-0.5">
          {title && <h4 className="font-bold text-xs uppercase tracking-wider">{title}</h4>}
          <div className="text-xs leading-relaxed opacity-90">{children}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-black/5 transition-colors opacity-70 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
