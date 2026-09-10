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
  ArrowUpDown,
  RefreshCw,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  DollarSign,
  Boxes,
  Send
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
  bulkUpdateInventoryFromExcel,
  recalculateReplenishmentAction,
  getReplenishmentAIExplanationAction
} from "./actions";
import type { ReplenishmentSummary, FullReplenishmentRecommendation } from "@/services/inventory/replenishment/types";

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
    replenishmentSummary?: ReplenishmentSummary;
  }
}) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [activeTab, setActiveTab] = useState<"local" | "full">("local");
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [fullFilter, setFullFilter] = useState<"all" | "critical" | "high" | "ok" | "has_internal">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FULL Data
  const fullProducts = initialFullData?.fullProducts || [];
  const totalFullUnits = initialFullData?.totalFullUnits || 0;
  const fullPubsCount = initialFullData?.fullPublicationsCount || 0;
  const criticalFullCount = initialFullData?.criticalFullCount || 0;
  const replenishmentSummary = initialFullData?.replenishmentSummary;

  // State for AI Analysis Modal
  const [analyzingProduct, setAnalyzingProduct] = useState<any | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Filter & Sort FULL products (default sort: lowest coverageDays first)
  const filteredFullProducts = fullProducts
    .filter(p => {
      const titleMatch = p.title?.toLowerCase().includes(searchTerm.toLowerCase());
      const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const meliMatch = p.meli_item_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.publications?.some((pub: any) => pub.meli_item_id?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSearch = titleMatch || skuMatch || meliMatch;
      if (!matchesSearch) return false;

      const rec: FullReplenishmentRecommendation | undefined = p.replenishment;
      if (fullFilter === "all") return true;
      if (fullFilter === "critical") return rec?.priority === "critical";
      if (fullFilter === "high") return rec?.priority === "high";
      if (fullFilter === "ok") return rec?.priority === "ok" || rec?.priority === "medium";
      if (fullFilter === "has_internal") return (rec?.availableToSend ?? 0) > 0;
      return true;
    })
    .sort((a, b) => {
      const covA = a.replenishment?.coverageDays ?? 999999;
      const covB = b.replenishment?.coverageDays ?? 999999;
      return covA - covB;
    });

  const [isSyncingMeli, setIsSyncingMeli] = useState(false);

  const handleSyncMeli = async () => {
    setIsSyncingMeli(true);
    try {
      const res = await fetch("/api/meli/sync-products", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al sincronizar con Mercado Libre");
      }
      window.location.reload();
    } catch (err: any) {
      alert("Error al sincronizar: " + err.message);
    } finally {
      setIsSyncingMeli(false);
    }
  };

  const handleRecalculateReplenishment = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculateReplenishmentAction();
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error al recalcular reposición: " + err.message);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleOpenAnalysis = (product: any) => {
    setAnalyzingProduct(product);
  };

  const handleRequestAiExplanation = async () => {
    if (!analyzingProduct?.replenishment) return;
    setIsGeneratingAi(true);
    try {
      const res = await getReplenishmentAIExplanationAction(analyzingProduct.replenishment);
      if (res.success && res.explanation) {
        setAnalyzingProduct((prev: any) => ({
          ...prev,
          replenishment: {
            ...prev.replenishment,
            aiExplanation: res.explanation
          }
        }));
      }
    } catch (err: any) {
      console.error("AI Explanation error:", err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

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

    const totalStock = (item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0;
    const localStock = (item.local_stock !== undefined ? item.local_stock : item.current_stock) ?? 0;
    const fullStock = item.full_stock ?? 0;

    if (stockFilter === "all") return matchesSearch;
    if (stockFilter === "out") return matchesSearch && totalStock <= 0;
    if (stockFilter === "low") return matchesSearch && item.minimum_stock && totalStock < item.minimum_stock;
    if (stockFilter === "has_full") return matchesSearch && fullStock > 0;
    if (stockFilter === "out_local") return matchesSearch && localStock <= 0;
    return matchesSearch;
  });

  // Analytics
  const totalAssetsValue = items.reduce((acc, item) => {
    const stock = (item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0;
    return acc + ((item.average_cost || 0) * stock);
  }, 0);
  const totalLocalUnits = items.reduce((acc, item) => acc + ((item.local_stock !== undefined ? item.local_stock : item.current_stock) ?? 0), 0);
  const totalFullUnitsInLocal = items.reduce((acc, item) => acc + (item.full_stock ?? 0), 0);
  const outOfStockCount = items.filter(item => ((item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0) <= 0).length;
  const lowStockCount = items.filter(item => item.minimum_stock && ((item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0) < item.minimum_stock).length;

  // Actions
  const handleOpenAdjust = (item: any) => {
    setAdjustingItem(item);
    setAdjustStockVal(((item.local_stock !== undefined ? item.local_stock : item.current_stock) || 0).toString());
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
    const dataToExport = items.map(item => {
      const totalStock = (item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0;
      const localStock = (item.local_stock !== undefined ? item.local_stock : item.current_stock) ?? 0;
      const fullStock = item.full_stock ?? 0;
      const avgCost = item.average_cost || 0;

      return {
        "SKU": item.sku_normalized,
        "Nombre": item.name || "",
        "Categoria": item.category || "",
        "Stock Total": totalStock,
        "Stock Local (Taller)": localStock,
        "Stock Bodega FULL": fullStock,
        "Stock Minimo": item.minimum_stock || 0,
        "Costo Promedio": avgCost,
        "Valuacion Total": totalStock * avgCost
      };
    });

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
      label: "Valuación Total Inventario",
      value: `$${totalAssetsValue.toLocaleString("es-AR")}`,
      subtext: "Capital total en stock (Local + FULL)",
      icon: <Warehouse className="w-4 h-4" />
    },
    {
      label: "Stock Depósito Local",
      value: `${totalLocalUnits.toLocaleString("es-AR")} u.`,
      subtext: "Físico disponible en taller",
      icon: <Boxes className="w-4 h-4" />
    },
    {
      label: "Stock en Bodega FULL",
      value: `${totalFullUnitsInLocal.toLocaleString("es-AR")} u.`,
      subtext: "Custodiado en Mercado Libre",
      icon: <Package className="w-4 h-4" />,
      highlight: totalFullUnitsInLocal > 0 ? "positive" : "neutral"
    },
    {
      label: "Alertas de Stock",
      value: (outOfStockCount + lowStockCount).toString(),
      subtext: `${outOfStockCount} agotados • ${lowStockCount} bajo mínimo`,
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: outOfStockCount > 0 ? "critical" : lowStockCount > 0 ? "warning" : "neutral"
    }
  ];

  const fullMetrics: MetricItem[] = [
    {
      label: "Reposición Urgente (≤ 5d)",
      value: (replenishmentSummary?.criticalCount ?? criticalFullCount).toString(),
      subtext: `${replenishmentSummary?.highCount ?? 0} con prioridad alta`,
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: (replenishmentSummary?.criticalCount ?? criticalFullCount) > 0 ? "critical" : "neutral"
    },
    {
      label: "Unidades Sugeridas",
      value: (replenishmentSummary?.totalRecommendedUnits ?? 0).toLocaleString("es-AR"),
      subtext: `${(replenishmentSummary?.totalAvailableToSendUnits ?? 0).toLocaleString("es-AR")} u. disp. en depósito`,
      icon: <Boxes className="w-4 h-4" />,
      highlight: (replenishmentSummary?.totalRecommendedUnits ?? 0) > 0 ? "warning" : "neutral"
    },
    {
      label: "Capital Estimado",
      value: replenishmentSummary?.estimatedCapitalRequired 
        ? `$${replenishmentSummary.estimatedCapitalRequired.toLocaleString("es-AR")}`
        : "$0",
      subtext: (replenishmentSummary?.productsWithoutCostCount ?? 0) > 0
        ? `+ ${replenishmentSummary?.productsWithoutCostCount} productos sin costo`
        : "Para cubrir reposición sugerida",
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      label: "Stock Custodiado FULL",
      value: totalFullUnits.toLocaleString("es-AR"),
      subtext: `${fullPubsCount} productos físicos vinculados`,
      icon: <Warehouse className="w-4 h-4" />
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
            {activeTab === "full" && (
              <Button
                variant="outline"
                onClick={handleRecalculateReplenishment}
                disabled={isRecalculating || isProcessing}
                className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#102A56] shadow-sm"
                title="Recalcular recomendaciones de reposición para todo el inventario FULL"
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-[#102A56] ${isRecalculating ? "animate-spin" : ""}`} />
                {isRecalculating ? "Recalculando..." : "Recalcular Reposición"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleSyncMeli}
              disabled={isSyncingMeli || isProcessing}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
              title="Sincronizar stock y publicaciones con Mercado Libre"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 text-[#5F6875] ${isSyncingMeli ? "animate-spin text-[#102A56]" : ""}`} />
              {isSyncingMeli ? "Sincronizando..." : "Sincronizar Mercado Libre"}
            </Button>
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
        <MetricStrip metrics={fullMetrics} columns={4} />
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
                <option value="has_full">Con stock en Bodega FULL</option>
                <option value="out_local">Sin stock físico en taller</option>
                <option value="out">Sin stock total (Agotados)</option>
                <option value="low">Bajo stock mínimo</option>
              </select>
            </div>
          )}

          {activeTab === "full" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Filtro Reposición:</span>
              <select
                value={fullFilter}
                onChange={(e: any) => setFullFilter(e.target.value)}
                className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
              >
                <option value="all">Todos los productos</option>
                <option value="critical">🔴 Urgentes (≤ 5 días)</option>
                <option value="high">🟠 Reponer esta semana (≤ 10 días)</option>
                <option value="ok">🟢 Sin necesidad (Óptimos)</option>
                <option value="has_internal">Con stock disponible en depósito</option>
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
                <th className="px-3 py-3 font-semibold text-center">Stock Total</th>
                <th className="px-3 py-3 font-semibold text-center">Punto Reposición</th>
                <th className="px-3 py-3 font-semibold text-right">Costo Promedio</th>
                <th className="px-3 py-3 font-semibold text-right">Valuación Total</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredItems.map((item) => {
                const totalStock = (item.total_stock !== undefined ? item.total_stock : item.current_stock) ?? 0;
                const localStock = (item.local_stock !== undefined ? item.local_stock : item.current_stock) ?? 0;
                const fullStock = item.full_stock ?? 0;
                const isOut = totalStock <= 0;
                const isLow = item.minimum_stock && totalStock < item.minimum_stock;
                const valuation = totalStock * (item.average_cost || 0);

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
                      <div className="flex flex-col items-center justify-center">
                        <span
                          className={`font-bold tabular-nums text-sm ${isOut ? 'text-[#D92D20]' : isLow ? 'text-[#B54708]' : 'text-[#101828]'}`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {totalStock} u.
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-medium">
                          <span className="text-[#5F6875]" title="Stock físico en taller / depósito propio">
                            Local: <strong className={localStock <= 0 ? "text-[#D92D20]" : "text-[#101828]"}>{localStock}</strong>
                          </span>
                          <span className="text-[#DCDAD4]">•</span>
                          <span className="text-[#5F6875]" title="Stock en Bodega FULL de Mercado Libre">
                            FULL: <strong className={fullStock > 0 ? "text-[#027A48]" : "text-[#5F6875]"}>{fullStock}</strong>
                          </span>
                        </div>
                      </div>
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
                <th className="px-4 py-3 font-semibold">Producto</th>
                <th className="px-3 py-3 font-semibold text-center">Stock FULL</th>
                <th className="px-3 py-3 font-semibold text-center">Ventas 30d</th>
                <th className="px-3 py-3 font-semibold text-center">Ritmo</th>
                <th className="px-3 py-3 font-semibold text-center">Cobertura</th>
                <th className="px-3 py-3 font-semibold text-center">Reposición</th>
                <th className="px-3 py-3 font-semibold text-center">Prioridad</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredFullProducts.map((p) => {
                const stock = p.physicalStockInFull ?? p.available_quantity ?? 0;
                const meliId = p.meli_item_id || p.publications?.[0]?.meli_item_id || "—";
                const totalPubs = p.publications?.length || 1;
                const rec: FullReplenishmentRecommendation | undefined = p.replenishment;

                const sales30d = rec?.sales30d ?? 0;
                const forecastVelocity = rec?.forecastVelocity ?? 0;
                const coverageDays = rec?.coverageDays;
                const recommendedUnits = rec?.recommendedUnits ?? 0;
                const availableToSend = rec?.availableToSend;
                const priority = rec?.priority ?? (stock <= 5 ? "critical" : "ok");

                return (
                  <tr key={p.id} className="hover:bg-[#F5F3EE]/30 transition-colors">
                    {/* Producto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {p.thumbnail_url && (
                          <img
                            src={p.thumbnail_url}
                            alt=""
                            className="w-8 h-8 rounded object-cover border border-[#DCDAD4] shrink-0"
                          />
                        )}
                        <div className="min-w-0 max-w-[280px]">
                          <p className="font-semibold text-[#101828] truncate" title={p.title}>
                            {p.title}
                          </p>
                          <div className="flex items-center gap-1 font-mono text-[10px] text-[#5F6875] mt-0.5">
                            <span>{p.sku || "Sin SKU"}</span>
                            <span>•</span>
                            <span>{meliId}</span>
                            {totalPubs > 1 && (
                              <span
                                className="ml-1 text-[9px] text-[#5F6875] bg-[#F2F4F7] px-1 py-0.2 rounded font-sans"
                                title={`${totalPubs} publicaciones vinculadas al mismo stock físico`}
                              >
                                +{totalPubs - 1} pub.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Stock FULL */}
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`font-bold tabular-nums text-xs ${stock <= 5 ? 'text-[#D92D20]' : 'text-[#101828]'}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {stock} u.
                      </span>
                    </td>

                    {/* Ventas 30d */}
                    <td className="px-3 py-3 text-center font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {sales30d} u.
                    </td>

                    {/* Ritmo */}
                    <td className="px-3 py-3 text-center font-medium text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {forecastVelocity > 0 ? `${forecastVelocity.toFixed(2)}/día` : "0,00/día"}
                    </td>

                    {/* Cobertura */}
                    <td className="px-3 py-3 text-center">
                      {coverageDays !== null && coverageDays !== undefined ? (
                        <span
                          className={`font-bold tabular-nums text-xs ${
                            coverageDays <= 5 ? "text-[#D92D20]" : coverageDays <= 10 ? "text-[#B54708]" : "text-[#027A48]"
                          }`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {coverageDays <= 0 ? "Agotado" : `${Math.round(coverageDays)} días`}
                        </span>
                      ) : (
                        <span className="text-[#5F6875]">—</span>
                      )}
                    </td>

                    {/* Reposición */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-bold tabular-nums text-xs ${recommendedUnits > 0 ? "text-[#102A56]" : "text-[#5F6875]"}`}
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {recommendedUnits} u.
                        </span>
                        {availableToSend !== null && availableToSend !== undefined && (
                          <span className="text-[10px] text-[#5F6875] tabular-nums">
                            {availableToSend >= recommendedUnits ? (
                              <span className="text-[#027A48]">Disp: {availableToSend} u.</span>
                            ) : (
                              <span className="text-[#B54708]">Enviar máx: {availableToSend} u.</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Prioridad */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <StatusBadge
                        variant={
                          priority === "critical"
                            ? "critical"
                            : priority === "high"
                            ? "warning"
                            : priority === "medium"
                            ? "info"
                            : "success"
                        }
                      >
                        {priority === "critical"
                          ? "Crítica"
                          : priority === "high"
                          ? "Alta"
                          : priority === "medium"
                          ? "Media"
                          : "Óptimo"}
                      </StatusBadge>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAnalysis(p)}
                        className="h-7 px-2.5 text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE]"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-[#102A56]" />
                        Ver análisis
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      )}

      {/* Modal: Análisis de Reposición Inteligente FULL */}
      <Dialog open={!!analyzingProduct} onOpenChange={(open) => !open && setAnalyzingProduct(null)}>
        <DialogContent className="sm:max-w-xl bg-white border border-[#DCDAD4] shadow-xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-[#E2E8F0] bg-[#FCFCFA]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#102A56]" />
              <DialogTitle className="text-base font-bold text-[#101828]">
                Análisis de Reposición FULL
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[#5F6875]">
              {analyzingProduct?.title} • <span className="font-mono">{analyzingProduct?.sku || "Sin SKU"}</span>
            </DialogDescription>
          </DialogHeader>

          {analyzingProduct?.replenishment && (() => {
            const rec: FullReplenishmentRecommendation = analyzingProduct.replenishment;
            const trend = rec.trendPercent;
            const accountTrend = rec.accountTrendPercent;

            return (
              <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Métricas clave en grilla */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E2E8F0] text-center">
                    <span className="text-[11px] font-semibold text-[#5F6875] uppercase block">Stock FULL</span>
                    <span className="text-lg font-bold text-[#101828] tabular-nums mt-0.5 block">{rec.fullStock} u.</span>
                    <span className="text-[10px] text-[#5F6875] block mt-0.5">En custodia MeLi</span>
                  </div>

                  <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E2E8F0] text-center">
                    <span className="text-[11px] font-semibold text-[#5F6875] uppercase block">Cobertura Actual</span>
                    <span className={`text-lg font-bold tabular-nums mt-0.5 block ${
                      (rec.coverageDays ?? 0) <= 5 ? "text-[#D92D20]" : (rec.coverageDays ?? 0) <= 10 ? "text-[#B54708]" : "text-[#027A48]"
                    }`}>
                      {rec.coverageDays !== null ? `${Math.round(rec.coverageDays)} días` : "—"}
                    </span>
                    <span className="text-[10px] text-[#5F6875] block mt-0.5">
                      {rec.coverageDays !== null && rec.coverageDays <= 5 ? "🔴 Urgente" : "Ritmo actual"}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F8F9FA] rounded-lg border border-[#E2E8F0] text-center">
                    <span className="text-[11px] font-semibold text-[#5F6875] uppercase block">Sugerido Reponer</span>
                    <span className="text-lg font-bold text-[#102A56] tabular-nums mt-0.5 block">{rec.recommendedUnits} u.</span>
                    <span className="text-[10px] text-[#5F6875] block mt-0.5">
                      {rec.availableToSend !== null ? `${rec.availableToSend} u. en depósito` : "Sin stock local"}
                    </span>
                  </div>
                </div>

                {/* Desglose de Ventas y Tendencia */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#101828]">Historial de Ventas</span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#5F6875]">Tendencia producto:</span>
                      <span className={`font-bold ${trend && trend > 0 ? "text-[#027A48]" : trend && trend < 0 ? "text-[#D92D20]" : "text-[#5F6875]"}`}>
                        {trend !== null ? `${trend > 0 ? "+" : ""}${trend}%` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 bg-[#F8F9FA] rounded">
                      <span className="text-[10px] text-[#5F6875] block">7 días</span>
                      <span className="font-bold text-[#101828] tabular-nums">{rec.sales7d} u.</span>
                    </div>
                    <div className="p-2 bg-[#F8F9FA] rounded">
                      <span className="text-[10px] text-[#5F6875] block">14 días</span>
                      <span className="font-bold text-[#101828] tabular-nums">{rec.sales14d} u.</span>
                    </div>
                    <div className="p-2 bg-[#F8F9FA] rounded">
                      <span className="text-[10px] text-[#5F6875] block">30 días</span>
                      <span className="font-bold text-[#101828] tabular-nums">{rec.sales30d} u.</span>
                    </div>
                    <div className="p-2 bg-[#F8F9FA] rounded">
                      <span className="text-[10px] text-[#5F6875] block">Ritmo Forecast</span>
                      <span className="font-bold text-[#102A56] tabular-nums">{rec.forecastVelocity.toFixed(2)} u/d</span>
                    </div>
                  </div>

                  {accountTrend !== null && accountTrend !== undefined && (
                    <p className="text-[11px] text-[#5F6875] pt-1 border-t border-[#F2F4F7]">
                      Evolución general de la cuenta: <strong className="text-[#101828]">{accountTrend > 0 ? `+${accountTrend}%` : `${accountTrend}%`}</strong> en últimos 30 días.
                    </p>
                  )}
                </div>

                {/* Parámetros de Cobertura y Depósito */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-[#FAFAF8] space-y-2 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#101828] block">Cálculo de Inventario Objetivo</span>
                  <div className="grid grid-cols-2 gap-y-1 text-[#5F6875]">
                    <div>Objetivo FULL: <strong className="text-[#101828]">{rec.targetCoverageDays} días</strong></div>
                    <div>Stock de seguridad: <strong className="text-[#101828]">{rec.safetyDays} días</strong></div>
                    <div>Stock en depósito local: <strong className="text-[#101828]">{rec.internalStock !== null ? `${rec.internalStock} u.` : "No cargado"}</strong></div>
                    <div>Disponible para enviar: <strong className="text-[#102A56]">{rec.availableToSend !== null ? `${rec.availableToSend} u.` : "—"}</strong></div>
                  </div>
                </div>

                {/* Análisis LibretaX IA */}
                <div className="p-4 rounded-lg border border-[#DCDAD4] bg-[#F9F9FB] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#102A56]" />
                      <span className="text-xs font-bold text-[#102A56]">Análisis LibretaX IA</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRequestAiExplanation}
                      disabled={isGeneratingAi}
                      className="h-6 px-2 text-[10px] text-[#5F6875] hover:text-[#101828]"
                      title="Regenerar análisis con IA"
                    >
                      <RefreshCw className={`w-3 h-3 mr-1 ${isGeneratingAi ? "animate-spin" : ""}`} />
                      {isGeneratingAi ? "Generando..." : "Actualizar IA"}
                    </Button>
                  </div>

                  <div className="text-xs text-[#344054] leading-relaxed space-y-1.5">
                    {typeof rec.aiExplanation === "string" ? (
                      <p>{rec.aiExplanation}</p>
                    ) : rec.aiExplanation ? (
                      <>
                        <p className="font-medium text-[#101828]">
                          {rec.aiExplanation.recommendationExplanation}
                        </p>
                        {rec.aiExplanation.priorityExplanation && (
                          <p className="text-[#5F6875]">
                            {rec.aiExplanation.priorityExplanation}
                          </p>
                        )}
                        {rec.aiExplanation.riskSummary && (
                          <p className="text-[#B54708] text-[11px] font-medium">
                            ⚠️ {rec.aiExplanation.riskSummary}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>Análisis en base a las ventas recientes y ritmo de demanda.</p>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-[#8C93A0] italic">
                  La recomendación es una estimación basada en ventas históricas, stock y tendencias recientes. La decisión final de envío es humana.
                </p>
              </div>
            );
          })()}

          <DialogFooter className="p-4 border-t border-[#E2E8F0] bg-[#FCFCFA]">
            <Button
              variant="outline"
              onClick={() => setAnalyzingProduct(null)}
              className="text-xs font-medium border-[#DCDAD4]"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Ajustar Stock */}
      <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
        <DialogContent className="sm:max-w-md bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Ajuste físico de stock local — {adjustingItem?.sku_normalized}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Modificá la cantidad física en depósito local/taller. En Bodega FULL hay {adjustingItem?.full_stock ?? 0} u. en custodia de MeLi.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new_stock" className="text-xs font-semibold text-[#101828]">
                Cantidad física en taller / depósito propio
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
