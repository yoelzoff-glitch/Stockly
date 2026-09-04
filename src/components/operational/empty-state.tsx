import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface OperationalEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function OperationalEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: OperationalEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 py-14 text-center bg-white border border-[#DCDAD4] rounded-lg",
        className
      )}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center mb-3 text-[#5F6875]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-bold text-[#101828]">{title}</h3>
      <p className="mt-1 text-sm text-[#5F6875] max-w-md leading-relaxed">
        {description}
      </p>
      {actionLabel && (
        <div className="mt-4">
          {actionHref ? (
            <Link href={actionHref}>
              <Button
                variant="outline"
                className="border-[#DCDAD4] text-xs font-semibold hover:bg-[#F5F3EE] text-[#101828]"
              >
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={onAction}
              variant="outline"
              className="border-[#DCDAD4] text-xs font-semibold hover:bg-[#F5F3EE] text-[#101828]"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
