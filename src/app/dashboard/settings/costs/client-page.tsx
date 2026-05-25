// src/app/dashboard/settings/costs/client-page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Percent, DollarSign, Plus, Trash2, ArrowLeft, Coins, HelpCircle } from "lucide-react";
import Link from "next/link";
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
  const [targetId, setTargetId] = useState(""); // Category ID or Product ID

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
    if (!confirm("¿Estás seguro de que deseas eliminar este costo extra? Se recalcularán los costos finales de todas las publicaciones que estuvieran siendo afectadas.")) return;
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
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Costos Extra</h2>
            <p className="text-sm text-muted-foreground">
              Define recargos y gastos directos que impactan en el costeo final de tus publicaciones.
            </p>
          </div>
        </div>
        <Button onClick={() => setIsNewCostOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Añadir Costo Extra
        </Button>
      </div>

      {/* Intro info card */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="pt-4 flex gap-3 text-xs text-blue-800">
          <HelpCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">¿Cómo funcionan los Costos Extra?</p>
            <p className="mt-1 leading-relaxed">
              Los costos extra (como bolsitas de packaging, etiquetas o comisiones fijas de logística) se suman de forma automática al costo de fabricación de tus combos o publicaciones individuales. Puedes configurar costos <strong>Globales</strong> (se aplican a todo el catálogo), <strong>Por Categoría</strong> de Mercado Libre, o <strong>Por Producto</strong> específico.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main Catalog Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Listado de Costos Extra Activos</CardTitle>
          <CardDescription>Cargos aplicados al costeo de tu inventario.</CardDescription>
        </CardHeader>
        <CardContent>
          {costs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No tienes costos extra configurados. Comienza agregando uno global.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="p-3">Concepto</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 text-center">Tipo de Costo</th>
                    <th className="p-3 text-center">Alcance / Aplica A</th>
                    <th className="p-3">Destino / ID</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr key={cost.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800 flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        {cost.name}
                      </td>
                      <td className="p-3 text-right font-bold">
                        {cost.cost_type === "fixed" ? `$${cost.amount.toLocaleString()}` : `${cost.amount}%`}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="capitalize">
                          {cost.cost_type === "fixed" ? "Fijo ($)" : "Porcentual (%)"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={
                          cost.applies_to === "all" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                          cost.applies_to === "category" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                          "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
                        }>
                          {cost.applies_to === "all" ? "Global (Todos)" :
                           cost.applies_to === "category" ? "Por Categoría" : "Por Producto"}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {cost.applies_to === "all" ? "-" :
                         cost.applies_to === "category" ? (cost.metadata?.category_id || cost.name) :
                         cost.product_id}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-750 hover:bg-red-50" onClick={() => handleDelete(cost.id)} disabled={isProcessing}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Extra Cost Modal */}
      {isNewCostOpen && (
        <Dialog open={isNewCostOpen} onOpenChange={(open) => !open && setIsNewCostOpen(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <Coins className="w-5 h-5 text-blue-600" /> Nuevo Costo Extra
              </DialogTitle>
              <DialogDescription>
                Define un costo adicional y recalcula tus publicaciones vinculadas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>Concepto / Nombre del Costo</Label>
                <Input
                  placeholder="Ej. Bolsa Packaging, Comisión Embalaje"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo de Cargo</Label>
                  <select
                    value={costType}
                    onChange={(e) => setCostType(e.target.value as any)}
                    className="w-full rounded-md border border-slate-200 h-9 px-2 bg-white"
                  >
                    <option value="fixed">Fijo ($)</option>
                    <option value="percent">Porcentual (%)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Valor / Monto</Label>
                  <Input
                    type="number"
                    placeholder="Ej. 500 o 5%"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <Label>Alcance (¿A quién aplica?)</Label>
                <select
                  value={appliesTo}
                  onChange={(e) => {
                    setAppliesTo(e.target.value as any);
                    setTargetId("");
                  }}
                  className="w-full rounded-md border border-slate-200 h-9 px-2 bg-white"
                >
                  <option value="all">Global (Todo el catálogo)</option>
                  <option value="category">Por Categoría de ML</option>
                  <option value="product">Por Producto Específico</option>
                </select>
              </div>

              {appliesTo !== "all" && (
                <div className="space-y-1">
                  <Label>{appliesTo === "category" ? "ID de la Categoría ML" : "ID del Producto (Mercado Libre)"}</Label>
                  <Input
                    placeholder={appliesTo === "category" ? "Ej. MLA1430 o MLA_CATEGORY" : "Ej. MLA123456789"}
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    required
                  />
                </div>
              )}

              <DialogFooter className="pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setIsNewCostOpen(false)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
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
