"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { getAdsDataAction } from "./actions";

interface AdsClientPageProps {
  initialAdsData: {
    campaigns: any[];
    productAdsList: any[];
    totalAdsInvestment: number | null;
    totalAdsRevenue: number | null;
    totalCleanNetProfit: number | null;
    averageAcos: number | null;
    overallRoas: number | null;
    liveAdsAvailable: boolean;
  };
}

export function AdsClientPage({ initialAdsData }: AdsClientPageProps) {
  const [adsData, setAdsData] = useState(initialAdsData);
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
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    handlePeriodChange(selectedPeriod);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || isNaN(amount)) return "—";
    return `$${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (val: number | null) => {
    if (val === null || isNaN(val)) return "—";
    return `${val.toFixed(1)}%`;
  };

  const formatRoas = (roas: number | null) => {
    if (roas === null || isNaN(roas) || roas === 0) return "—";
    return `${roas.toFixed(2)}x`;
  };

  const filteredProducts = adsData.productAdsList.filter((p) => {
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
      value: formatCurrency(adsData.totalAdsInvestment),
      subtext: "Gasto publicitario acumulado"
    },
    {
      label: "Ventas / Facturación Atribuida",
      value: formatCurrency(adsData.totalAdsRevenue),
      subtext: "Ingresos originados por anuncios"
    },
    {
      label: "ROAS General",
      value: formatRoas(adsData.overallRoas),
      subtext: "Retorno de inversión en pauta"
    },
    {
      label: "ACOS Promedio",
      value: formatPercent(adsData.averageAcos),
      subtext: "Porcentaje de costo sobre facturación"
    },
    {
      label: "Ganancia Neta Real",
      value: formatCurrency(adsData.totalCleanNetProfit),
      subtext: "Resultado limpio tras CMV, fees y ads"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Mercado Libre Product Ads"
        description="Seguimiento de inversión publicitaria, atribución de ventas, ROAS y rentabilidad neta por anuncio."
        status={
          <StatusBadge variant={adsData.liveAdsAvailable ? "success" : "neutral"}>
            {adsData.liveAdsAvailable ? "Métricas en vivo" : "Sincronización estándar"}
          </StatusBadge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-md border border-[#DCDAD4] bg-[#FFFFFF] p-0.5 text-xs">
              {[
                { key: "30days", label: "Últimos 30 días" },
                { key: "this_month", label: "Este mes" },
                { key: "last_month", label: "Mes anterior" },
                { key: "7days", label: "7 días" },
                { key: "today", label: "Hoy" }
              ].map(tab => (
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

      <MetricStrip metrics={metricItems} columns={5} />

      {/* Campaigns Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#101828]">Campañas Publicitarias</h3>
            <p className="text-xs text-[#5F6875]">Presupuestos asignados, consumo e ingresos generados por cada campaña de Product Ads.</p>
          </div>
          <span className="text-xs font-mono text-[#5F6875]">{adsData.campaigns.length} campañas</span>
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
                  <th className="px-3 py-2.5 text-right">Facturación Atribuida</th>
                  <th className="px-4 py-2.5 text-center">ROAS / ACOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                {adsData.campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <OperationalEmptyState
                        title="Todavía no hay información publicitaria disponible."
                        description="No se detectaron campañas de Product Ads activas en el período seleccionado."
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
                        {c.daily_budget !== null ? `${formatCurrency(c.daily_budget)}/d` : "N/D"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#D92D20] font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrency(c.consumed_budget)}
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
                      description="No hay productos que coincidan con la búsqueda o filtro publicitario."
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
                        {p.cost !== null ? (
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
                        {p.clean_net_profit !== null ? (
                          <span className={hasLoss ? "text-[#D92D20]" : "text-[#198754]"}>
                            {formatCurrency(p.clean_net_profit)}
                          </span>
                        ) : (
                          <span className="text-[#5F6875]">N/D</span>
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
