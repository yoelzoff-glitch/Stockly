import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";

interface SalesCardProps {
  amount: number;
}

export function SalesCard({ amount }: SalesCardProps) {
  // Format the amount as currency
  const formatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Ventas hoy</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatted}</div>
        <p className="text-xs text-muted-foreground">
          Ingresos registrados hoy
        </p>
      </CardContent>
    </Card>
  );
}
