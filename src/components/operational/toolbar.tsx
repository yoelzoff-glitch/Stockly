import * as React from "react";
import { cn } from "@/lib/utils";

interface OperationalToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function OperationalToolbar({
  className,
  children,
  ...props
}: OperationalToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white border border-[#DCDAD4] rounded-lg shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
