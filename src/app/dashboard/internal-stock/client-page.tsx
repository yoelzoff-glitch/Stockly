// src/app/dashboard/internal-stock/client-page.tsx
"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Hammer, Edit3, BarChart, History, Download, Upload, RefreshCw, Layers, ArrowUpDown, ShieldAlert, BadgeInfo, Trash2 } from "lucide-react";
import { adjustInventoryStock, updateInventoryItemParams, getInventoryMovements, deleteInventoryItem, bulkUpdateInventoryFromExcel } from "./actions";

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
    } catch (err: any) {
      console.error("Error fetching movements:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    const data = items.map(item => ({
      SKU: item.sku_normalized,
      Nombre: item.name || "Sin nombre",
      Categoría: item.category || "General",
      "Stock Depósito": item.current_stock || 0,
      "Costo Promedio": item.average_cost || 0,
      "Último Costo Compra": item.last_purchase_cost || 0,
      "Stock Mínimo": item.minimum_stock || 0
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario Depósito");
    XLSX.writeFile(workbook, "inventario_deposito.xlsx");
  };

  // Excel Import
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        if (rawData.length === 0) {
          alert("El archivo Excel está vacío.");
          setIsProcessing(false);
          return;
        }

        const updates: Array<{
          sku: string;
          name?: string;
          category?: string;
          current_stock?: number;
          average_cost?: number;
          last_purchase_cost?: number;
          minimum_stock?: number;
        }> = [];

        rawData.forEach((row: any) => {
          const sku = row.SKU || row.sku || row.Sku;
          if (!sku) return;

          const name = row.Nombre || row.nombre || row.Name;
          const category = row.Categoría || row.categoria || row.Category;
          const stockVal = row["Stock Depósito"] ?? row["Stock Deposito"] ?? row["stock_deposito"] ?? row.Stock ?? row.stock;
          const costVal = row["Costo Promedio"] ?? row["costo_promedio"] ?? row.Costo ?? row.cost;
          const lastCostVal = row["Último Costo Compra"] ?? row["Ultimo Costo Compra"] ?? row["ultimo_costo_compra"] ?? row.UltimoCosto ?? row.last_cost;
          const minStockVal = row["Stock Mínimo"] ?? row["Stock Minimo"] ?? row["stock_minimo"] ?? row.MinStock ?? row.min_stock;

          updates.push({
            sku: String(sku),
            name: name !== undefined ? String(name) : undefined,
            category: category !== undefined ? String(category) : undefined,
            current_stock: stockVal !== undefined && !isNaN(Number(stockVal)) ? Number(stockVal) : undefined,
            average_cost: costVal !== undefined && !isNaN(Number(costVal)) ? Number(costVal) : undefined,
            last_purchase_cost: lastCostVal !== undefined && !isNaN(Number(lastCostVal)) ? Number(lastCostVal) : undefined,
            minimum_stock: minStockVal !== undefined && !isNaN(Number(minStockVal)) ? Number(minStockVal) : undefined,
          });
        });

        if (updates.length === 0) {
          alert("No se encontraron registros válidos con la columna SKU.");
          setIsProcessing(false);
          return;
        }

        const res = await bulkUpdateInventoryFromExcel(updates);
        if (res.success) {
          alert(`Importación exitosa. Se actualizaron ${res.updatedCount} componentes. Omitidos: ${res.skippedCount}.`);
          window.location.reload();
        }
      } catch (err: any) {
        alert("Error procesando archivo Excel: " + err.message);
      } finally {
        setIsProcessing(false);
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportExcel} 
        accept=".xlsx, .xls" 
        className="hidden" 
      />
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Stock Interno</h2>
          <p className="text-sm text-muted-foreground">
            Monitorea insumos físicos en el depósito real, controla puntos de reorden y costos promedio.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            variant="outline" 
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={isProcessing}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
          <Button onClick={handleExportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-2">
        <button
          onClick={() => setActiveTab("local")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "local"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📦 Depósito Propio (Local)
        </button>
        <button
          onClick={() => setActiveTab("full")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "full"
              ? "bg-amber-400 text-slate-950 shadow-sm font-bold"
              : "text-slate-600 hover:bg-amber-50"
          }`}
        >
          ⚡ Bodega FULL Mercado Libre
          <span className="ml-1 bg-slate-900 text-amber-300 text-xs px-2 py-0.5 rounded-full font-bold">
            {totalFullUnits} un.
          </span>
        </button>
      </div>

      {activeTab === "full" ? (
        <div className="space-y-4">
          {/* Analytics FULL */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border-amber-200/60 dark:border-amber-900/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock en Bodega FULL</CardTitle>
                <Badge className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold px-2 py-0.5">⚡ FULL</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalFullUnits} <span className="text-xs font-normal text-muted-foreground">unidades</span></div>
                <p className="text-xs text-muted-foreground mt-1">
                  En los centros de distribución de Mercado Libre
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Productos Únicos FULL</CardTitle>
                <Layers className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fullPubsCount} <span className="text-xs font-normal text-muted-foreground">productos</span></div>
                <p className="text-xs text-muted-foreground mt-1">
                  Agrupados por SKU (sin duplicar por cuotas/clasica)
                </p>
              </CardContent>
            </Card>

            <Card className={criticalFullCount > 0 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stock Crítico FULL</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${criticalFullCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                  {criticalFullCount} <span className="text-xs font-normal text-muted-foreground">productos</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Con 5 o menos unidades físicas en ML
                </p>
              </CardContent>
            </Card>
          </div>

          {/* FULL Products Table */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>Inventario Físico en Bodega FULL (Mercado Libre)</span>
                  <Badge className="bg-amber-400 text-slate-950 font-extrabold text-xs">⚡ FULL</Badge>
                </CardTitle>
                <CardDescription>
                  Unidades físicas reales por SKU almacenadas en los centros de distribución de Mercado Libre.
                </CardDescription>
              </div>
              <div className="w-full sm:w-auto">
                <Input
                  placeholder="Buscar por título o SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredFullProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  {fullProducts.length === 0 
                    ? "No tienes productos activos en la Bodega FULL de Mercado Libre."
                    : "No se encontraron resultados que coincidan con la búsqueda."}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b bg-slate-50 font-medium text-slate-600">
                      <tr>
                        <th className="h-10 px-4 align-middle">Producto / Joya</th>
                        <th className="h-10 px-4 align-middle">SKU</th>
                        <th className="h-10 px-4 align-middle text-center">Publicaciones ML</th>
                        <th className="h-10 px-4 align-middle text-center">Stock Físico Único FULL</th>
                        <th className="h-10 px-4 align-middle text-right">Total Vendidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFullProducts.map((group: any) => {
                        const stockQty = group.physicalStockInFull || 0;
                        const isLowStock = stockQty <= 5;
                        const pubCount = group.publications?.length || 1;

                        return (
                          <tr key={group.sku || group.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-4 align-middle font-medium min-w-[280px]">
                              <div className="flex items-center gap-3">
                                {group.thumbnail_url && (
                                  <img src={group.thumbnail_url} alt="" className="w-10 h-10 rounded-md object-cover border" />
                                )}
                                <span className="line-clamp-2">{group.title}</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle">
                              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded text-xs">
                                {group.sku || "Sin SKU"}
                              </span>
                            </td>
                            <td className="p-4 align-middle text-center">
                              <Badge variant="outline" className="text-xs bg-slate-50 border-slate-300 text-slate-700">
                                {pubCount} {pubCount === 1 ? "publicación" : "publicaciones vinculadas"}
                              </Badge>
                            </td>
                            <td className="p-4 align-middle text-center">
                              <span className={`inline-flex items-center gap-1 font-bold px-3.5 py-1 rounded-full text-xs ${
                                isLowStock 
                                  ? "bg-red-100 text-red-700 border border-red-200" 
                                  : "bg-amber-100 text-amber-900 border border-amber-200"
                              }`}>
                                {stockQty} unidades
                                {isLowStock && " ⚠️"}
                              </span>
                            </td>
                            <td className="p-4 align-middle text-right font-medium text-slate-700">
                              {group.totalSold || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Analytics Local */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total de Activos</CardTitle>
                <Layers className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalAssetsValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Suma del stock real x costo promedio</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Componentes Faltantes</CardTitle>
                <ShieldAlert className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{outOfStockCount} items</div>
                <p className="text-xs text-muted-foreground mt-1">Con stock igual a 0</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bajo Stock Mínimo</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockCount} items</div>
                <p className="text-xs text-muted-foreground mt-1">Requieren reposición a proveedores</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Main Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Catálogo de Depósito</CardTitle>
            <CardDescription>Visualiza tu inventario físico, edita costos y ajusta cantidades.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por SKU, nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-[250px]"
            />
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="rounded-md border border-slate-200 text-xs px-2 bg-white"
            >
              <option value="all">Ver Todos</option>
              <option value="out">Sin Stock (0)</option>
              <option value="low">Bajo Stock Mínimo</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No se encontraron componentes en inventario.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="p-3">SKU Componente</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 text-right">Stock Físico</th>
                    <th className="p-3 text-right">Costo Promedio</th>
                    <th className="p-3 text-right">Último Costo Compra</th>
                    <th className="p-3 text-right">Stock Mínimo</th>
                    <th className="p-3 text-right">Ventas / 30d</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isOutOfStock = (item.current_stock || 0) === 0;
                    const isLowStock = item.minimum_stock && (item.current_stock || 0) < item.minimum_stock;
                    const needsRestock = item.recommended_restock > 0;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-blue-600">{item.sku_normalized}</td>
                        <td className="p-3 font-medium text-slate-800">{item.name || "Sin nombre"}</td>
                        <td className="p-3 text-muted-foreground">{item.category || "General"}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{item.current_stock || 0}</td>
                        <td className="p-3 text-right font-medium text-slate-700">${Number(item.average_cost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-muted-foreground">${Number(item.last_purchase_cost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-muted-foreground">{item.minimum_stock || "-"}</td>
                        <td className="p-3 text-right font-semibold text-slate-700">{item.sales_last_30_days || 0}</td>
                        <td className="p-3 text-center">
                          {needsRestock ? (
                             <div className="flex flex-col items-center gap-1">
                               {isOutOfStock && <Badge variant="destructive">Sin Stock</Badge>}
                               <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                 🛒 Comprar {item.recommended_restock} un.
                               </Badge>
                             </div>
                          ) : isOutOfStock ? (
                            <Badge variant="destructive">Sin Stock</Badge>
                          ) : isLowStock ? (
                             <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Bajo Mínimo</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-150 text-green-700">Óptimo</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <Button variant="outline" size="sm" className="text-[10px] px-2 py-0.5 h-7" onClick={() => handleOpenAdjust(item)}>
                            <Hammer className="w-3.5 h-3.5 mr-1 inline" /> Ajustar Stock
                          </Button>
                          <Button variant="outline" size="sm" className="text-[10px] px-2 py-0.5 h-7" onClick={() => handleOpenEdit(item)}>
                            <Edit3 className="w-3.5 h-3.5 mr-1 inline" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] px-2 py-0.5 h-7 text-indigo-600 hover:text-indigo-850 hover:bg-indigo-50" onClick={() => handleOpenHistory(item)}>
                            <History className="w-3.5 h-3.5 mr-1 inline" /> Kardex
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] px-2 py-0.5 h-7 text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => handleDeleteItem(item)} disabled={isProcessing}>
                             <Trash2 className="w-3.5 h-3.5 mr-1 inline" /> Eliminar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Modal */}
      {adjustingItem && (
        <Dialog open={adjustingItem !== null} onOpenChange={(open) => !open && setAdjustingItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <Hammer className="w-5 h-5 text-blue-600" /> Ajustar Stock Físico
              </DialogTitle>
              <DialogDescription>
                Afecta directamente la cantidad de **{adjustingItem.sku_normalized}** en depósito.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>Stock Actual Físico</Label>
                <Input
                  type="number"
                  placeholder="Cantidad en depósito"
                  value={adjustStockVal}
                  onChange={(e) => setAdjustStockVal(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Motivo / Observaciones del Ajuste</Label>
                <Input
                  placeholder="Ej. Recuento de fin de mes, rotura..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  required
                />
              </div>

              <DialogFooter className="pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setAdjustingItem(null)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isProcessing ? "Ajustando..." : "Registrar Ajuste"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Parameter Edit Modal */}
      {editingItem && (
        <Dialog open={editingItem !== null} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-indigo-600" /> Editar Parámetros de Insumo
              </DialogTitle>
              <DialogDescription>
                Modifica los atributos del SKU **{editingItem.sku_normalized}**.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>Nombre descriptivo del Componente</Label>
                <Input
                  placeholder="Ej. Cadena Metálica 45cm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Categoría interna</Label>
                <Input
                  placeholder="Ej. Cadenas, Dijes"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Costo Promedio Ponderado ($)</Label>
                <Input
                  type="number"
                  placeholder="Ej. 3000"
                  value={editCost}
                  onChange={(e) => setEditCost(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Stock de Reorden Mínimo</Label>
                <Input
                  type="number"
                  placeholder="Ej. 5"
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingItem(null)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isProcessing ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* History Ledger Modal */}
      {viewingHistoryItem && (
        <Dialog open={viewingHistoryItem !== null} onOpenChange={(open) => !open && setViewingHistoryItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <History className="w-5 h-5 text-indigo-600" /> Kardex de Movimientos
              </DialogTitle>
              <DialogDescription>
                Auditoría histórica de movimientos de stock para **{viewingHistoryItem.sku_normalized}**.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs">
              {isLoadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                  <p>Cargando movimientos...</p>
                </div>
              ) : historyMovements.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No hay movimientos registrados para este componente.
                </div>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2">
                  {historyMovements.map((mov) => {
                    const isPositive = mov.quantity_delta > 0;
                    return (
                      <div key={mov.id} className="p-3 border rounded-lg bg-slate-50/50 flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold capitalize text-slate-800">{
                              mov.movement_type === "purchase" ? "Compra" :
                              mov.movement_type === "adjustment" ? "Ajuste manual" :
                              mov.movement_type === "void_purchase" ? "Anulación compra" : 
                              mov.movement_type === "sale_confirmed" ? "Venta Mercado Libre" :
                              mov.movement_type === "return" ? "Cancelación / Devolución" :
                              mov.movement_type
                            }</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-300">
                              {mov.source}
                            </Badge>
                          </div>
                          {mov.notes && <p className="text-[10px] text-muted-foreground">{mov.notes}</p>}
                          <p className="text-[9px] text-slate-400">{new Date(mov.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                            {isPositive ? `+${mov.quantity_delta}` : mov.quantity_delta}
                          </span>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Saldo: {mov.new_stock} u</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setViewingHistoryItem(null)} className="w-full">Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
