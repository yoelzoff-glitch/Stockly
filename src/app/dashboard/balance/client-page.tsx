"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShoppingBag,
  DollarSign,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalNotice } from "@/components/operational/notice";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { BalanceData } from "@/services/balance/getBalanceData";

interface BalanceClientPageProps {
  initialData: BalanceData | null;
  currentPeriod: string;
  fromParam?: string;
  toParam?: string;
  timezone?: string;
  errorMessage?: string | null;
}

export default function BalanceClientPage({
  initialData,
  currentPeriod,
  fromParam = "",
  toParam = "",
  timezone = "America/Argentina/Buenos_Aires",
  errorMessage = null,
}: BalanceClientPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isReconciliationOpen, setIsReconciliationOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset pagination on period or date filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentPeriod, fromParam, toParam]);

  // Custom date range state
  const [customFrom, setCustomFrom] = useState(fromParam);
  const [customTo, setCustomTo] = useState(toParam);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPeriod = e.target.value;
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set("period", nextPeriod);
    if (nextPeriod === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyCustomDates = () => {
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set("period", "custom");
    if (customFrom) params.set("from", customFrom);
    if (customTo) params.set("to", customTo);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (errorMessage || !initialData) {
    return (
      <div className="space-y-6">
        <OperationalPageHeader
          title="Balance después de Compras"
          description="Conecta los resultados de Finanzas con las compras de mercadería registradas."
        />
        <OperationalNotice
          variant="error"
          title="Error al cargar los datos del Balance"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              className="h-8 text-xs border-[#DCDAD4] bg-white text-[#101828] hover:bg-[#F5F3EE]"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reintentar
            </Button>
          }
        >
          {errorMessage || "No se pudo recuperar la información del balance. Por favor, verificá tu conexión o reintentá."}
        </OperationalNotice>
      </div>
    );
  }

  const { balance } = initialData;
  const {
    cmv,
    gananciaDespuesDeGastos,
    generadoAntesDeReinvertir,
    comprasMercaderia,
    balanceDespuesDeCompras,
    proporcionDestinadaACompras,
    comprasVsCMV,
    isProporcionEstimated,
    isComprasVsCMVEstimated,
    integrityStatus,
    integrityLabel,
    integrityExplanation,
    freightAudit,
    totalExtraCosts,
    validPurchasesCount,
    voidedPurchasesCount,
    hasIncompleteCosts,
    incompletePurchasesCount,
    discrepancies,
    processedPurchases,
  } = balance;

  // Pagination for purchases table
  const totalPurchases = processedPurchases.length;
  const totalPages = Math.max(1, Math.ceil(totalPurchases / pageSize));
  const paginatedPurchases = processedPurchases.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const isBalancePositive = balanceDespuesDeCompras > 0;
  const isBalanceNegative = balanceDespuesDeCompras < 0;

  // Format purchase date strictly in tenant timezone
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("es-AR", {
        timeZone: timezone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  // Safe finance link (Finances does not support custom date ranges)
  const isCustomPeriod = currentPeriod === "custom";
  const financeLinkHref = isCustomPeriod ? "/dashboard/finance" : `/dashboard/finance?period=${currentPeriod}`;

  // Status badge styling
  let statusBadgeVariant: "success" | "warning" | "info" = "success";
  let StatusBadgeIcon = CheckCircle2;
  if (
    integrityStatus === "partial_costs" ||
    integrityStatus === "freight_unverified" ||
    integrityStatus === "freight_discrepancy" ||
    integrityStatus === "items_discrepancy"
  ) {
    statusBadgeVariant = "warning";
    StatusBadgeIcon = AlertTriangle;
  } else if (integrityStatus === "freight_prorated") {
    statusBadgeVariant = "info";
    StatusBadgeIcon = AlertCircle;
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <OperationalPageHeader
        title="Balance después de Compras"
        description="Evalúa cuánto del resultado de tus ventas queda disponible tras reponer o ampliar inventario."
        status={
          <StatusBadge variant={statusBadgeVariant}>
            <StatusBadgeIcon className="w-3 h-3 mr-1 shrink-0" />
            {integrityLabel}
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
              <option value="custom">Personalizado</option>
            </select>

            <Link href={financeLinkHref} title={isCustomPeriod ? "Finanzas no admite filtros personalizados; abre vista general" : undefined}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
              >
                <DollarSign className="w-3.5 h-3.5 mr-1" />
                {isCustomPeriod ? "Ir a Finanzas (Vista Estándar)" : "Ir a Finanzas"}
              </Button>
            </Link>

            <Link href="/dashboard/purchases">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
              >
                <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                Gestionar Compras
              </Button>
            </Link>
          </div>
        }
      />

      {/* Custom date range selector when period === 'custom' */}
      {currentPeriod === "custom" && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-[#FCFCFA] rounded-lg border border-[#DCDAD4] text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5F6875]" />
            <span className="font-semibold text-[#101828]">Rango de fechas (Zona: {timezone}):</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#5F6875]">Desde:</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded border border-[#DCDAD4] px-2 text-xs bg-white text-[#101828]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[#5F6875]">Hasta:</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded border border-[#DCDAD4] px-2 text-xs bg-white text-[#101828]"
            />
          </div>
          <Button
            size="sm"
            onClick={applyCustomDates}
            className="h-8 bg-[#102A56] hover:bg-[#0B1E3D] text-white text-xs px-3"
          >
            Aplicar Filtro
          </Button>
        </div>
      )}

      {/* 2. Mandatory Operational Notice (Req 4) */}
      <div className="rounded-lg border border-[#B9D5FF] bg-[#F0F5FF] p-3 text-xs text-[#102A56] flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-[#102A56] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Alcance operativo:</strong> Compara el resultado de las ventas con las compras registradas del período. Puede diferir del dinero disponible por cobros pendientes y compras aún no pagadas.
        </p>
      </div>

      {/* Incomplete Costs Warning Notice */}
      {hasIncompleteCosts && (
        <OperationalNotice
          variant="warning"
          title="Compras con costos pendientes o desconocidos"
          action={
            <Link href="/dashboard/purchases">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-[#DCDAD4] bg-[#FFFFFF] text-[#101828] hover:bg-[#F5F3EE]"
              >
                Completar costos en Compras
              </Button>
            </Link>
          }
        >
          {`Se encontraron ${incompletePurchasesCount} compra(s) del período con costo unitario no registrado. El balance presentado es un cálculo parcial y la inversión real en mercadería podría ser superior.`}
        </OperationalNotice>
      )}

      {/* Freight Reconciliation Notice (Supervisor check) */}
      {freightAudit.status !== "none" && freightAudit.status !== "reconciled" && (
        <OperationalNotice
          variant={freightAudit.status === "prorated_estimate" ? "info" : "warning"}
          title={
            freightAudit.status === "prorated_estimate"
              ? "Prorrateo de fletes en rango personalizado"
              : freightAudit.status === "unverified"
              ? "Fletes de compras sin imputación en Finanzas"
              : "Discrepancia en conciliación de fletes"
          }
        >
          {freightAudit.reason}
        </OperationalNotice>
      )}

      {/* Discrepancies Warning Notice */}
      {discrepancies.length > 0 && (
        <OperationalNotice
          variant="info"
          title="Discrepancia de conciliación histórica detectada"
        >
          {`Existen ${discrepancies.length} orden(es) donde la suma de los artículos difiere del total de cabecera menos flete. Se utilizó la suma itemizada para máxima trazabilidad.`}
        </OperationalNotice>
      )}

      {/* 3. Three Main Metric Cards (Req 5) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Generado antes de reinvertir */}
        <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">
                Generado antes de reinvertir
              </span>
              <span className="text-[10px] font-semibold bg-[#F5F3EE] text-[#5F6875] px-2 py-0.5 rounded">
                Ganancia después de gastos + CMV
              </span>
            </div>
            <div
              className="text-3xl font-extrabold font-mono text-[#101828] mt-2"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              ${generadoAntesDeReinvertir.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-[#5F6875] mt-1">
              Dinero generado por las ventas antes de reponer inventario.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="font-sans">Ganancia después de gastos:</span>
              <span className="font-semibold text-[#101828]">
                ${gananciaDespuesDeGastos.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans">(+) Costo de mercadería vendida (CMV):</span>
              <span className="font-semibold text-[#101828]">
                +${cmv.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Compras de mercadería */}
        <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">
                Compras de mercadería
              </span>
              <span className="text-[10px] font-semibold bg-[#F5F3EE] text-[#5F6875] px-2 py-0.5 rounded">
                {validPurchasesCount} compra{validPurchasesCount === 1 ? "" : "s"} válida{validPurchasesCount === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className="text-3xl font-extrabold font-mono text-[#D92D20] mt-2"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              -${comprasMercaderia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-[#5F6875] mt-1">
              Inversión neta en artículos comprados para stock.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875] space-y-1">
            <div className="flex justify-between font-mono">
              <span className="font-sans">Fletes contabilizados en Finanzas:</span>
              <span className="font-semibold text-[#5F6875]">
                ${totalExtraCosts.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-[10px] text-[#5F6875] italic">
              Los fletes ya fueron descontados en gastos mensuales para evitar doble cómputo.
            </p>
          </div>
        </div>

        {/* Card 3: Balance después de compras */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between shadow-sm ${
            isBalancePositive
              ? "border-[#102A56] bg-[#102A56] text-[#FFFFFF]"
              : isBalanceNegative
              ? "border-[#D92D20]/40 bg-[#FEF3F2] text-[#912018]"
              : "border-[#DCDAD4] bg-[#FFFFFF] text-[#101828]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${
                  isBalancePositive ? "text-slate-300" : isBalanceNegative ? "text-[#912018]" : "text-[#5F6875]"
                }`}
              >
                Balance después de compras
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isBalancePositive
                    ? "bg-[#FFFFFF]/20 text-[#FFFFFF]"
                    : isBalanceNegative
                    ? "bg-[#D92D20] text-[#FFFFFF]"
                    : "bg-[#DCDAD4] text-[#101828]"
                }`}
              >
                {isBalancePositive ? "Superávit" : isBalanceNegative ? "Reinversión neta" : "Equilibrado"}
              </span>
            </div>
            <div
              className={`text-3xl font-extrabold font-mono mt-2 ${
                isBalancePositive ? "text-[#FFFFFF]" : isBalanceNegative ? "text-[#D92D20]" : "text-[#101828]"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {isBalanceNegative ? "-" : ""}${Math.abs(balanceDespuesDeCompras).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
            <p className={`text-xs mt-1 ${isBalancePositive ? "text-slate-300" : isBalanceNegative ? "text-[#912018]" : "text-[#5F6875]"}`}>
              {isBalancePositive
                ? "Resultado positivo remanente luego de cubrir la mercadería comprada."
                : isBalanceNegative
                ? "Las compras superaron lo generado en el período."
                : "Reposición equivalente a lo generado por las ventas."}
            </p>
          </div>

          <div
            className={`mt-4 pt-3 border-t text-[11px] ${
              isBalancePositive ? "border-white/20 text-slate-300" : isBalanceNegative ? "border-[#FECDCA] text-[#912018]" : "border-[#DCDAD4] text-[#5F6875]"
            }`}
          >
            {isBalanceNegative ? (
              <p className="leading-tight">
                <strong>Nota contable:</strong> Una mayor compra de mercadería amplía o renueva inventario y reduce el balance del período sin implicar que el negocio haya perdido rentabilidad en sus ventas.
              </p>
            ) : (
              <p className="leading-tight">
                Equivale a: Generado antes de reinvertir (${generadoAntesDeReinvertir.toLocaleString("es-AR", { maximumFractionDigits: 0 })}) menos Compras (${comprasMercaderia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4. Collapsible Reconciliation Section (Req 5) */}
      <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIsReconciliationOpen(!isReconciliationOpen)}
          className="w-full px-5 py-4 flex items-center justify-between bg-[#FCFCFA] hover:bg-[#F5F3EE] transition-colors border-b border-[#DCDAD4]"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#101828]">
              Conciliación Paso a Paso de Importes
            </span>
            <span className="text-xs text-[#5F6875]">
              (Composición contable exacta)
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-[#102A56]">
            <span>{isReconciliationOpen ? "Ocultar" : "Ver detalle"}</span>
            {isReconciliationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isReconciliationOpen && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
              <div className="rounded-lg bg-[#FCFCFA] p-3 border border-[#DCDAD4]">
                <span className="text-[10px] font-bold uppercase text-[#5F6875] block">
                  Ganancia después de gastos
                </span>
                <span className="text-lg font-bold font-mono text-[#101828] mt-1 block">
                  ${gananciaDespuesDeGastos.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-[#5F6875]">Finanzas (Bolsillo)</span>
              </div>

              <div className="flex items-center justify-center font-bold text-lg text-[#5F6875]">
                +
              </div>

              <div className="rounded-lg bg-[#FCFCFA] p-3 border border-[#DCDAD4]">
                <span className="text-[10px] font-bold uppercase text-[#5F6875] block">
                  Costo de Mercadería Vendida (CMV)
                </span>
                <span className="text-lg font-bold font-mono text-[#101828] mt-1 block">
                  ${cmv.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-[#5F6875]">Costo recuperado</span>
              </div>

              <div className="flex items-center justify-center font-bold text-lg text-[#5F6875]">
                =
              </div>

              <div className="rounded-lg bg-[#F0F5FF] p-3 border border-[#B9D5FF]">
                <span className="text-[10px] font-bold uppercase text-[#102A56] block">
                  Generado antes de reinvertir
                </span>
                <span className="text-lg font-bold font-mono text-[#102A56] mt-1 block">
                  ${generadoAntesDeReinvertir.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-[#102A56]">Total ventas disponible</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center pt-2">
              <div className="rounded-lg bg-[#F0F5FF] p-3 border border-[#B9D5FF]">
                <span className="text-[10px] font-bold uppercase text-[#102A56] block">
                  Generado antes de reinvertir
                </span>
                <span className="text-lg font-bold font-mono text-[#102A56] mt-1 block">
                  ${generadoAntesDeReinvertir.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
              </div>

              <div className="flex items-center justify-center font-bold text-lg text-[#D92D20]">
                -
              </div>

              <div className="rounded-lg bg-[#FEF3F2] p-3 border border-[#FECDCA]">
                <span className="text-[10px] font-bold uppercase text-[#912018] block">
                  Compras de mercadería
                </span>
                <span className="text-lg font-bold font-mono text-[#D92D20] mt-1 block">
                  ${comprasMercaderia.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-[#912018]">Artículos de compras válidas</span>
              </div>

              <div className="flex items-center justify-center font-bold text-lg text-[#5F6875]">
                =
              </div>

              <div
                className={`rounded-lg p-3 border ${
                  isBalancePositive
                    ? "bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]"
                    : isBalanceNegative
                    ? "bg-[#FEF3F2] border-[#FECDCA] text-[#912018]"
                    : "bg-[#F8FAFC] border-[#DCDAD4] text-[#101828]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase block">
                  Balance después de compras
                </span>
                <span className="text-lg font-bold font-mono mt-1 block">
                  {isBalanceNegative ? "-" : ""}${Math.abs(balanceDespuesDeCompras).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px]">Resultado final del período</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#DCDAD4] text-xs">
              <p className="text-[#5F6875]">
                Para auditar órdenes de venta individuales o cargar nuevos gastos mensuales, visitá Finanzas. Para dar de alta facturas de compra, visitá Compras Internas.
              </p>
              <div className="flex items-center gap-3 mt-2 sm:mt-0">
                <Link
                  href={financeLinkHref}
                  className="font-semibold text-[#102A56] hover:underline inline-flex items-center gap-1"
                >
                  Ver módulo Finanzas <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/dashboard/purchases"
                  className="font-semibold text-[#102A56] hover:underline inline-flex items-center gap-1"
                >
                  Ver módulo Compras <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Secondary Indicators (Req 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Proporción destinada a compras */}
        <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875] block">
                Proporción destinada a compras
              </span>
              {isProporcionEstimated && (
                <span className="text-[10px] font-semibold text-[#B54708] bg-[#FFF9EB] px-1.5 py-0.5 rounded">
                  {hasIncompleteCosts ? "Parcial" : "Estimado"}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-mono text-[#101828] mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {proporcionDestinadaACompras !== null ? `${proporcionDestinadaACompras}%` : "No aplica"}
            </div>
            <p className="text-xs text-[#5F6875] mt-1">
              {proporcionDestinadaACompras !== null
                ? isProporcionEstimated
                  ? "Cálculo preliminar del porcentaje generado reinvertido en stock (sujeto a conciliación)."
                  : "Porcentaje de lo generado en el período reinvertido en compra de stock."
                : "No aplica porque lo generado antes de reinvertir es cero o negativo."}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#DCDAD4] text-[10px] text-[#5F6875]">
            Fórmula: Compras de mercadería / Generado antes de reinvertir × 100
          </div>
        </div>

        {/* Compras por encima / debajo del CMV */}
        <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875] block">
                Compras vs. CMV
              </span>
              {isComprasVsCMVEstimated && (
                <span className="text-[10px] font-semibold text-[#B54708] bg-[#FFF9EB] px-1.5 py-0.5 rounded">
                  {hasIncompleteCosts ? "Parcial" : "Estimado"}
                </span>
              )}
            </div>
            <div
              className={`text-2xl font-bold font-mono mt-1 ${
                comprasVsCMV > 0 ? "text-[#102A56]" : comprasVsCMV < 0 ? "text-[#5F6875]" : "text-[#101828]"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {comprasVsCMV > 0 ? "+" : ""}${comprasVsCMV.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-[#5F6875] mt-1">
              {comprasVsCMV > 0
                ? "Se compró un importe superior al costo de lo vendido en el período."
                : comprasVsCMV < 0
                ? "Se compró un importe menor al costo de lo vendido en el período."
                : "La reposición de compras igualó exactamente al CMV."}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#DCDAD4] text-[10px] text-[#5F6875]">
            Comparación de importes. No equivale automáticamente a cambio físico de stock por variaciones de precio y mezcla de productos.
          </div>
        </div>

        {/* Fletes / Extras en Finanzas */}
        <div className="rounded-xl border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875] block">
                Fletes y extras en Finanzas
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                freightAudit.status === "reconciled" || freightAudit.status === "none"
                  ? "bg-[#ECFDF3] text-[#067647]"
                  : freightAudit.status === "prorated_estimate"
                  ? "bg-[#F0F5FF] text-[#102A56]"
                  : "bg-[#FFF9EB] text-[#B54708]"
              }`}>
                {freightAudit.status === "reconciled" || freightAudit.status === "none"
                  ? "Verificado"
                  : freightAudit.status === "prorated_estimate"
                  ? "Prorrateado"
                  : "Discrepancia"}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono text-[#5F6875] mt-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              ${totalExtraCosts.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-[#5F6875] mt-1">
              Costos adicionales de transporte de compras, descontados como Gastos de Estructura.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-[#DCDAD4] text-[10px] text-[#5F6875]">
            Impacta una única vez dentro de la Ganancia Limpia de Bolsillo de Finanzas.
          </div>
        </div>
      </div>

      {/* 6. Purchases Detail Table (Req 5) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Detalle de Compras del Período</h3>
            <p className="text-xs text-[#5F6875]">
              Órdenes de compra consideradas en el cálculo ({validPurchasesCount} activas
              {voidedPurchasesCount > 0 ? `, ${voidedPurchasesCount} anulada(s)` : ""}). Fechas en zona horaria: {timezone}.
            </p>
          </div>
          <Link href="/dashboard/purchases">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-[#DCDAD4] bg-white text-[#101828] hover:bg-[#F5F3EE]"
            >
              <ShoppingBag className="w-3.5 h-3.5 mr-1" />
              Nueva Compra
            </Button>
          </Link>
        </div>

        <DataTableShell
          isEmpty={processedPurchases.length === 0}
          emptyState={
            <OperationalEmptyState
              title="Sin compras registradas en este período"
              description="No se encontraron órdenes de compra durante el rango de fechas seleccionado."
            />
          }
        >
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Proveedor</th>
                <th className="px-3 py-2.5 text-right">Mercadería</th>
                <th className="px-3 py-2.5 text-right">Flete / Extras</th>
                <th className="px-3 py-2.5 text-right">Total Compra</th>
                <th className="px-3 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCDAD4]">
              {paginatedPurchases.map((po) => {
                const isVoided = po.isVoided;
                return (
                  <tr
                    key={po.id}
                    className={`hover:bg-[#F8FAFC] transition-colors ${
                      isVoided ? "opacity-60 bg-[#FAFAFA]" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-[#5F6875]">
                      {formatDate(po.purchaseDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#101828] truncate max-w-[180px]">
                        {po.supplier_name}
                      </div>
                      <div className="text-[10px] text-[#5F6875]">
                        {po.itemsCount} artículo{po.itemsCount === 1 ? "" : "s"}
                        {po.discrepancyNote && (
                          <span className="text-[#B54708] ml-1">({po.discrepancyNote})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold">
                      {po.merchandiseCost !== null ? (
                        <span className={isVoided ? "line-through text-[#5F6875]" : "text-[#101828]"}>
                          ${po.merchandiseCost.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-[#B54708] bg-[#FFF9EB] px-1.5 py-0.5 rounded text-[10px]">
                          Costo pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[#5F6875]">
                      {po.extraCosts > 0 ? (
                        `$${po.extraCosts.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-[#101828]">
                      {po.totalAmount !== null ? (
                        <span className={isVoided ? "line-through text-[#5F6875]" : ""}>
                          ${po.totalAmount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {isVoided ? (
                        <StatusBadge variant="danger" dot={false}>
                          Anulada
                        </StatusBadge>
                      ) : po.hasIncompleteCost ? (
                        <StatusBadge variant="warning" dot={true}>
                          Incompleta
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="success" dot={true}>
                          Completada
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/dashboard/purchases"
                        className="text-xs font-semibold text-[#102A56] hover:underline"
                      >
                        Ver en Compras
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Table Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#DCDAD4] bg-[#FCFCFA] text-xs">
              <span className="text-[#5F6875]">
                Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, totalPurchases)} de {totalPurchases} compras
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs border-[#DCDAD4] bg-white text-[#101828] disabled:opacity-50"
                >
                  Anterior
                </Button>
                <span className="font-semibold text-[#101828] px-1">
                  Pág. {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 text-xs border-[#DCDAD4] bg-white text-[#101828] disabled:opacity-50"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </DataTableShell>
      </div>
    </div>
  );
}
