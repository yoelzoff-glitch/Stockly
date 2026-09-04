import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface OperationalPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  backLink?: {
    href: string;
    label: string;
  };
  className?: string;
  children?: React.ReactNode;
}

export function OperationalPageHeader({
  eyebrow,
  title,
  description,
  actions,
  status,
  backLink,
  className,
  children,
}: OperationalPageHeaderProps) {
  return (
    <div className={cn("space-y-3 pb-2", className)}>
      {backLink && (
        <div>
          <Link
            href={backLink.href}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5F6875] hover:text-[#101828] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLink.label}</span>
          </Link>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
              {title}
            </h1>
            {status}
          </div>
          {description && (
            <p className="text-sm text-[#5F6875] max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
