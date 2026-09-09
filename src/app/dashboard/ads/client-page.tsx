"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, AlertCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { getAdsDataAction } from "./actions";
import { AdsDataResult } from "@/services/meli/ads/types";

interface AdsClientPageProps {
  initialAdsData: AdsDataResult;
}

export function AdsClientPage({ initialAdsData }: AdsClientPageProps) {
  const [adsData, setAdsData] = useState<AdsDataResult>(initialAdsData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30days");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handlePeriodChange = async (periodKey: string) => {
    setSelectedPeriod(periodKey);
    setIsRefreshing(true);
    try {
      const freshData = await getAdsDataAction(periodKey);
      setAdsData(freshData);
    } catch (err) {
      console.error("Failed to load fresh ads data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    handlePeriodChange(selectedPeriod);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "—";
    return `$${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return `${val.toFixed(1)}%`;
  };

  const formatRoas = (roas: number | null | undefined) => {
    if (roas === null || roas === undefined || isNaN(roas) || roas === 0) return "—";
    return `${roas.toFixed(2)}x`;
  };

  const filteredProducts = (adsData.productAdsList || []).filter((p) => {
    const matchesSearch =
      searchTerm === "" ||
      (p.title && p.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "profitable") return matchesSearch && p.profitability_status === "complete";
    if (statusFilter === "warning") return matchesSearch && p.clean_net_margin_percent !== null && p.clean_net_margin_percent < 15;
    if (statusFilter === "loss") return matchesSearch && p.clean_net_profit !== null && p.clean_net_profit < 0;
    if (statusFilter === "missing_cost") return matchesSearch && p.profitability_status === "missing_cost";
    return matchesSearch;
  });

  const metricItems: MetricItem[] = [
    {
      label: "Inversión Publicitaria",
      value: formatCurrency(adsData.totals?.investment ?? adsData.totalAdsInvestment),
      subtext: "Gasto publicitario acumulado",
    },
    {
      label: "Ventas / Facturación Atribuida",
      value: formatCurrency(adsData.totals?.revenue ?? adsData.totalAdsRevenue),
      subtext: "Ingresos originados por anuncios",
    },
    {
      label: "ROAS General",
      value: formatRoas(adsData.totals?.overallRoas ?? adsData.overallRoas),
      subtext: "Retorno de inversión en pauta",
    },
    {
      label: "ACOS Promedio",
      value: formatPercent(adsData.totals?.averageAcos ?? adsData.averageAcos),
      subtext: "Porcentaje de costo sobre facturación",
    },
    {
      label: "Ganancia Neta Real",
      value: formatCurrency(adsData.totals?.cleanNetProfit ?? adsData.totalCleanNetProfit),
      subtext: "Resultado limpio tras CMV, fees y ads",
    },
  ];

  const getStatusBadge = () => {
    if (adsData.availability && !adsData.availability.available) {
      const reason = adsData.availability.reason;
      if (reason === "advertising_permission_missing") {
        return <StatusBadge variant="warning">Permiso Publicidad requerido</StatusBadge>;
      }
      if (reason === "product_ads_not_enabled") {
        return <StatusBadge variant="neutral">Product Ads no habilitado</StatusBadge>;
      }
      if (reason === "auth_error") {
        return <StatusBadge variant="danger">Sesión expirada</StatusBadge>;
      }
      return <StatusBadge variant="danger">Error temporal</StatusBadge>;
    }

    return (
      <StatusBadge variant="success">
        Métricas en vivo
      </StatusBadge>
    );
  };

  const renderNoticeBanner = () => {
    if (!adsData.availability || adsData.availability.available) return null;

    const reason = adsData.availability.reason;

    if (reason === "advertising_permission_missing") {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Mercado Libre no autorizó acceso a Publicidad para esta aplicación.</h4>
              <p className="text-xs text-amber-800 mt-1">
                Para ver el rendimiento oficial de tus campañas, activá el permiso de <strong>Publicidad</strong> en el portal de desarrolladores de Mercado Libre (Mis aplicaciones → LibretaX → Permisos funcionales → Publicidad).
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/integrations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 shrink-0 transition-colors"
          >
            Revisar integración
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      );
    }

    if (reason === "product_ads_not_enabled") {
      return (
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FCFCFA] p-4 text-[#101828] flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#5F6875] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold">Esta cuenta de Mercado Libre todavía no tiene Product Ads habilitado.</h4>
            <p className="text-xs text-[#5F6875] mt-1">
              Podés habilitar tus campañas publicitarias directamente desde el administrador de Mercado Ads en Mercado Libre.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold">No pudimos obtener las métricas publicitarias en este momento.</h4>
            <p className="text-xs text-red-800 mt-1">
              {adsData.availability.message || "Ocurrió un problema de comunicación con los servicios de Mercado Libre Advertising."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-8 border-red-300 bg-white text-xs font-semibold text-red-900 hover:bg-red-100 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Reintentar
        </Button>
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Mercado Libre Product Ads"
        description="Seguimiento de inversión publicitaria, atribución de ventas, ROAS y rentabilidad neta por anuncio."
        status={getStatusBadge()}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-[#DCDAD4] bg-[#FFFFFF] p-0.5 text-xs">
              {[
                { key: "30days", label: "Últimos 30 días" },
                { key: "this_month", label: "Este mes" },
                { key: "last_month", label: "Mes anterior" },
                { key: "7days", label: "7 días" },
                { key: "today", label: "Hoy" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handlePeriodChange(tab.key)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    selectedPeriod === tab.key
                      ? "bg-[#102A56] text-white"
                      : "text-[#5F6875] hover:text-[#101828]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        }
      />

      {renderNoticeBanner()}

      <MetricStrip metrics={metricItems} columns={5} />

      {/* Campaigns Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Campañas Publicitarias</h3>
            <p className="text-xs text-[#5F6875]">Presupuestos asignados, consumo e ingresos generados por cada campaña de Product Ads.</p>
          </div>
          <span className="text-xs font-mono text-[#5F6875]">{(adsData.campaigns || []).length} campañas</span>
        </div>
        <DataTableShell>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Campaña & ID</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-right">Presupuesto Diario</th>
                  <th className="px-3 py-2.5 text-right">Inversión</th>
                  <th className="px-3 py-2.5 text-right">Impresiones</th>
                  <th className="px-3 py-2.5 text-right">Clicks</th>
                  <th className="px-3 py-2.5 text-center">Ventas Ads</th>
                  <th className="px-3 py-2.5 text-right">Facturación Atribuida</th>
                  <th className="px-4 py-2.5 text-center">ROAS / ACOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {(adsData.campaigns || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <OperationalEmptyState
                        title={
                          adsData.availability && !adsData.availability.available
                            ? "Datos de Product Ads no disponibles"
                            : "No hay campañas de Product Ads para este período."
                        }
                        description={
                          adsData.availability && !adsData.availability.available
                            ? (adsData.availability.message || "No se pudo consultar Mercado Libre Ads.")
                            : "No se detectaron campañas de Product Ads activas en el período seleccionado."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  adsData.campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#101828]">{c.name}</div>
                        <div className="font-mono text-[10px] text-[#5F6875] mt-0.5">{c.id}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge variant={c.status === "active" ? "success" : "neutral"}>
                          {c.status === "active" ? "Activa" : "Pausada"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.daily_budget !== null && c.daily_budget !== undefined ? `${formatCurrency(c.daily_budget)}/d` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#D92D20] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(c.consumed_budget)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.impressions !== null && c.impressions !== undefined ? c.impressions.toLocaleString("es-AR") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.clics !== null && c.clics !== undefined ? c.clics.toLocaleString("es-AR") : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.units_sold !== null && c.units_sold !== undefined ? `${c.units_sold} u.` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#101828] font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(c.revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span className="font-bold text-[#101828]">{formatRoas(c.roas)} ROAS</span>
                        <span className="text-[10px] text-[#5F6875] block">({formatPercent(c.acos)} ACOS)</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      </div>

      {/* Advertised Products Table */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Publicaciones Anunciadas en Product Ads</h3>
            <p className="text-xs text-[#5F6875]">Rendimiento comercial individual, gasto de pauta y margen neto limpio por producto.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5F6875]" />
              <Input
                placeholder="Buscar publicación o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 pr-3 w-48 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-2.5 text-xs text-[#101828]"
            >
              <option value="all">Todos los estados</option>
              <option value="profitable">Rentables</option>
              <option value="warning">Margen &lt; 15%</option>
              <option value="loss">En pérdida</option>
              <option value="missing_cost">Sin costo asignado</option>
            </select>
          </div>
        </div>
        <DataTableShell>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Publicación & SKU</th>
                  <th className="px-3 py-2.5 text-right">Precio Venta</th>
                  <th className="px-3 py-2.5 text-right">Costo CMV</th>
                  <th className="px-3 py-2.5 text-center">Ventas Ads</th>
                  <th className="px-3 py-2.5 text-right">Facturación Ads</th>
                  <th className="px-3 py-2.5 text-right">Inversión Ads</th>
                  <th className="px-3 py-2.5 text-center">ACOS / ROAS</th>
                  <th className="px-4 py-2.5 text-right">Ganancia Neta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <OperationalEmptyState
                        title="No se encontraron publicaciones anunciadas"
                        description="No hay productos que coincidan con la búsqueda o filtro publicitario en el período."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const hasLoss = p.clean_net_profit !== null && p.clean_net_profit < 0;
                    return (
                      <tr key={p.product_id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                        <td className="px-4 py-2.5 max-w-[280px]">
                          <div className="flex items-center gap-2.5">
                            {p.thumbnail_url ? (
                              <img
                                src={p.thumbnail_url}
                                alt={p.title}
                                className="h-9 w-9 rounded object-cover border border-[#DCDAD4] bg-[#FCFCFA] shrink-0"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center text-[10px] font-mono text-[#5F6875] shrink-0">
                                ADS
                              </div>
                            )}
                            <div className="truncate">
                              <span className="block font-medium text-[#101828] truncate" title={p.title}>
                                {p.title}
                              </span>
                              <span className="text-[10px] font-mono text-[#5F6875] block mt-0.5">
                                {p.sku ? `SKU: ${p.sku}` : `MLA: ${p.meli_item_id}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(p.price)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#5F6875]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {p.cost !== null && p.cost !== undefined ? (
                            formatCurrency(p.cost)
                          ) : (
                            <StatusBadge variant="danger">Sin costo</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {p.ads_units_sold} u.
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(p.ads_revenue)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#D92D20] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                          -{formatCurrency(p.ads_investment)}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono" style={{ fontVariantNumeric: "tabular-nums" }}>
                          <span className="text-xs font-semibold text-[#101828]">{formatPercent(p.acos_percent)} ACOS</span>
                          <span className="text-[10px] text-[#5F6875] block">({formatRoas(p.roas)} ROAS)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {p.clean_net_profit !== null && p.clean_net_profit !== undefined ? (
                            <span className={hasLoss ? "text-[#D92D20]" : "text-[#198754]"}>
                              {formatCurrency(p.clean_net_profit)}
                            </span>
                          ) : (
                            <span className="text-[#5F6875]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      </div>
    </div>
  );
}
