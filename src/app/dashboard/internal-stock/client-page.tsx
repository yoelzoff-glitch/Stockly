// src/app/dashboard/internal-stock/client-page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Hammer, Edit3, BarChart, History, Download, RefreshCw, Layers, ArrowUpDown, ShieldAlert, BadgeInfo } from "lucide-react";
import { adjustInventoryStock, updateInventoryItemParams, getInventoryMovements } from "./actions";

export function InternalStockClient({ initialItems }: { initialItems: any[] }) {
  const [items, setItems] = useState<any[]>(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  
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

  // CSV Export
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SKU,Nombre,Categoria,Stock Deposito,Costo Promedio,Ultimo Costo Compra,Stock Minimo\n";
    
    items.forEach(item => {
      const row = [
        item.sku_normalized,
        `"${item.name || ''}"`,
        `"${item.category || ''}"`,
        item.current_stock || 0,
        item.average_cost || 0,
        item.last_purchase_cost || 0,
        item.minimum_stock || 0
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventario_deposito.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Stock Interno</h2>
          <p className="text-sm text-muted-foreground">
            Monitorea insumos físicos en el depósito real, controla puntos de reorden y costos promedio.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Analytics */}
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
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isOutOfStock = (item.current_stock || 0) === 0;
                    const isLowStock = item.minimum_stock && (item.current_stock || 0) < item.minimum_stock;
                    return (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-blue-600">{item.sku_normalized}</td>
                        <td className="p-3 font-medium text-slate-800">{item.name || "Sin nombre"}</td>
                        <td className="p-3 text-muted-foreground">{item.category || "General"}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{item.current_stock || 0}</td>
                        <td className="p-3 text-right font-medium text-slate-700">${Number(item.average_cost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-muted-foreground">${Number(item.last_purchase_cost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-muted-foreground">{item.minimum_stock || "-"}</td>
                        <td className="p-3 text-center">
                          {isOutOfStock ? (
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
                              mov.movement_type === "void_purchase" ? "Anulación compra" : mov.movement_type
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
