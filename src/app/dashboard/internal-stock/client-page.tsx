"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Package,
  Warehouse,
  Download,
  Upload,
  AlertTriangle,
  Clock,
  Edit3,
  History,
  Trash2,
  Layers,
  ShieldAlert,
  ArrowUpDown
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalToolbar } from "@/components/operational/toolbar";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import {
  adjustInventoryStock,
  updateInventoryItemParams,
  getInventoryMovements,
  deleteInventoryItem,
  bulkUpdateInventoryFromExcel
} from "./actions";

export function InternalStockClient({
  initialItems,
  initialFullData
}: {
  initialItems: any[],
  initialFullData?: {
    fullProducts: any[];
    totalFullUnits: number;
    fullPublicationsCount: number;
    criticalFullCount: number;
  }
}) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [activeTab, setActiveTab] = useState<"local" | "full">("local");
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FULL Data
  const fullProducts = initialFullData?.fullProducts || [];
  const totalFullUnits = initialFullData?.totalFullUnits || 0;
  const fullPubsCount = initialFullData?.fullPublicationsCount || 0;
  const criticalFullCount = initialFullData?.criticalFullCount || 0;

  // Filter FULL products
  const filteredFullProducts = fullProducts.filter(p => {
    const titleMatch = p.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const meliMatch = p.meli_item_id?.toLowerCase().includes(searchTerm.toLowerCase());
    return titleMatch || skuMatch || meliMatch;
  });

  // Modals state
  const [adjustingItem, setAdjustingItem] = useState<any | null>(null);
  const [adjustStockVal, setAdjustStockVal] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editMinStock, setEditMinStock] = useState("");

  const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);
  const [historyMovements, setHistoryMovements] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  // Filters
  const filteredItems = items.filter(item => {
    const nameMatch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = item.sku_normalized.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || skuMatch;

    if (stockFilter === "all") return matchesSearch;
    if (stockFilter === "out") return matchesSearch && (item.current_stock || 0) === 0;
    if (stockFilter === "low") return matchesSearch && item.minimum_stock && (item.current_stock || 0) < item.minimum_stock;
    return matchesSearch;
  });

  // Analytics
  const totalAssetsValue = items.reduce((acc, item) => acc + ((item.average_cost || 0) * (item.current_stock || 0)), 0);
  const outOfStockCount = items.filter(item => (item.current_stock || 0) === 0).length;
  const lowStockCount = items.filter(item => item.minimum_stock && (item.current_stock || 0) < item.minimum_stock).length;

  // Actions
  const handleOpenAdjust = (item: any) => {
    setAdjustingItem(item);
    setAdjustStockVal((item.current_stock || 0).toString());
    setAdjustNotes("Ajuste manual de inventario");
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    setIsProcessing(true);
    try {
      const res = await adjustInventoryStock(
        adjustingItem.id,
        parseInt(adjustStockVal) || 0,
        adjustNotes
      );
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error ajustando stock: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditName(item.name || "");
    setEditCategory(item.category || "");
    setEditCost((item.average_cost || "").toString());
    setEditMinStock((item.minimum_stock || "").toString());
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsProcessing(true);
    try {
      const res = await updateInventoryItemParams(editingItem.id, {
        name: editName.trim() || undefined,
        category: editCategory.trim() || undefined,
        average_cost: editCost ? parseFloat(editCost) : undefined,
        minimum_stock: editMinStock ? parseInt(editMinStock) : undefined
      });
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error actualizando componente: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteItem = async (item: any) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el componente ${item.sku_normalized}? Esta acción es permanente y borrará también su historial de movimientos.`)) {
      return;
    }
    setIsProcessing(true);
    try {
      const res = await deleteInventoryItem(item.id);
      if (res.success) {
        setItems(prev => prev.filter(i => i.id !== item.id));
        alert("Componente eliminado correctamente.");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenHistory = async (item: any) => {
    setViewingHistoryItem(item);
    setIsLoadingHistory(true);
    setHistoryMovements([]);
    try {
      const movs = await getInventoryMovements(item.id);
      setHistoryMovements(movs);
    } catch (e: any) {
      alert("Error cargando historial: " + e.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = items.map(item => ({
      "SKU": item.sku_normalized,
      "Nombre": item.name || "",
      "Categoria": item.category || "",
      "Stock Actual": item.current_stock,
      "Stock Minimo": item.minimum_stock || 0,
      "Costo Promedio": item.average_cost || 0,
      "Valuacion": (item.current_stock || 0) * (item.average_cost || 0)
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario Deposito");
    XLSX.writeFile(wb, `Inventario_Deposito_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "buffer" });
      const wsName = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wsName]);

      const itemsToUpdate = data.map(row => ({
        sku: String(row["SKU"] || row["sku"] || "").trim(),
        name: row["Nombre"] || row["nombre"] || undefined,
        current_stock: row["Stock Actual"] !== undefined ? parseInt(row["Stock Actual"]) : undefined,
        minimum_stock: row["Stock Minimo"] !== undefined ? parseInt(row["Stock Minimo"]) : undefined,
        average_cost: row["Costo Promedio"] !== undefined ? parseFloat(row["Costo Promedio"]) : undefined,
      })).filter(r => Boolean(r.sku));

      if (itemsToUpdate.length === 0) {
        alert("No se encontraron registros válidos con columna SKU.");
        setIsProcessing(false);
        return;
      }

      const res = await bulkUpdateInventoryFromExcel(itemsToUpdate);
      alert(`Actualización completada: ${res.updatedCount} actualizados, ${res.skippedCount} omitidos.`);
      window.location.reload();
    } catch (err: any) {
      alert("Error importando Excel: " + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const localMetrics: MetricItem[] = [
    {
      label: "Valuación de Activos",
      value: `$${totalAssetsValue.toLocaleString("es-AR")}`,
      subtext: "Capital inmovilizado en depósito",
      icon: <Warehouse className="w-4 h-4" />
    },
    {
      label: "Stock Agotado",
      value: outOfStockCount.toString(),
      subtext: "Componentes en quiebre total",
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: outOfStockCount > 0 ? "critical" : "neutral"
    },
    {
      label: "Bajo Punto Reposición",
      value: lowStockCount.toString(),
      subtext: "Por debajo del stock mínimo",
      icon: <ShieldAlert className="w-4 h-4" />,
      highlight: lowStockCount > 0 ? "warning" : "neutral"
    },
    {
      label: "Componentes Registrados",
      value: items.length.toString(),
      subtext: "SKUs únicos en depósito local",
      icon: <Layers className="w-4 h-4" />
    }
  ];

  const fullMetrics: MetricItem[] = [
    {
      label: "Unidades en FULL",
      value: totalFullUnits.toLocaleString("es-AR"),
      subtext: "Stock custodiado por Mercado Libre",
      icon: <Warehouse className="w-4 h-4" />
    },
    {
      label: "Publicaciones FULL",
      value: fullPubsCount.toString(),
      subtext: "Publicaciones activas con despacho FULL",
      icon: <Package className="w-4 h-4" />
    },
    {
      label: "Stock Crítico (≤ 5 u.)",
      value: criticalFullCount.toString(),
      subtext: "Riesgo de pausa por falta de inventario",
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: criticalFullCount > 0 ? "warning" : "neutral"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Inventario y depósito"
        title="Stock interno y bodega FULL"
        description="Gestión de existencias físicas en depósito propio, alertas de reposición y stock almacenado en la bodega de Mercado Envíos FULL."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-[#5F6875]" />
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 text-[#5F6875]" />
              Importar Excel
            </Button>
          </div>
        }
      />

      {/* Selector de Pestañas Operativo */}
      <div className="flex items-center gap-2 border-b border-[#DCDAD4] pb-2">
        <button
          onClick={() => setActiveTab("local")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
            activeTab === "local"
              ? "bg-[#102A56] text-white shadow-sm"
              : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          <span>Depósito Local ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("full")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
            activeTab === "full"
              ? "bg-[#102A56] text-white shadow-sm"
              : "text-[#5F6875] hover:text-[#101828] hover:bg-[#F5F3EE]"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Bodega FULL ({fullPubsCount})</span>
        </button>
      </div>

      {/* Franja de Indicadores según Pestaña */}
      {activeTab === "local" ? (
        <MetricStrip metrics={localMetrics} columns={4} />
      ) : (
        <MetricStrip metrics={fullMetrics} columns={3} />
      )}

      {/* Barra de Filtros Operativos */}
      <OperationalToolbar>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {activeTab === "local" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Filtro de stock:</span>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
              >
                <option value="all">Todos los componentes</option>
                <option value="out">Sin stock (Agotados)</option>
                <option value="low">Bajo stock mínimo</option>
              </select>
            </div>
          )}
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="text"
            placeholder="Buscar por SKU o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs bg-white border-[#DCDAD4] focus-visible:ring-[#102A56]"
          />
        </div>
      </OperationalToolbar>

      {/* Tab: Depósito Local */}
      {activeTab === "local" && (
        <DataTableShell
          isEmpty={filteredItems.length === 0}
          emptyState={
            <OperationalEmptyState
              icon={Warehouse}
              title="No hay componentes registrados"
              description="Podés crear componentes importando un archivo Excel o registrando compras en el módulo correspondiente."
            />
          }
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
              <tr>
                <th className="px-4 py-3 font-semibold">SKU / Identificador</th>
                <th className="px-3 py-3 font-semibold">Nombre del Componente</th>
                <th className="px-3 py-3 font-semibold text-center">Stock Disponible</th>
                <th className="px-3 py-3 font-semibold text-center">Punto Reposición</th>
                <th className="px-3 py-3 font-semibold text-right">Costo Promedio</th>
                <th className="px-3 py-3 font-semibold text-right">Valuación Total</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredItems.map((item) => {
                const isOut = (item.current_stock || 0) === 0;
                const isLow = item.minimum_stock && (item.current_stock || 0) < item.minimum_stock;
                const valuation = (item.current_stock || 0) * (item.average_cost || 0);

                return (
                  <tr key={item.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-[#101828] font-mono whitespace-nowrap">
                      {item.sku_normalized}
                    </td>

                    <td className="px-3 py-3 text-[#101828]">
                      <div className="space-y-0.5 max-w-[240px]">
                        <p className="font-semibold text-[#101828] truncate" title={item.name || "Sin nombre"}>
                          {item.name || "Sin nombre"}
                        </p>
                        {item.category && (
                          <span className="text-[10px] text-[#5F6875] uppercase tracking-wider block">
                            {item.category}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold tabular-nums text-sm ${isOut ? 'text-[#D92D20]' : isLow ? 'text-[#B54708]' : 'text-[#101828]'}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {item.current_stock ?? 0}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {item.minimum_stock !== null && item.minimum_stock !== undefined ? (
                        <span className="font-medium">{item.minimum_stock} u.</span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-3 py-3 text-right font-medium text-[#101828] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${Number(item.average_cost || 0).toLocaleString("es-AR")}
                    </td>

                    <td className="px-3 py-3 text-right font-bold text-[#101828] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${valuation.toLocaleString("es-AR")}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAdjust(item)}
                          className="h-7 px-2 text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE]"
                          title="Ajustar stock físico"
                        >
                          <ArrowUpDown className="w-3 h-3 mr-1 text-[#5F6875]" />
                          Ajustar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenHistory(item)}
                          className="h-7 w-7 p-0 text-[#5F6875] hover:text-[#101828]"
                          title="Historial de movimientos"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(item)}
                          className="h-7 w-7 p-0 text-[#5F6875] hover:text-[#101828]"
                          title="Editar parámetros"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteItem(item)}
                          className="h-7 w-7 p-0 text-[#D92D20] hover:bg-[#FEF3F2]"
                          title="Eliminar componente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}

      {/* Tab: Bodega FULL */}
      {activeTab === "full" && (
        <DataTableShell
          isEmpty={filteredFullProducts.length === 0}
          emptyState={
            <OperationalEmptyState
              icon={Package}
              title="No hay publicaciones en FULL"
              description="No encontramos publicaciones con modalidad de envío fulfillment registradas en tu catálogo."
            />
          }
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
              <tr>
                <th className="px-4 py-3 font-semibold">Publicación</th>
                <th className="px-3 py-3 font-semibold">SKU / ID</th>
                <th className="px-3 py-3 font-semibold text-center">Unidades en Bodega FULL</th>
                <th className="px-3 py-3 font-semibold text-center">Estado Logístico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredFullProducts.map((p) => {
                const isCritical = (p.available_quantity || 0) <= 5;

                return (
                  <tr key={p.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {p.thumbnail_url && (
                          <img
                            src={p.thumbnail_url}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-[#DCDAD4] shrink-0"
                          />
                        )}
                        <p className="font-semibold text-[#101828] truncate max-w-[320px]" title={p.title}>
                          {p.title}
                        </p>
                      </div>
                    </td>

                    <td className="px-3 py-3 font-mono text-[11px] text-[#5F6875]">
                      <span>{p.sku || "Sin SKU"}</span>
                      <span className="mx-1">•</span>
                      <span>{p.meli_item_id}</span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold tabular-nums text-sm ${isCritical ? 'text-[#D92D20]' : 'text-[#101828]'}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {p.available_quantity ?? 0} u.
                      </span>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <StatusBadge variant={isCritical ? 'warning' : 'success'}>
                        {isCritical ? 'Stock Crítico' : 'Stock Óptimo'}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}

      {/* Modal: Ajustar Stock */}
      <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Ajuste físico de stock — {adjustingItem?.sku_normalized}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Modificá la cantidad física disponible en depósito. Se registrará un movimiento de auditoría.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new_stock" className="text-xs font-semibold text-[#101828]">
                Cantidad física actual
              </Label>
              <Input
                id="new_stock"
                type="number"
                min="0"
                value={adjustStockVal}
                onChange={(e) => setAdjustStockVal(e.target.value)}
                required
                className="h-9 text-xs border-[#DCDAD4] focus-visible:ring-[#102A56]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust_notes" className="text-xs font-semibold text-[#101828]">
                Motivo / Observación
              </Label>
              <Input
                id="adjust_notes"
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="h-9 text-xs border-[#DCDAD4] focus-visible:ring-[#102A56]"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustingItem(null)}
                className="h-8 text-xs border-[#DCDAD4]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
                className="h-8 text-xs bg-[#102A56] hover:bg-[#102A56]/90 text-white"
              >
                Guardar Ajuste
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Parámetros */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Editar componente — {editingItem?.sku_normalized}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Actualizá nombre, categoría, punto de reposición o costo promedio.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="edit_name" className="text-xs font-semibold text-[#101828]">Nombre</Label>
              <Input
                id="edit_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-xs border-[#DCDAD4]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_cat" className="text-xs font-semibold text-[#101828]">Categoría</Label>
              <Input
                id="edit_cat"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="h-8 text-xs border-[#DCDAD4]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit_cost" className="text-xs font-semibold text-[#101828]">Costo promedio ($)</Label>
                <Input
                  id="edit_cost"
                  type="number"
                  step="0.01"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                  className="h-8 text-xs border-[#DCDAD4]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit_min" className="text-xs font-semibold text-[#101828]">Stock mínimo</Label>
                <Input
                  id="edit_min"
                  type="number"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                  className="h-8 text-xs border-[#DCDAD4]"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingItem(null)}
                className="h-8 text-xs border-[#DCDAD4]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
                className="h-8 text-xs bg-[#102A56] hover:bg-[#102A56]/90 text-white"
              >
                Actualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial de Movimientos */}
      <Dialog open={!!viewingHistoryItem} onOpenChange={(open) => !open && setViewingHistoryItem(null)}>
        <DialogContent className="sm:max-w-2xl bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Historial de movimientos — {viewingHistoryItem?.sku_normalized}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Auditoría de ingresos por compra, egresos por ventas y ajustes manuales.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[350px] overflow-y-auto border border-[#DCDAD4] rounded-md">
            {isLoadingHistory ? (
              <p className="p-6 text-center text-xs text-[#5F6875]">Cargando movimientos...</p>
            ) : historyMovements.length === 0 ? (
              <p className="p-6 text-center text-xs text-[#5F6875]">No se registran movimientos para este componente.</p>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold text-right">Variación</th>
                    <th className="px-3 py-2 font-semibold text-right">Stock Final</th>
                    <th className="px-3 py-2 font-semibold">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {historyMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#F5F3EE]/30">
                      <td className="px-3 py-2 text-[#5F6875]">
                        {new Date(m.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 capitalize font-medium text-[#101828]">
                        {m.movement_type}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold tabular-nums ${m.quantity_change >= 0 ? 'text-[#198754]' : 'text-[#D92D20]'}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {m.quantity_change >= 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {m.final_stock}
                      </td>
                      <td className="px-3 py-2 text-[#5F6875] truncate max-w-[180px]" title={m.notes || ""}>
                        {m.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
