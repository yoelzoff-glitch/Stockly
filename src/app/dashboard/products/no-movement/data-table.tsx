"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause, Sparkles, Download, MessageSquare } from "lucide-react";
// Removed useToast
import { createPauseProductsWorkflow } from "./actions";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState({});
  const [isPending, setIsPending] = useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  const handlePauseSelected = async () => {
    if (selectedCount === 0) return;
    setIsPending(true);
    try {
      const productIds = selectedRows.map((r: any) => r.original.id);
      const res = await createPauseProductsWorkflow(productIds);
      if (res.success) {
        alert(`Se ha creado una solicitud para pausar ${productIds.length - res.skippedCount} productos. Revisa el Asistente IA para confirmar.`);
        table.toggleAllRowsSelected(false);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-500">Acciones Masivas</span>
          <span className="text-xs text-slate-400">{selectedCount} seleccionados</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={() => {}}>
            <Sparkles className="w-4 h-4 mr-2 text-amber-500" /> Crear Promoción
          </Button>
          <Button variant="outline" size="sm" disabled={selectedCount === 0} onClick={handlePauseSelected}>
            <Pause className="w-4 h-4 mr-2 text-red-500" /> Pausar Seleccionados
          </Button>
          <Button variant="outline" size="sm" onClick={() => { /* Export logic */ }}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-slate-50/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-slate-500"
                >
                  No hay productos estancados con los filtros actuales.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
