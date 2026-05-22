"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProductCost } from "@/app/dashboard/products/actions";

interface EditCostModalProps {
  product: {
    id: string;
    title: string;
    sku: string | null;
    price: number;
    cost: number | null;
  };
  onClose: () => void;
}

export function EditCostModal({ product, onClose }: EditCostModalProps) {
  const [cost, setCost] = useState(product.cost?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    const numCost = parseFloat(cost);
    if (isNaN(numCost) || numCost < 0) {
      setError("Por favor ingresa un costo numérico válido mayor o igual a cero.");
      return;
    }

    setLoading(true);
    const res = await updateProductCost(product.id, numCost);
    if (!res.success) {
      setError(res.error || "Ocurrió un error al guardar el costo.");
      setLoading(false);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-md rounded-lg shadow-lg p-6 border">
        <h3 className="text-xl font-bold mb-4">Editar Costo</h3>
        
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Producto</Label>
            <p className="font-medium text-sm line-clamp-2">{product.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">SKU</Label>
              <p className="font-medium text-sm">{product.sku || "N/A"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Precio Venta</Label>
              <p className="font-medium text-sm">${product.price.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="pt-2">
            <Label htmlFor="cost">Costo del producto ($)</Label>
            <Input 
              id="cost" 
              type="number" 
              step="0.01"
              value={cost} 
              onChange={(e) => setCost(e.target.value)}
              placeholder="Ej: 1500"
              className="mt-1"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Guardando..." : "Guardar Costo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
