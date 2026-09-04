"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, AlertTriangle, CheckCircle2, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalNotice } from "@/components/operational/notice";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { FinancialData } from "@/services/finance/getFinancialData";

export default function FinanceClientPage({
  financials,
  currentPeriod,
  comparisonData
}: {
  financials: FinancialData;
  currentPeriod: string;
  comparisonData?: {
    label: string;
    prevFacturacionBruta: number;
    prevGananciaNeta: number;
    prevCancellationsAmount: number;
  } | null;
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

  const showComparison = currentPeriod === "current_month" && comparisonData;

  const renderComparisonIndicator = (current: number, previous: number) => {
    if (!showComparison || !comparisonData) return null;

    let percent = 0;
    if (previous > 0) {
      percent = ((current - previous) / previous) * 100;
    } else if (previous === 0 && current > 0) {
      percent = 100;
    } else if (previous === 0 && current === 0) {
      percent = 0;
    } else if (previous < 0) {
      percent = ((current - previous) / Math.abs(previous)) * 100;
    }

    const formattedPercent = percent.toFixed(1).replace(".", ",");
    const isPositive = percent > 0;
    const isZero = percent === 0;

    const colorClass = isZero
      ? "text-[#5F6875]"
      : isPositive
        ? "text-[#198754]"
        : "text-[#D92D20]";

    const sign = isPositive ? "+" : "";

    return (
      <span className={`text-xs font-semibold ${colorClass} inline-flex items-center gap-0.5`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : !isZero ? <TrendingDown className="w-3 h-3" /> : null}
        {sign}{formattedPercent}%
      </span>
    );
  };

  let accuracyLabel = "Alta";
  let accuracyVariant: "success" | "warning" | "danger" = "success";
  let AccuracyIcon = CheckCircle2;

  if (costAccuracyPercent < 70) {
    accuracyLabel = "Baja";
    accuracyVariant = "danger";
    AccuracyIcon = AlertCircle;
  } else if (costAccuracyPercent < 95) {
    accuracyLabel = "Media";
    accuracyVariant = "warning";
    AccuracyIcon = AlertTriangle;
  }

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Producto,SKU,Unidades Vendidas,Facturacion,Costo,Comision,Envio,Promos,Ganancia Neta,Margen %\n";
    tableData.forEach(row => {
      const line = `"${row.title.replace(/"/g, '""')}",${row.sku || ""},${row.qty},${row.revenue},${row.cost},${row.fee},${row.shipping},${row.extra},${row.neta},${row.marg.toFixed(2)}`;
      csvContent += line + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finanzas_rentabilidad_${currentPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const topMetricItems: MetricItem[] = [
    {
      label: "Facturación Bruta",
      value: `$${facturacionBruta.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: showComparison && comparisonData ? `vs. ${comparisonData.label}` : "Total facturado"
    },
    {
      label: "Costos CMV",
      value: `-$${costosProductos.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Costo mercadería vendida"
    },
    {
      label: "Comisiones ML",
      value: `-$${comisionesML.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Cargos de marketplace"
    },
    {
      label: "Costos de Envío",
      value: `-$${envios.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Flete asumido por vendedor"
    },
    {
      label: "Cancelaciones",
      value: `$${cancelacionesAmount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Ventas anuladas / devoluciones"
    }
  ];

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Finanzas y Rentabilidad"
        description="Resumen de facturación, estructura de costos operativos y margen neto del negocio."
        status={
          <StatusBadge variant={accuracyVariant}>
            <AccuracyIcon className="w-3 h-3 mr-1 shrink-0" />
            Precisión de Costos: {accuracyLabel} ({costAccuracyPercent.toFixed(0)}%)
          </StatusBadge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={currentPeriod}
              onChange={handlePeriodChange}
              className="h-9 rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-[#101828] shadow-sm focus:border-[#102A56] focus:outline-none focus:ring-1 focus:ring-[#102A56]"
            >
              <option value="current_month">Mes Actual</option>
              <option value="last_month">Mes Anterior</option>
              <option value="last_30">Últimos 30 días</option>
              <option value="all">Todo el historial</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="h-9 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE] hover:text-[#101828]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV
            </Button>
          </div>
        }
      />

      {costAccuracyPercent < 95 && totalUnitsSold > 0 && (
        <OperationalNotice
          variant="warning"
          title="Precisión de cálculo comprometida"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/settings/costs")}
              className="h-7 text-xs border-[#DCDAD4] bg-[#FFFFFF] text-[#101828] hover:bg-[#F5F3EE]"
            >
              Asignar costos faltantes
            </Button>
          }
        >
          {`Existen ${totalUnitsSold - unitsWithCost} unidades vendidas de publicaciones sin costo registrado. La ganancia neta proyectada puede estar sobreestimada.`}
        </OperationalNotice>
      )}

      {/* Top 5 Metrics */}
      <MetricStrip metrics={topMetricItems} columns={5} />

      {/* Financial Breakdown: 4 High-Density Operational Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gastos de Estructura */}
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875] block">
              Gastos de Estructura
            </span>
            <div className="text-2xl font-bold font-mono text-[#D92D20] mt-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
              -${monthlyExpensesTotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#DCDAD4]">
            {appliedExpensesBreakdown.length > 0 ? (
              <div className="space-y-1 max-h-[50px] overflow-y-auto pr-1">
                {appliedExpensesBreakdown.map((exp, idx) => (
                  <div key={idx} className="text-[11px] text-[#5F6875] flex justify-between font-mono">
                    <span className="truncate max-w-[120px] font-sans">{exp.name}</span>
                    <span className="font-semibold text-[#101828]">-${exp.amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#5F6875]">Sin gastos mensuales aplicados</p>
            )}
          </div>
        </div>

        {/* Cupones y Promos */}
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875] block">
              Descuentos y Cupones
            </span>
            <div className="text-2xl font-bold font-mono text-[#D92D20] mt-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
              -${(totalCupones + promosCuotas).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#DCDAD4]">
            <p className="text-[11px] text-[#5F6875]">
              Cupones cofinanciados y promociones comerciales
            </p>
          </div>
        </div>

        {/* Ganancia Operativa (Neta) */}
        <div className={`rounded-lg border p-4 flex flex-col justify-between ${
          gananciaNeta >= 0
            ? "border-[#DCDAD4] bg-[#FFFFFF]"
            : "border-[#D92D20]/30 bg-[#FEF3F2]"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875] block">
                Ganancia Operativa (Neta)
              </span>
              <StatusBadge variant={gananciaNeta >= 0 ? "success" : "danger"}>
                Margen {margenNeto.toFixed(1)}%
              </StatusBadge>
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-1.5 ${
                gananciaNeta >= 0 ? "text-[#198754]" : "text-[#D92D20]"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {gananciaNeta < 0 ? "-" : ""}${Math.abs(gananciaNeta).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#DCDAD4] flex items-center justify-between text-[11px]">
            <span className="text-[#5F6875]">Evolución período</span>
            {showComparison && comparisonData && renderComparisonIndicator(gananciaNeta, comparisonData.prevGananciaNeta)}
          </div>
        </div>

        {/* Ganancia Limpia de Bolsillo (Caja) */}
        <div className="rounded-lg border border-[#102A56] bg-[#102A56] p-4 text-[#FFFFFF] flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 block">
                Ganancia Limpia de Caja
              </span>
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#FFFFFF]/15 text-[#FFFFFF]">
                Bolsillo Real
              </span>
            </div>
            <div className="text-2xl font-bold font-mono mt-1.5 text-[#FFFFFF]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {gananciaBolsilloLimpia < 0 ? "-" : ""}${Math.abs(gananciaBolsilloLimpia).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-slate-300">
            <span>Margen de Caja:</span>
            <span className="font-mono font-bold text-[#FFFFFF]">
              {(facturacionBruta > 0 ? (gananciaBolsilloLimpia / facturacionBruta) * 100 : 0).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Operational Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Rentabilidad por Producto Vendido</h3>
            <p className="text-xs text-[#5F6875]">Desglose de facturación, costos unitarios, comisiones y margen neto por publicación ({tableData.length} productos).</p>
          </div>
        </div>

        <DataTableShell
          isEmpty={tableData.length === 0}
          emptyState={
            <OperationalEmptyState
              title="Sin transacciones financieras en este período"
              description="No se registraron ventas con impacto contable durante las fechas seleccionadas."
            />
          }
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                <th className="px-4 py-2.5">Producto & SKU</th>
                <th className="px-3 py-2.5 text-right">Cant.</th>
                <th className="px-3 py-2.5 text-right">Facturación</th>
                <th className="px-3 py-2.5 text-right">Costo Unit.</th>
                <th className="px-3 py-2.5 text-right">Comisión</th>
                <th className="px-3 py-2.5 text-right">Envío</th>
                <th className="px-3 py-2.5 text-right">Extra</th>
                <th className="px-3 py-2.5 text-right">Ganancia Neta</th>
                <th className="px-4 py-2.5 text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
              {tableData.map((row, i) => {
                const isPositive = row.neta >= 0;
                return (
                  <tr key={i} className="hover:bg-[#F5F3EE]/50 transition-colors">
                    <td className="px-4 py-2.5 max-w-[240px]">
                      <div className="font-medium text-[#101828] truncate" title={row.title}>
                        {row.title}
                      </div>
                      <div className="text-[11px] font-mono text-[#5F6875] mt-0.5">
                        {row.sku || "Sin SKU"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.qty}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${row.revenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.cost > 0 ? (
                        `$${row.cost.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                      ) : (
                        <StatusBadge variant="danger">Sin costo</StatusBadge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      -${row.fee.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      -${row.shipping.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.extra > 0 ? `-$${row.extra.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "$0"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono font-semibold ${
                        isPositive ? "text-[#198754]" : "text-[#D92D20]"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {row.neta < 0 ? "-" : ""}${Math.abs(row.neta).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        isPositive ? "text-[#198754]" : "text-[#D92D20]"
                      }`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {row.marg.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {tableData.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#DCDAD4] bg-[#FCFCFA] font-semibold text-xs text-[#101828]">
                  <td className="px-4 py-3">TOTALES DEL PERÍODO</td>
                  <td className="px-3 py-3 text-right font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {totalUnitsSold}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${facturacionBruta.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${costosProductos.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${comisionesML.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${envios.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${promosCuotas.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-mono font-bold ${
                      gananciaNeta >= 0 ? "text-[#198754]" : "text-[#D92D20]"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {gananciaNeta < 0 ? "-" : ""}${Math.abs(gananciaNeta).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-bold ${
                      gananciaNeta >= 0 ? "text-[#198754]" : "text-[#D92D20]"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {margenNeto.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </DataTableShell>
      </div>
    </div>
  );
}
