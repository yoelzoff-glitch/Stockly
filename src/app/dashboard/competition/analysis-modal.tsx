"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface Snapshot {
  id: string;
  own_price: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  median_price: number;
  competitors_count: number;
  free_shipping_count: number;
  raw_results: any[];
}

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: Snapshot | null;
  productTitle: string;
}

export function AnalysisModal({ isOpen, onClose, snapshot, productTitle }: AnalysisModalProps) {
  if (!snapshot) return null;

  const diffToAvg = snapshot.own_price - snapshot.avg_price;
  const diffPercent = (diffToAvg / snapshot.avg_price) * 100;
  
  let suggestion = "Tu precio está alineado con el mercado.";
  let badgeVariant: "default" | "destructive" | "secondary" = "default";

  if (diffPercent > 10) {
    suggestion = "Estás por encima del promedio. Revisá si tu propuesta justifica el precio.";
    badgeVariant = "destructive";
  } else if (diffPercent < -10) {
    suggestion = "Estás por debajo del promedio. Podrías tener margen para subir precio.";
    badgeVariant = "secondary";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análisis de Competencia</DialogTitle>
          <DialogDescription className="line-clamp-1">{productTitle}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          <div className="flex flex-col border p-3 rounded-md">
            <span className="text-xs text-muted-foreground">Mi Precio</span>
            <span className="text-lg font-bold">${snapshot.own_price}</span>
          </div>
          <div className="flex flex-col border p-3 rounded-md">
            <span className="text-xs text-muted-foreground">Promedio (Mercado)</span>
            <span className="text-lg font-bold">${snapshot.avg_price}</span>
          </div>
          <div className="flex flex-col border p-3 rounded-md">
            <span className="text-xs text-muted-foreground">Mínimo</span>
            <span className="text-lg font-bold">${snapshot.min_price}</span>
          </div>
          <div className="flex flex-col border p-3 rounded-md">
            <span className="text-xs text-muted-foreground">Máximo</span>
            <span className="text-lg font-bold">${snapshot.max_price}</span>
          </div>
        </div>

        <div className="bg-muted/50 p-4 rounded-md mb-4 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-medium text-sm">Sugerencia IA:</span>
            <Badge variant={badgeVariant}>
              {diffPercent > 0 ? "+" : ""}{diffPercent.toFixed(1)}% vs Promedio
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{suggestion}</p>
        </div>

        <h4 className="text-sm font-semibold mb-2">Publicaciones de la competencia encontradas ({snapshot.competitors_count})</h4>
        <div className="space-y-3">
          {snapshot.raw_results.map((comp: any) => (
            <div key={comp.item_id} className="flex items-center justify-between border-b pb-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium line-clamp-1">{comp.title}</span>
                <span className="text-xs text-muted-foreground">
                  Seller ID: {comp.seller_id} | Envío gratis: {comp.free_shipping ? "Sí" : "No"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-sm">${comp.price}</span>
                <a 
                  href={comp.permalink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
