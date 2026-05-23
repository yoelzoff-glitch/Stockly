// src/app/dashboard/pricing/adjust-price-modal.tsx
import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Assuming you have a Modal / Dialog component in the project.
// If not, you can replace with any UI library you use.
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AdjustPriceModalProps {
  tenantId: string;
  triggerLabel?: string;
}

export function AdjustPriceModal({ tenantId, triggerLabel = "Ajustar precios" }: AdjustPriceModalProps) {
  const [open, setOpen] = useState(false);
  const [targetMargin, setTargetMargin] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        tenantId,
        targetMarginPercent: Number(targetMargin),
      };
      if (filterType === "sku") payload.filter = { sku: filterValue };
      if (filterType === "category") payload.filter = { categoryId: filterValue };

      const res = await fetch("/api/pricing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al simular");
      setPreview(data.preview);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const adjustments = preview.map((p) => ({ productId: p.productId, targetPrice: p.targetPrice }));
      const res = await fetch("/api/pricing/create-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, targetMarginPercent: Number(targetMargin), adjustments }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear workflow");
      // Optionally redirect to workflows page or show success toast
      alert("Workflow creado exitosamente. ID: " + data.workflowId);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (preview.length === 0) return;
    const headers = ["SKU", "Precio Actual", "Precio Objetivo", "% Cambio", "Nuevo Margen"]; 
    const rows = preview.map((p) => [p.sku, p.currentPrice, p.targetPrice, p.priceChangePercent, p.newMargin]);
    const csvContent = [headers, ...rows]
      .map((e) => e.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `price_adjustment_preview_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajuste masivo de precios</DialogTitle>
          <DialogDescription>Introduce el margen objetivo y opcionalmente filtra por SKU o categoría.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <Input
            type="number"
            placeholder="Margen objetivo % (1‑80)"
            value={targetMargin}
            onChange={(e) => setTargetMargin(e.target.value)}
            min={1}
            max={80}
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo de filtro" />
            </SelectTrigger>
            <SelectItem value="all">Todos los productos</SelectItem>
            <SelectItem value="sku">Por SKU</SelectItem>
            <SelectItem value="category">Por categoría</SelectItem>
          </Select>
          {filterType !== "all" && (
            <Input
              placeholder={filterType === "sku" ? "SKU" : "ID de categoría"}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSimulate} disabled={loading || !targetMargin}>
              {loading ? "Simulando…" : "Simular"}
            </Button>
            {preview.length > 0 && (
              <>
                <Button variant="outline" onClick={exportCSV}>Exportar CSV</Button>
                <Button onClick={handleConfirm} disabled={loading}>Confirmar</Button>
              </>
            )}
          </div>
          {preview.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto">
              <table className="w-full table-auto border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 border">SKU</th>
                    <th className="px-2 py-1 border">Precio actual</th>
                    <th className="px-2 py-1 border">Precio objetivo</th>
                    <th className="px-2 py-1 border">% Cambio</th>
                    <th className="px-2 py-1 border">Nuevo margen</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.productId}>
                      <td className="px-2 py-1 border">{p.sku}</td>
                      <td className="px-2 py-1 border">{p.currentPrice}</td>
                      <td className="px-2 py-1 border">{p.targetPrice}</td>
                      <td className="px-2 py-1 border">{p.priceChangePercent}%</td>
                      <td className="px-2 py-1 border">{p.newMargin}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AdjustPriceModal;
