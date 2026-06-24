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
    totalCupones,
    cancellationsAmount: cancelacionesAmount,
    gananciaNeta,
    margenNeto,
    totalUnitsSold,
    unitsWithCost,
    costAccuracyPercent,
    tableData,
    monthlyExpensesTotal,
    gananciaBolsilloLimpia,
    appliedExpensesBreakdown
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1">
            <p className="text-muted-foreground">Resumen financiero y ganancia neta real del negocio.</p>
            <StatusBadge variant={accuracyLabel === "Alta" ? "success" : accuracyLabel === "Media" ? "warning" : "danger"} className="py-0 px-2 text-xs">
              <AccuracyIcon className="w-3.5 h-3.5 mr-1 shrink-0" />
              Precisión de Costos: {accuracyLabel} ({costAccuracyPercent.toFixed(0)}%)
            </StatusBadge>
          </div>
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
            <div className="text-2xl font-semibold text-slate-500">${cancelacionesAmount.toLocaleString("es-AR")}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ventas anuladas (no resta del total)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Ganancia Operativa (Neta) */}
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-150">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-850 dark:text-emerald-300 uppercase tracking-wider">
              Ganancia Operativa (Neta)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              ${gananciaNeta.toLocaleString("es-AR")}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Margen operativo: {margenNeto.toFixed(1)}%</p>
          </CardContent>
        </Card>

        {/* Card 2: Gastos de Estructura / Mensuales */}
        <Card className="relative group">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Gastos de Estructura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -${monthlyExpensesTotal.toLocaleString("es-AR")}
            </div>
            {appliedExpensesBreakdown.length > 0 ? (
              <div className="mt-1 space-y-0.5 max-h-[40px] overflow-y-auto pr-1 scrollbar-thin">
                {appliedExpensesBreakdown.map((exp, idx) => (
                  <div key={idx} className="text-[9px] text-slate-500 flex justify-between">
                    <span className="truncate max-w-[90px]">{exp.name}</span>
                    <span>-${exp.amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 mt-1">Sin gastos mensuales aplicados</p>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Ganancia Limpia de Bolsillo (Caja) */}
        <Card className="bg-gradient-to-br from-indigo-600 to-purple-650 text-white shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">
              Ganancia Limpia de Bolsillo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${gananciaBolsilloLimpia.toLocaleString("es-AR")}
            </div>
            <p className="text-[10px] text-indigo-100/90 mt-1">
              Margen de Caja: {(facturacionBruta > 0 ? (gananciaBolsilloLimpia / facturacionBruta) * 100 : 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Cupones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Descuentos por Cupones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -${totalCupones.toLocaleString("es-AR")}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Descuentos financiados en campañas de Mercado Libre
            </p>
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
                  <td className="px-4 py-4 text-right text-emerald-600">${gananciaNeta.toLocaleString("es-AR")}</td>
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
