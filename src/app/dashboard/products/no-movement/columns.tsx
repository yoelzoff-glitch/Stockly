"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Pause, Sparkles } from "lucide-react";
import { NoMovementProduct } from "@/services/analytics/noMovementProducts";

const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export const columns: ColumnDef<NoMovementProduct>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        aria-label="Select all"
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        aria-label="Select row"
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: "Producto",
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[200px]" title={product.title}>
            {product.title}
          </span>
          {product.sku && <span className="text-xs text-slate-500">SKU: {product.sku}</span>}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      if (status === "active") return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Activo</Badge>;
      if (status === "paused") return <Badge variant="secondary">Pausado</Badge>;
      return <Badge variant="outline">{status}</Badge>;
    },
  },
  {
    accessorKey: "price",
    header: "Precio",
    cell: ({ row }) => formatCurrency(row.getValue("price")),
  },
  {
    accessorKey: "available_quantity",
    header: "Stock",
  },
  {
    accessorKey: "daysWithoutSales",
    header: "Días s/Venta",
    cell: ({ row }) => {
      const days = row.getValue("daysWithoutSales") as number;
      return (
        <span className={days > 60 ? "text-red-500 font-semibold" : days > 30 ? "text-amber-500" : ""}>
          {days}+
        </span>
      );
    }
  },
  {
    accessorKey: "immobilizedCost",
    header: "Costo Inmovilizado",
    cell: ({ row }) => {
      const cost = row.getValue("immobilizedCost") as number;
      if (cost === 0) return <span className="text-slate-400 text-xs">Sin costo</span>;
      return <span className="font-medium">{formatCurrency(cost)}</span>;
    },
  },
  {
    accessorKey: "recommendation",
    header: "Recomendación Klyvo",
    cell: ({ row }) => {
      const rec = row.getValue("recommendation") as string;
      if (rec.includes("promoción")) return <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">{rec}</Badge>;
      if (rec.includes("pausar")) return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">{rec}</Badge>;
      if (rec.includes("costo")) return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{rec}</Badge>;
      return <span className="text-sm text-slate-500">{rec}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={() => window.open(product.permalink, "_blank")} title="Ver en Mercado Libre">
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:bg-amber-50" onClick={() => { /* Trigger Promotion */ }} title="Crear Oferta">
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => { /* Trigger Pause */ }} title="Pausar">
            <Pause className="w-4 h-4" />
          </Button>
        </div>
      );
    },
  },
];
