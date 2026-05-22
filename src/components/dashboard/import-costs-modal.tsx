"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ImportCostsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportCostsModal({ onClose, onSuccess }: ImportCostsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated: number; not_found: number; errors: any[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleImport = async () => {
    if (!file) {
      setErrorMsg("Por favor, selecciona un archivo CSV.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/products/import-costs", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al procesar el archivo.");
      }

      setResult(data.result);
      if (data.result.updated > 0) {
        onSuccess(); // To refresh data if needed
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background w-full max-w-lg rounded-lg shadow-lg p-6 border">
        <h3 className="text-xl font-bold mb-4">Importar Costos</h3>
        
        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo CSV para actualizar los costos masivamente. El formato debe contener una cabecera con <code className="bg-muted px-1 rounded">sku,cost</code> o <code className="bg-muted px-1 rounded">meli_item_id,cost</code>.
            </p>
            
            <div className="pt-2">
              <Label htmlFor="csvFile">Archivo CSV</Label>
              <Input 
                id="csvFile" 
                type="file" 
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>

            {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={loading || !file}>
                {loading ? "Procesando..." : "Importar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <h4 className="font-semibold text-lg">Proceso Completado</h4>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md text-sm space-y-2">
              <p><strong>Actualizados:</strong> {result.updated} productos</p>
              <p><strong>No encontrados:</strong> {result.not_found} registros</p>
              {result.errors.length > 0 && (
                <div className="mt-2 text-red-500">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Hubo {result.errors.length} errores de formato.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
