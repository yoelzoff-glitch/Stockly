"use client";

import { useState } from "react";
import {
  ShoppingBag,
  Plus,
  Upload,
  Trash2,
  Calendar,
  FileSpreadsheet,
  User,
  FileText,
  CheckCircle2,
  DollarSign,
  Truck,
  Eye,
  Ban
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

  const metrics: MetricItem[] = [
    {
      label: "Inversión Total Real",
      value: `$${totalSpend.toLocaleString("es-AR")}`,
      subtext: "Compras efectivas no anuladas",
      icon: <DollarSign className="w-4 h-4" />
    },
    {
      label: "Fletes y Costos Extras",
      value: `$${totalExtraCosts.toLocaleString("es-AR")}`,
      subtext: "Logística y aranceles prorrateados",
      icon: <Truck className="w-4 h-4" />
    },
    {
      label: "Órdenes Registradas",
      value: activePurchases.length.toString(),
      subtext: `${purchases.length} totales en historial`,
      icon: <ShoppingBag className="w-4 h-4" />
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Abastecimiento y compras"
        title="Compras internas"
        description="Ingreso de mercadería física a depósito, costeo de insumos y recálculo automático de costos de reposición."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsImportCSVOpen(true)}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 text-[#5F6875]" />
              Importar CSV
            </Button>
            <Button
              onClick={() => setIsNewPOOpen(true)}
              className="h-9 px-3 text-xs font-semibold bg-[#102A56] hover:bg-[#102A56]/90 text-white shadow-sm"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Registrar Compra
            </Button>
          </div>
        }
      />

      {/* Franja de Indicadores */}
      <MetricStrip metrics={metrics} columns={3} />

      {/* Barra de Filtros Operativos */}
      <OperationalToolbar>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
          >
            <option value="all">Todas las compras</option>
            <option value="received">Recibidas / Activas</option>
            <option value="voided">Anuladas</option>
          </select>
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="text"
            placeholder="Buscar por proveedor, SKU o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 text-xs bg-white border-[#DCDAD4] focus-visible:ring-[#102A56]"
          />
        </div>
      </OperationalToolbar>

      {/* Tabla de Compras */}
      <DataTableShell
        isEmpty={filteredPurchases.length === 0}
        emptyState={
          <OperationalEmptyState
            icon={ShoppingBag}
            title="No hay compras registradas"
            description="Registrá tu primera orden de compra manual o importá un CSV para ingresar existencias y actualizar tus costos."
            actionLabel="Registrar Compra"
            onAction={() => setIsNewPOOpen(true)}
          />
        }
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
            <tr>
              <th className="px-4 py-3 font-semibold">Fecha / ID</th>
              <th className="px-3 py-3 font-semibold">Proveedor</th>
              <th className="px-3 py-3 font-semibold">Componentes Comprados</th>
              <th className="px-3 py-3 font-semibold text-right">Flete / Extras</th>
              <th className="px-3 py-3 font-semibold text-right">Total Abonado</th>
              <th className="px-3 py-3 font-semibold text-center">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {filteredPurchases.map((po) => {
              const isVoided = po.status === "voided";

              return (
                <tr
                  key={po.id}
                  className={`hover:bg-[#F5F3EE]/30 transition-colors ${
                    isVoided ? 'opacity-60 bg-[#F8FAFC]' : ''
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[#101828]">
                        {new Date(po.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </p>
                      <p className="text-[10px] font-mono text-[#5F6875]">
                        #{po.id.substring(0, 8)}
                      </p>
                    </div>
                  </td>

                  <td className="px-3 py-3 font-medium text-[#101828]">
                    {po.supplier_name || "Proveedor sin nombre"}
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {po.purchase_order_items?.map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F5F3EE] border border-[#DCDAD4] text-[#101828]"
                        >
                          {item.sku_normalized}: {item.quantity_purchased} u.
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-3 py-3 text-right font-medium text-[#5F6875] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${Number(po.extra_costs || 0).toLocaleString("es-AR")}
                  </td>

                  <td className="px-3 py-3 text-right font-bold text-[#101828] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${Number(po.total_amount || 0).toLocaleString("es-AR")}
                  </td>

                  <td className="px-3 py-3 text-center">
                    <StatusBadge variant={isVoided ? 'neutral' : 'success'}>
                      {isVoided ? 'Anulada' : 'Recibida'}
                    </StatusBadge>
                  </td>

                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPO(po)}
                        className="h-7 px-2 text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE]"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1 text-[#5F6875]" />
                        Detalle
                      </Button>
                      {!isVoided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVoidPO(po.id)}
                          disabled={isProcessing}
                          className="h-7 w-7 p-0 text-[#D92D20] hover:bg-[#FEF3F2]"
                          title="Anular compra"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      {/* Modal: Detalle de Orden */}
      {selectedPO && (
        <Dialog open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)}>
          <DialogContent className="sm:max-w-lg bg-white border border-[#DCDAD4] shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#101828]">
                Orden de compra #{selectedPO.id.substring(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#5F6875]">
                Emitida el {new Date(selectedPO.created_at).toLocaleDateString("es-AR")} para {selectedPO.supplier_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded-lg">
                <div>
                  <span className="text-[#5F6875] text-[11px] block">Proveedor</span>
                  <span className="font-bold text-[#101828] text-sm">{selectedPO.supplier_name}</span>
                </div>
                <div>
                  <span className="text-[#5F6875] text-[11px] block">Estado</span>
                  <span className="font-bold text-[#101828] text-sm capitalize">{selectedPO.status === 'received' ? 'Recibida' : selectedPO.status}</span>
                </div>
              </div>

              <div className="border border-[#DCDAD4] rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
                    <tr>
                      <th className="px-3 py-2">Componente (SKU)</th>
                      <th className="px-3 py-2 text-right">Cant.</th>
                      <th className="px-3 py-2 text-right">Costo Unit.</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {selectedPO.purchase_order_items?.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono font-medium text-[#101828]">{it.sku_normalized}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.quantity_purchased}</td>
                        <td className="px-3 py-2 text-right tabular-nums">${Number(it.unit_cost || 0).toLocaleString("es-AR")}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#101828]">
                          ${(it.quantity_purchased * (it.unit_cost || 0)).toLocaleString("es-AR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 pt-1 text-right text-xs">
                {selectedPO.extra_costs > 0 && (
                  <p className="text-[#5F6875]">
                    Fletes y costos extra: <strong className="text-[#101828] tabular-nums">${Number(selectedPO.extra_costs).toLocaleString("es-AR")}</strong>
                  </p>
                )}
                <p className="text-sm font-bold text-[#101828]">
                  Total abonado: <span className="text-[#102A56] tabular-nums">${Number(selectedPO.total_amount).toLocaleString("es-AR")}</span>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedPO(null)} className="h-8 text-xs border-[#DCDAD4]">
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Registrar Compra */}
      <Dialog open={isNewPOOpen} onOpenChange={setIsNewPOOpen}>
        <DialogContent className="sm:max-w-xl bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Registrar nueva orden de compra
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Ingresá mercadería a tu depósito. El costo se prorrateará y actualizará el costo promedio ponderado de tus publicaciones.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitNewPO} className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="supplier_name" className="text-xs font-semibold text-[#101828]">Proveedor</Label>
                <Input
                  id="supplier_name"
                  placeholder="Ej: Distribuidora Norte"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  required
                  className="h-8 text-xs border-[#DCDAD4]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="extra_costs" className="text-xs font-semibold text-[#101828]">Flete / Costos Extra ($)</Label>
                <Input
                  id="extra_costs"
                  type="number"
                  step="0.01"
                  value={extraCosts}
                  onChange={(e) => setExtraCosts(e.target.value)}
                  className="h-8 text-xs border-[#DCDAD4]"
                />
              </div>
            </div>

            <div className="space-y-2 border border-[#DCDAD4] rounded-lg p-3 bg-[#FCFCFA]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#101828] text-xs">Componentes a ingresar</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItemRow}
                  className="h-7 text-xs border-[#DCDAD4]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Agregar componente
                </Button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {items.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="SKU componente"
                      value={row.sku}
                      onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                      required
                      className="h-8 text-xs flex-1 border-[#DCDAD4]"
                    />
                    <Input
                      type="number"
                      placeholder="Cantidad"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                      required
                      className="h-8 text-xs w-24 border-[#DCDAD4]"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Costo unitario"
                      value={row.unit_cost}
                      onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                      className="h-8 text-xs w-28 border-[#DCDAD4]"
                    />
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="h-8 w-8 p-0 text-[#D92D20]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewPOOpen(false)} className="h-8 text-xs border-[#DCDAD4]">
                Cancelar
              </Button>
              <Button type="submit" disabled={isProcessing} className="h-8 text-xs bg-[#102A56] hover:bg-[#102A56]/90 text-white">
                Registrar Ingreso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Importar CSV */}
      <Dialog open={isImportCSVOpen} onOpenChange={setIsImportCSVOpen}>
        <DialogContent className="sm:max-w-lg bg-white border border-[#DCDAD4] shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Importar compras desde CSV
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Formato esperado por línea: <code>SKU,CANTIDAD,COSTO_UNITARIO</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="csv_supplier" className="text-xs font-semibold text-[#101828]">Proveedor (Opcional)</Label>
              <Input
                id="csv_supplier"
                placeholder="Nombre del proveedor o factura"
                value={csvImportSupplier}
                onChange={(e) => setCsvImportSupplier(e.target.value)}
                className="h-8 text-xs border-[#DCDAD4]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="csv_content" className="text-xs font-semibold text-[#101828]">Contenido CSV</Label>
              <textarea
                id="csv_content"
                rows={6}
                placeholder="BANQUETA-ROJA,50,4500&#10;BANQUETA-AZUL,20,4700"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full text-xs font-mono p-2.5 border border-[#DCDAD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#102A56]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsImportCSVOpen(false)} className="h-8 text-xs border-[#DCDAD4]">
              Cancelar
            </Button>
            <Button onClick={handleImportCSVSubmit} disabled={isProcessing} className="h-8 text-xs bg-[#102A56] hover:bg-[#102A56]/90 text-white">
              Procesar CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
