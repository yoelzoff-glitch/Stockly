import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DataTableShellProps {
  children: React.ReactNode;
  pagination?: {
    currentPage: number;
    totalCount: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    label?: React.ReactNode;
  };
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
  className?: string;
}

export function DataTableShell({
  children,
  pagination,
  emptyState,
  isEmpty,
  className,
}: DataTableShellProps) {
  const pageSize = pagination?.pageSize || 50;
  const totalPages = pagination ? Math.ceil(pagination.totalCount / pageSize) : 1;

  return (
    <div
      className={cn(
        "bg-white border border-[#DCDAD4] rounded-lg shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto w-full">
        {isEmpty && emptyState ? (
          emptyState
        ) : (
          children
        )}
      </div>

      {pagination && pagination.totalCount > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#DCDAD4] bg-[#FCFCFA] text-xs text-[#5F6875]">
          <div>
            {pagination.label || (
              <span>
                Página <strong className="text-[#101828] font-semibold">{pagination.currentPage}</strong> de{" "}
                <strong className="text-[#101828] font-semibold">{totalPages}</strong> ({pagination.totalCount} registros en total)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="h-8 px-3 text-xs border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828]"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage >= totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="h-8 px-3 text-xs border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828]"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
