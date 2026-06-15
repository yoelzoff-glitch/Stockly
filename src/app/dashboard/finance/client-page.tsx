"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { DollarSign, Download, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { FinancialData } from "@/services/finance/getFinancialData";

export default function FinanceClientPage({ 
  financials, 
  currentPeriod
}: { 
  financials: FinancialData;
  currentPeriod: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams);
    params.set("period", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const {
    facturacionBruta,
    costosProductos,
    comisionesML,
    envios,
    promosCuotas,
    cancellationsAmount: cancelacionesAmount,
    gananciaNeta,
    margenNeto,
    totalUnitsSold,
    unitsWithCost,
    costAccuracyPercent,
    tableData
  } = financials;

  const impuestos = 0; // default 0 for MVP

  // Accuracy
  let accuracyLabel = "Alta";
  let accuracyColor = "text-emerald-600 bg-emerald-100";
  let AccuracyIcon = CheckCircle2;

  if (costAccuracyPercent < 70) {
    accuracyLabel = "Baja";
    accuracyColor = "text-red-600 bg-red-100";
    AccuracyIcon = AlertCircle;
  } else if (costAccuracyPercent < 95) {
    accuracyLabel = "Media";
    accuracyColor = "text-amber-600 bg-amber-100";
    AccuracyIcon = AlertTriangle;
  }

  // CSV Export logic
  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Producto,SKU,Unidades Vendidas,Facturacion,Costo,Comision,Envio,Promos,Ganancia Neta,Margen %\n";
    tableData.forEach(row => {
      const line = `"${row.title}",${row.sku},${row.qty},${row.revenue},${row.cost},${row.fee},${row.shipping},${row.extra},${row.neta},${row.marg.toFixed(2)}`;
      csvContent += line + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rentabilidad_productos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Finanzas</h2>
          <p className="text-muted-foreground mt-1">Resumen financiero y ganancia neta real del negocio.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={currentPeriod} 
            onChange={handlePeriodChange}
            className="flex h-10 w-full sm:w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="current_month">Mes Actual</option>
            <option value="last_month">Mes Anterior</option>
            <option value="last_30">Últimos 30 días</option>
            <option value="all">Todo el historial</option>
          </select>
          <Button onClick={exportCSV} className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {costAccuracyPercent < 95 && totalUnitsSold > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm">Precisión del cálculo comprometida</h4>
            <p className="text-sm">
              Tenés {totalUnitsSold - unitsWithCost} unidades vendidas de productos sin costo cargado. 
              La ganancia neta mostrada está sobreestimada.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card className="bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Facturación Bruta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">${facturacionBruta.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Costos Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-500">-${costosProductos.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisiones ML</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-500">-${comisionesML.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Envíos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-500">-${envios.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cancelaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-500">-${cancelacionesAmount.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-1 lg:col-span-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 uppercase tracking-wider">Ganancia Neta Estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">${gananciaNeta.toLocaleString("es-AR")}</div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">Margen Neto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{margenNeto.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Precisión Datos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <StatusBadge variant={accuracyLabel === "Alta" ? "success" : accuracyLabel === "Media" ? "warning" : "danger"}>
              <AccuracyIcon className="w-4 h-4 mr-1.5" />
              {accuracyLabel} ({costAccuracyPercent.toFixed(0)}%)
            </StatusBadge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rentabilidad por producto vendido</CardTitle>
          <CardDescription>Desglose de costos y ganancia por cada ítem transaccionado en el periodo.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium text-right">Cant.</th>
                  <th className="px-4 py-3 font-medium text-right">Facturación</th>
                  <th className="px-4 py-3 font-medium text-right">Costo</th>
                  <th className="px-4 py-3 font-medium text-right">Comisión</th>
                  <th className="px-4 py-3 font-medium text-right">Envío</th>
                  <th className="px-4 py-3 font-medium text-right">Extra</th>
                  <th className="px-4 py-3 font-medium text-right">Ganancia Neta</th>
                  <th className="px-4 py-3 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                          <DollarSign className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No hay ventas registradas en este periodo</h3>
                        <p className="text-sm text-slate-500 mt-1">Cambia las fechas del filtro para ver tu rendimiento financiero.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 max-w-[200px] truncate" title={row.title}>
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">{row.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{row.qty}</td>
                      <td className="px-4 py-3 text-right font-medium">${row.revenue.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {row.cost > 0 ? `$${row.cost.toLocaleString("es-AR")}` : <StatusBadge variant="danger">Falta</StatusBadge>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">${row.fee.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">${row.shipping.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">${row.extra.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">${row.neta.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{row.marg.toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-muted/30 font-semibold border-t-2">
                <tr>
                  <td className="px-4 py-4">TOTALES</td>
                  <td className="px-4 py-4 text-right">{totalUnitsSold}</td>
                  <td className="px-4 py-4 text-right">${facturacionBruta.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-red-500">-${costosProductos.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-red-500">-${comisionesML.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-red-500">-${envios.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-red-500">-${promosCuotas.toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-emerald-600">${(gananciaNeta + cancelacionesAmount).toLocaleString("es-AR")}</td>
                  <td className="px-4 py-4 text-right text-emerald-600">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
