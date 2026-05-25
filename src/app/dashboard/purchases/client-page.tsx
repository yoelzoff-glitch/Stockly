// src/app/dashboard/purchases/client-page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingBag, Plus, Upload, Trash2, Calendar, AlertTriangle, FileSpreadsheet, Sparkles, User, FileText, CheckCircle2 } from "lucide-react";
import { createManualPurchase, voidPurchase } from "./actions";

export function PurchasesClient({ initialPurchases }: { initialPurchases: any[] }) {
  const [purchases, setPurchases] = useState(initialPurchases);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  
  // Modals state
  const [isNewPOOpen, setIsNewPOOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New PO form state
  const [supplierName, setSupplierName] = useState("");
  const [extraCosts, setExtraCosts] = useState("0");
  const [items, setItems] = useState<{ sku: string; quantity: string; unit_cost: string }[]>([
    { sku: "", quantity: "1", unit_cost: "" }
  ]);

  // CSV Import state
  const [csvText, setCsvText] = useState("");
  const [csvImportSupplier, setCsvImportSupplier] = useState("");

  // Filtering
  const filteredPurchases = purchases.filter(p => {
    const supplierMatch = p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.purchase_order_items?.some((i: any) => i.sku_normalized.toLowerCase().includes(searchTerm.toLowerCase()));
    const idMatch = p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = supplierMatch || skuMatch || idMatch;

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && p.status === statusFilter;
  });

  // Totals
  const activePurchases = purchases.filter(p => p.status !== "voided");
  const totalSpend = activePurchases.reduce((acc, p) => acc + (p.total_amount || 0), 0);
  const totalExtraCosts = activePurchases.reduce((acc, p) => acc + (p.extra_costs || 0), 0);

  // New PO Handlers
  const handleAddItemRow = () => {
    setItems([...items, { sku: "", quantity: "1", unit_cost: "" }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: "sku" | "quantity" | "unit_cost", val: string) => {
    const updated = [...items];
    updated[idx][field] = val;
    setItems(updated);
  };

  const handleSubmitNewPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      // Validate items
      const validItems = items
        .filter(it => it.sku.trim() !== "")
        .map(it => ({
          sku: it.sku.trim(),
          quantity: parseFloat(it.quantity) || 1,
          unit_cost: it.unit_cost ? parseFloat(it.unit_cost) : undefined
        }));

      if (validItems.length === 0) {
        alert("Debes ingresar al menos un componente válido.");
        setIsProcessing(false);
        return;
      }

      const res = await createManualPurchase(
        supplierName.trim(),
        validItems,
        parseFloat(extraCosts) || 0
      );

      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error registrando compra: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Void PO Handler
  const handleVoidPO = async (poId: string) => {
    if (!confirm("¿Estás seguro de que deseas ANULAR esta compra? Se revertirá todo el stock de depósito ingresado y se recalcularán los costos de tus publicaciones asociadas.")) return;
    setIsProcessing(true);
    try {
      const res = await voidPurchase(poId);
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error anulando compra: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // CSV Import handler
  const handleImportCSVSubmit = async () => {
    if (!csvText.trim()) {
      alert("Por favor, pega el contenido CSV.");
      return;
    }
    setIsProcessing(true);
    try {
      const lines = csvText.split("\n");
      const parsedItems = [];

      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const parts = line.split(",");
        if (parts.length >= 2) {
          const sku = parts[0].trim();
          const quantity = parseFloat(parts[1].trim());
          const unit_cost = parts[2] ? parseFloat(parts[2].trim()) : undefined;

          // Skip header
          if (sku.toLowerCase() === "sku") continue;

          if (sku && !isNaN(quantity)) {
            parsedItems.push({ sku, quantity, unit_cost });
          }
        }
      }

      if (parsedItems.length === 0) {
        throw new Error("No se encontraron registros de compra válidos en el CSV.");
      }

      const res = await createManualPurchase(
        csvImportSupplier.trim() || "Importación CSV",
        parsedItems,
        0
      );

      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error al importar CSV: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Compras Internas</h2>
          <p className="text-sm text-muted-foreground">
            Ingresa mercadería a tu depósito real, carga costos de insumos y gatilla el recálculo automático de combos.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setIsImportCSVOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setIsNewPOOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="mr-2 h-4 w-4" />
            Registrar Compra
          </Button>
        </div>
      </div>

      {/* Analytics widgets */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total Real</CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Excluyendo compras anuladas</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Órdenes de Compra</CardTitle>
            <FileText className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePurchases.length} órdenes</div>
            <p className="text-xs text-muted-foreground mt-1">
              Con {purchases.filter(p => p.status === "voided").length} anuladas
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costos de Logística y Envío de Insumo</CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalExtraCosts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Suma de costos extra asociados</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Historial de Compras</CardTitle>
            <CardDescription>Visualiza y administra tus ingresos de mercadería física.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por proveedor, SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-[250px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 text-xs px-2 bg-white"
            >
              <option value="all">Todos los Estados</option>
              <option value="completed">Completadas</option>
              <option value="voided">Anuladas</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPurchases.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No se encontraron registros de compra.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="p-3">Código PO</th>
                    <th className="p-3">Proveedor</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-right">Items</th>
                    <th className="p-3 text-right">Monto Total</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Origen</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((po) => {
                    const isVoided = po.status === "voided";
                    return (
                      <tr key={po.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-semibold text-blue-600 shrink-0">#{po.id.slice(0, 8)}</td>
                        <td className="p-3 font-medium flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {po.supplier_name || "S/D"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(po.purchase_date).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-medium">{po.purchase_order_items?.length || 0} items</td>
                        <td className="p-3 text-right font-semibold">${po.total_amount?.toLocaleString() || 0}</td>
                        <td className="p-3 text-center">
                          <Badge variant={isVoided ? "destructive" : "default"}>
                            {isVoided ? "Anulada" : "Completada"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={po.source === "ai" ? "border-indigo-300 text-indigo-700 bg-indigo-50" : "border-slate-350 text-slate-700 bg-slate-50"}>
                            {po.source === "ai" ? "🤖 IA Chat" : "💻 Dashboard"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button variant="outline" size="sm" className="text-[10px] px-2 py-0.5 h-7" onClick={() => setSelectedPO(po)}>
                            Ver Detalle
                          </Button>
                          {!isVoided && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[10px] px-2 py-0.5 h-7" onClick={() => handleVoidPO(po.id)} disabled={isProcessing}>
                              <Trash2 className="w-3.5 h-3.5 mr-1 inline" /> Anular
                            </Button>
                          )}
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

      {/* View Detail Modal */}
      {selectedPO && (
        <Dialog open={selectedPO !== null} onOpenChange={(open) => !open && setSelectedPO(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5 text-lg">
                Detalle de Compra <Badge variant="outline">#{selectedPO.id.slice(0, 8)}</Badge>
              </DialogTitle>
              <DialogDescription>
                Resumen de artículos ingresados y costos asociados.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <p className="font-semibold">{selectedPO.supplier_name || "Sin Especificar"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <p className="font-semibold">{new Date(selectedPO.purchase_date).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Origen:</span>
                  <p className="font-semibold capitalize">{selectedPO.source}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <p className={`font-semibold ${selectedPO.status === "voided" ? "text-red-500" : "text-green-600"}`}>
                    {selectedPO.status === "voided" ? "Anulada" : "Completada"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Artículos Comprados</h4>
                <div className="rounded-lg border max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 font-medium border-b">
                      <tr>
                        <th className="p-2">Componente SKU</th>
                        <th className="p-2 text-right">Cant.</th>
                        <th className="p-2 text-right">Unit.</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.purchase_order_items?.map((item: any) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{item.sku_normalized}</td>
                          <td className="p-2 text-right font-semibold">{item.quantity}</td>
                          <td className="p-2 text-right">${item.unit_cost?.toLocaleString() || "N/A"}</td>
                          <td className="p-2 text-right">${item.total_cost?.toLocaleString() || "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gastos de Flete / Logística:</span>
                  <span className="font-medium">${selectedPO.extra_costs?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>Monto Total:</span>
                  <span>${selectedPO.total_amount?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSelectedPO(null)} className="w-full">Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* New Purchase Modal */}
      {isNewPOOpen && (
        <Dialog open={isNewPOOpen} onOpenChange={(open) => !open && setIsNewPOOpen(false)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <ShoppingBag className="w-5 h-5 text-blue-600" /> Registrar Compra Física
              </DialogTitle>
              <DialogDescription>
                Suma stock a tu depósito físico y recalcula el costo promedio de insumos automáticamente.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitNewPO} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nombre de Proveedor</Label>
                  <Input
                    placeholder="Ej. Distribuidor Metales"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Costos Adicionales de Flete/Bolsas</Label>
                  <Input
                    type="number"
                    placeholder="Ej. 1500"
                    value={extraCosts}
                    onChange={(e) => setExtraCosts(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Artículos y Componentes</h4>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItemRow} className="h-7 text-[10px]">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Añadir componente
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label>SKU Componente</Label>
                        <Input
                          placeholder="Ej. C 144"
                          value={item.sku}
                          onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                          required
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          required
                          min="1"
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label>Costo Unitario (opcional)</Label>
                        <Input
                          type="number"
                          placeholder="Ej. 3000"
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-9 w-9 shrink-0 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsNewPOOpen(false)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isProcessing ? "Procesando..." : "Ingresar Compra"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* CSV Import Modal */}
      {isImportCSVOpen && (
        <Dialog open={isImportCSVOpen} onOpenChange={(open) => !open && setIsImportCSVOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Importar Lista de Compras (CSV)
              </DialogTitle>
              <DialogDescription>
                Pega tus datos separados por coma. Formato requerido:
                <code className="block bg-slate-100 p-2 rounded text-xs mt-2 text-indigo-700">
                  sku,cantidad,costo_unitario_opcional<br />
                  C 144,10,3000<br />
                  D 163,5,2000
                </code>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2 text-xs">
              <div className="space-y-1">
                <Label>Nombre Proveedor (opcional)</Label>
                <Input
                  placeholder="Ej. Importador Metales CSV"
                  value={csvImportSupplier}
                  onChange={(e) => setCsvImportSupplier(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Contenido CSV</Label>
                <textarea
                  placeholder="sku,cantidad,costo&#10;C 144,10,3000&#10;D 163,5,2000"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full h-40 rounded-md border border-slate-200 p-3 bg-white font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-slate-350"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsImportCSVOpen(false)} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button onClick={handleImportCSVSubmit} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isProcessing ? "Importando..." : "Comenzar Importación"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
