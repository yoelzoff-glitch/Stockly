"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { AnalysisModal } from "./analysis-modal";

interface CompetitionClientProps {
  products: any[];
}

export function CompetitionClient({ products }: CompetitionClientProps) {
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [selectedTitle, setSelectedTitle] = useState("");

  const handleAnalyze = async (productId: string, title: string, categoryId: string | null) => {
    setAnalyzingId(productId);
    try {
      // 1. Fetch from ML directly in the browser to bypass backend firewall
      let url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(title)}&limit=50`;
      if (categoryId) url += `&category=${categoryId}`;
      
      const mlRes = await fetch(url);
      if (!mlRes.ok) throw new Error("Mercado Libre bloqueó la consulta desde tu navegador.");
      const mlData = await mlRes.json();

      // 2. Enviar a nuestro backend para procesar y guardar
      const res = await fetch("/api/competition/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          product_id: productId, 
          raw_results: mlData.results 
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSelectedSnapshot(data.data);
      setSelectedTitle(title);
    } catch (error: any) {
      alert("Error al analizar competencia: " + error.message);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <>
      <div className="rounded-md border mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-4 font-medium">Producto</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">Precio Actual</th>
              <th className="p-4 font-medium">Stock</th>
              <th className="p-4 font-medium">Estado</th>
              <th className="p-4 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No hay productos disponibles para analizar.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-4">
                    <span className="font-medium line-clamp-1">{p.title}</span>
                  </td>
                  <td className="p-4 text-muted-foreground">{p.sku || "-"}</td>
                  <td className="p-4 font-medium">${p.price}</td>
                  <td className="p-4">{p.available_quantity}</td>
                  <td className="p-4">
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={analyzingId === p.id}
                      onClick={() => handleAnalyze(p.id, p.title, p.category_id)}
                    >
                      {analyzingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Analizar competencia
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnalysisModal 
        isOpen={!!selectedSnapshot}
        onClose={() => setSelectedSnapshot(null)}
        snapshot={selectedSnapshot}
        productTitle={selectedTitle}
      />
    </>
  );
}
