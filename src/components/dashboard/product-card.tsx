import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

interface ProductCardProps {
  name: string;
  quantity: number;
}

export function ProductCard({ name, quantity }: ProductCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Más vendido</CardTitle>
        <Package className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold line-clamp-1">{name}</div>
        <p className="text-xs text-muted-foreground">
          {quantity} unidades vendidas
        </p>
      </CardContent>
    </Card>
  );
}
