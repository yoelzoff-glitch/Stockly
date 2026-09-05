// src/app/dashboard/settings/costs/client-page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { Plus, Trash2, HelpCircle } from "lucide-react";
import { createExtraCost, deleteExtraCost } from "./actions";

export function ExtraCostsClient({ initialCosts }: { initialCosts: any[] }) {
  const [costs, setCosts] = useState<any[]>(initialCosts);
  const [isNewCostOpen, setIsNewCostOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [costType, setCostType] = useState<"fixed" | "percent">("fixed");
  const [appliesTo, setAppliesTo] = useState<"all" | "category" | "product">("all");
  const [targetId, setTargetId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) {
      alert("Por favor completa los campos requeridos.");
      return;
    }
    setIsProcessing(true);
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("El monto debe ser un número positivo.");
      }

      let productId = undefined;
      let categoryId = undefined;

      if (appliesTo === "product") productId = targetId.trim();
      if (appliesTo === "category") categoryId = targetId.trim();

      const res = await createExtraCost(
        name.trim(),
        parsedAmount,
        costType,
        appliesTo,
        productId,
        categoryId
      );

      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error creando costo extra: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este costo extra? Se recalcularán los costos finales de todas las publicaciones afectadas.")) return;
    setIsProcessing(true);
    try {
      const res = await deleteExtraCost(id);
      if (res.success) {
        window.location.reload();
      }
    } catch (err: any) {
      alert("Error eliminando costo extra: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Costos Adicionales y Recargos"
        description="Configuración de cargos fijos o porcentuales que se suman al costo base del producto para determinar el margen neto real."
        backLink={{
          href: "/dashboard/settings",
          label: "Volver a Configuración"
        }}
        actions={
          <Button
            size="sm"
            onClick={() => setIsNewCostOpen(true)}
            className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nuevo Costo Adicional
          </Button>
        }
      />

      {/* Explanatory Operational Notice */}
      <div className="p-4 rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#101828]">
          <HelpCircle className="w-4 h-4 text-[#102A56]" />
          <span>Mecánica del Cálculo de Costos en Klyvo</span>
        </div>
        <p className="text-xs text-[#5F6875] leading-relaxed">
          Los costos adicionales (etiquetas, comisiones bancarias fijas o insumos de empaque) se deducen automáticamente del precio de venta junto con las comisiones de Mercado Libre y los costos de envío. Puedes definir reglas <strong>Globales</strong> (todo el catálogo), <strong>Por Categoría ML</strong> o <strong>Por Producto Específico</strong> (asignando el MLA).
        </p>
      </div>

      {/* Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Reglas de Costos Configuradas</h3>
            <p className="text-xs text-[#5F6875]">Listado de cargos activos aplicados al inventario.</p>
          </div>
          <span className="text-xs font-mono text-[#5F6875]">{costs.length} reglas</span>
        </div>

        <DataTableShell>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Concepto</th>
                  <th className="px-3 py-2.5 text-right">Valor / Monto</th>
                  <th className="px-3 py-2.5 text-center">Tipo</th>
                  <th className="px-3 py-2.5 text-center">Alcance</th>
                  <th className="px-4 py-2.5">Destino / ID</th>
                  <th className="px-4 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {costs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <OperationalEmptyState
                        title="Todos los productos tienen un costo cargado."
                        description="No tienes reglas de costos adicionales configuradas. Agrega una regla global o por categoría si necesitas incluir insumos fijos."
                        actionLabel="Añadir Costo Extra"
                        onAction={() => setIsNewCostOpen(true)}
                      />
                    </td>
                  </tr>
                ) : (
                  costs.map((cost) => (
                    <tr key={cost.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-[#101828]">
                        {cost.name}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {cost.cost_type === "fixed" ? `$${cost.amount.toLocaleString("es-AR")}` : `${cost.amount}%`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge variant="neutral">
                          {cost.cost_type === "fixed" ? "Monto Fijo" : "Porcentaje"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge variant={cost.applies_to === "all" ? "info" : "warning"}>
                          {cost.applies_to === "all" ? "Global" : cost.applies_to === "category" ? "Categoría" : "Producto"}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#5F6875] text-[11px]">
                        {cost.applies_to === "all" ? "— (Todo el catálogo)" :
                         cost.applies_to === "category" ? (cost.metadata?.category_id || cost.name) :
                         cost.product_id}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cost.id)}
                          disabled={isProcessing}
                          className="h-7 w-7 p-0 text-[#5F6875] hover:text-[#D92D20] hover:bg-[#D92D20]/10"
                          title="Eliminar regla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      </div>

      {/* Modal */}
      {isNewCostOpen && (
        <Dialog open={isNewCostOpen} onOpenChange={(open) => !open && setIsNewCostOpen(false)}>
          <DialogContent className="max-w-md bg-[#FFFFFF] border-[#DCDAD4]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#101828]">Nuevo Costo Adicional</DialogTitle>
              <DialogDescription className="text-xs text-[#5F6875]">
                Define un recargo y especifica sobre qué publicaciones se aplicará.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Concepto / Denominación</Label>
                <Input
                  placeholder="Ej. Bolsa Packaging, Comisión Embalaje"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-8 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Tipo de Cargo</Label>
                  <select
                    value={costType}
                    onChange={(e) => setCostType(e.target.value as any)}
                    className="w-full rounded-md border border-[#DCDAD4] h-8 px-2.5 text-xs bg-[#FFFFFF] text-[#101828]"
                  >
                    <option value="fixed">Monto Fijo ($)</option>
                    <option value="percent">Porcentual (%)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Valor / Monto</Label>
                  <Input
                    type="number"
                    placeholder="Ej. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="0.01"
                    step="0.01"
                    className="h-8 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-[#DCDAD4]">
                <Label className="text-xs font-semibold text-[#101828]">Alcance de la Regla</Label>
                <select
                  value={appliesTo}
                  onChange={(e) => {
                    setAppliesTo(e.target.value as any);
                    setTargetId("");
                  }}
                  className="w-full rounded-md border border-[#DCDAD4] h-8 px-2.5 text-xs bg-[#FFFFFF] text-[#101828]"
                >
                  <option value="all">Global (Todo el catálogo)</option>
                  <option value="category">Por Categoría de Mercado Libre</option>
                  <option value="product">Por Producto Específico</option>
                </select>
              </div>

              {appliesTo !== "all" && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">
                    {appliesTo === "category" ? "Código de Categoría ML" : "ID de Publicación (MLA)"}
                  </Label>
                  <Input
                    placeholder={appliesTo === "category" ? "Ej. MLA1430" : "Ej. MLA123456789"}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                    className="h-8 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                  />
                </div>
              )}

              <DialogFooter className="pt-3 border-t border-[#DCDAD4] gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewCostOpen(false)}
                  disabled={isProcessing}
                  className="h-8 border-[#DCDAD4] text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing}
                  className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold"
                >
                  {isProcessing ? "Guardando..." : "Crear Costo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
