"use client";

import { useState } from "react";
import {
  Package,
  RefreshCw,
  Edit2,
  Upload,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { OperationalToolbar } from "@/components/operational/toolbar";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import { ProductCommandCenter } from "@/components/dashboard/product-command-center";
import { ImportCostsModal } from "@/components/dashboard/import-costs-modal";

export function ProductsClient({
  initialProducts,
  totalCount = 0,
  currentPage = 1,
  searchQuery = ""
}: {
  initialProducts: any[],
  totalCount?: number,
  currentPage?: number,
  searchQuery?: string
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [logisticFilter, setLogisticFilter] = useState<"all" | "fulfillment" | "other">("all");
  const [conditionFilter, setConditionFilter] = useState<"all" | "missing_cost" | "low_margin" | "low_stock">("all");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Fulfillment metrics
  const fullProducts = initialProducts.filter(p => p.raw_data?.shipping?.logistic_type === "fulfillment");
  const missingCostCount = initialProducts.filter(p => !p.cost || p.cost <= 0).length;
  const lowMarginCount = initialProducts.filter(p => {
    const margin = p.profit_real_margin ?? p.margin_percent;
    return margin !== null && margin !== undefined && margin <= 10 && (p.cost && p.cost > 0);
  }).length;
  const lowStockCount = initialProducts.filter(p => (p.available_quantity || 0) <= 5).length;

  const filteredInitialProducts = initialProducts.filter(product => {
    const isFull = product.raw_data?.shipping?.logistic_type === "fulfillment";
    if (logisticFilter === "fulfillment" && !isFull) return false;
    if (logisticFilter === "other" && isFull) return false;

    if (conditionFilter === "missing_cost") {
      return !product.cost || product.cost <= 0;
    }
    if (conditionFilter === "low_margin") {
      const margin = product.profit_real_margin ?? product.margin_percent;
      return margin !== null && margin !== undefined && margin <= 10 && (product.cost && product.cost > 0);
    }
    if (conditionFilter === "low_stock") {
      return (product.available_quantity || 0) <= 5;
    }

    return true;
  });

  const groupedProducts = (() => {
    const groups: {
      key: string;
      sku: string | null;
      representative: any;
      publications: any[];
      totalAvailableQty: number;
    }[] = [];

    filteredInitialProducts.forEach(product => {
      const sku = product.sku?.trim();
      if (!sku) {
        groups.push({
          key: `no-sku-${product.id}`,
          sku: null,
          representative: product,
          publications: [product],
          totalAvailableQty: product.available_quantity || 0,
        });
      } else {
        let group = groups.find(g => g.sku === sku);
        if (!group) {
          group = {
            key: `sku-${sku}`,
            sku: sku,
            representative: product,
            publications: [],
            totalAvailableQty: 0,
          };
          groups.push(group);
        }
        group.publications.push(product);
        group.totalAvailableQty += (product.available_quantity || 0);
      }
    });

    return groups.map(g => {
      const hasMultiple = g.publications.length > 1;

      // Prices
      const prices = g.publications.map(p => p.price).filter(p => typeof p === 'number');
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      // Costs
      const costs = g.publications.map(p => p.cost).filter((c): c is number => typeof c === 'number');
      const minCost = costs.length > 0 ? Math.min(...costs) : null;
      const maxCost = costs.length > 0 ? Math.max(...costs) : null;

      // Fees
      const fees = g.publications.map(p => (p.estimated_fee || 0) + (p.extra_fee_amount || 0)).filter(f => typeof f === 'number');
      const minFee = fees.length > 0 ? Math.min(...fees) : 0;
      const maxFee = fees.length > 0 ? Math.max(...fees) : 0;

      // Shipping
      const shippings = g.publications.map(p => p.estimated_shipping_cost).filter((s): s is number => typeof s === 'number');
      const minShipping = shippings.length > 0 ? Math.min(...shippings) : null;
      const maxShipping = shippings.length > 0 ? Math.max(...shippings) : null;

      // Margins
      const margins = g.publications.map(p => {
        if (p.profit_real_margin !== null && p.profit_real_margin !== undefined) return p.profit_real_margin;
        if (p.margin_percent !== null && p.margin_percent !== undefined) return p.margin_percent;
        return null;
      }).filter((m): m is number => typeof m === 'number');
      const minMargin = margins.length > 0 ? Math.min(...margins) : null;
      const maxMargin = margins.length > 0 ? Math.max(...margins) : null;

      // Status
      const statuses = g.publications.map(p => p.profitability_status);
      const hasMissing = statuses.includes('missing_cost');
      const hasWarning = statuses.includes('warning');
      const aggregatedStatus = hasMissing ? 'missing_cost' : (hasWarning ? 'warning' : 'complete');

      return {
        ...g,
        hasMultiple,
        minPrice,
        maxPrice,
        minCost,
        maxCost,
        minFee,
        maxFee,
        minShipping,
        maxShipping,
        minMargin,
        maxMargin,
        aggregatedStatus
      };
    });
  })();

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getInternalStock = (prod: any) => {
    if (!prod.product_components || prod.product_components.length === 0) return null;
    let minComboStock = Infinity;
    for (const comp of prod.product_components) {
      const currentStock = comp.inventory_items?.current_stock ?? 0;
      const reqQty = comp.quantity ?? 1;
      const potential = Math.floor(currentStock / reqQty);
      if (potential < minComboStock) minComboStock = potential;
    }
    return minComboStock === Infinity ? 0 : minComboStock;
  };

  const handleSuccess = () => {
    router.refresh();
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch("/api/profitability/recalculate", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsRecalculating(false);
    }
  };

  const metrics: MetricItem[] = [
    {
      label: "Catálogo Total",
      value: totalCount.toString(),
      subtext: `${initialProducts.length} en página actual`,
      icon: <Package className="w-4 h-4" />
    },
    {
      label: "Sin Costo Cargado",
      value: missingCostCount.toString(),
      subtext: missingCostCount > 0 ? "Requiere cargar costo de reposición" : "Catálogo completo",
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: missingCostCount > 0 ? "warning" : "neutral"
    },
    {
      label: "Margen Crítico (≤ 10%)",
      value: lowMarginCount.toString(),
      subtext: "Con margen bajo o negativo",
      icon: <Layers className="w-4 h-4" />,
      highlight: lowMarginCount > 0 ? "critical" : "neutral"
    },
    {
      label: "Stock Crítico (≤ 5 u.)",
      value: lowStockCount.toString(),
      subtext: "Riesgo inminente de quiebre",
      icon: <AlertTriangle className="w-4 h-4" />,
      highlight: lowStockCount > 0 ? "warning" : "neutral"
    },
    {
      label: "En Bodega FULL",
      value: fullProducts.length.toString(),
      subtext: "Gestionados por Mercado Envíos FULL",
      icon: <Package className="w-4 h-4" />
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header Operativo */}
      <OperationalPageHeader
        eyebrow="Catálogo y publicaciones"
        title="Productos"
        description="Control de precios, costos cargados, márgenes netos unitarios y stock sincronizado con Mercado Libre."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleRecalculate}
              disabled={isRecalculating}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              Recalcular Rentabilidad
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="h-9 px-3 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] text-[#101828] shadow-sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Importar Costos
            </Button>
            <Link href="/dashboard/integrations">
              <Button className="h-9 px-3 text-xs font-semibold bg-[#102A56] hover:bg-[#102A56]/90 text-white shadow-sm">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Sincronizar
              </Button>
            </Link>
          </div>
        }
      />

      {/* Franja de Métricas Operativas */}
      <MetricStrip metrics={metrics} columns={5} />

      {/* Barra de Filtros Operativos */}
      <OperationalToolbar>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Logística:</span>
            <select
              value={logisticFilter}
              onChange={(e) => setLogisticFilter(e.target.value as any)}
              className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
            >
              <option value="all">Todas las modalidades</option>
              <option value="fulfillment">Solo FULL</option>
              <option value="other">Colecta / Clásica</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5F6875]">Condición:</span>
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value as any)}
              className="h-8 rounded-md border border-[#DCDAD4] bg-white px-2.5 text-xs text-[#101828] font-medium shadow-none focus:outline-none focus:ring-1 focus:ring-[#102A56]"
            >
              <option value="all">Todo el catálogo</option>
              <option value="missing_cost">Sin costo cargado</option>
              <option value="low_margin">Margen bajo (≤ 10%)</option>
              <option value="low_stock">Stock bajo (≤ 5 u.)</option>
            </select>
          </div>
        </div>

        <div className="w-full sm:w-72">
          <SearchInput placeholder="Buscar por título, SKU, ID..." />
        </div>
      </OperationalToolbar>

      {/* Tabla de Productos con DataTableShell */}
      <DataTableShell
        isEmpty={!initialProducts || initialProducts.length === 0}
        emptyState={
          <OperationalEmptyState
            icon={Package}
            title="Todavía no sincronizaste productos"
            description="Conectá tu cuenta de Mercado Libre y sincronizá tu catálogo para comenzar a controlar márgenes y costos de reposición."
            actionLabel="Ir a Integraciones"
            actionHref="/dashboard/integrations"
          />
        }
        pagination={{
          currentPage,
          totalCount,
          pageSize: 50,
          onPageChange: (newPage) => {
            const params = new URLSearchParams(searchParams);
            params.set("page", newPage.toString());
            router.push(`${pathname}?${params.toString()}`);
          },
          label: (
            <span>
              Mostrando <strong className="text-[#101828] font-semibold">{initialProducts.length}</strong> de{" "}
              <strong className="text-[#101828] font-semibold">{totalCount}</strong> publicaciones sincronizadas
            </span>
          )
        }}
      >
        <table className="w-full text-xs text-left border-collapse">
          <thead className="text-[11px] uppercase bg-[#FCFCFA] text-[#5F6875] font-bold border-b border-[#DCDAD4]">
            <tr>
              <th className="px-4 py-3 font-semibold min-w-[280px]">Publicación / SKU</th>
              <th className="px-3 py-3 font-semibold text-center">Stock ML / Depósito</th>
              <th className="px-3 py-3 font-semibold text-right">Precio</th>
              <th className="px-3 py-3 font-semibold text-right">Costo</th>
              <th className="px-3 py-3 font-semibold text-right">Comisión</th>
              <th className="px-3 py-3 font-semibold text-right">Envío</th>
              <th className="px-3 py-3 font-semibold text-right">Margen Neto</th>
              <th className="px-3 py-3 font-semibold text-center">Estado</th>
              <th className="px-4 py-3 font-semibold text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {groupedProducts.map((group) => {
              if (!group.hasMultiple) {
                const product = group.representative;
                const isFullProduct = product.raw_data?.shipping?.logistic_type === "fulfillment";
                const intStock = getInternalStock(product);
                const isStockCritical = (product.available_quantity || 0) <= 5;
                const margin = product.profit_real_margin ?? product.margin_percent;
                const hasCost = product.cost && product.cost > 0;

                return (
                  <tr
                    key={product.id}
                    className="hover:bg-[#F5F3EE]/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        {product.thumbnail_url ? (
                          <img
                            src={product.thumbnail_url}
                            alt=""
                            className="w-9 h-9 rounded object-cover border border-[#DCDAD4] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setEditingProduct(product)}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center shrink-0 text-[#5F6875]">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="space-y-0.5 min-w-0 max-w-[260px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-semibold text-[#101828] leading-tight truncate cursor-pointer hover:underline"
                              onClick={() => setEditingProduct(product)}
                              title={product.title}
                            >
                              {product.title}
                            </span>
                            {isFullProduct && (
                              <Badge className="bg-[#F2C94C] text-[#101828] font-bold text-[9px] px-1 py-0 h-3.5 border-0">
                                FULL
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#5F6875] font-mono">
                            <span>SKU: {product.sku || "Sin asignar"}</span>
                            <span>•</span>
                            <span>{product.meli_item_id}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Stock ML vs Depósito */}
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 font-medium tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span className={`font-semibold ${isStockCritical ? 'text-[#D92D20]' : 'text-[#101828]'}`}>
                          ML: {product.available_quantity ?? 0}
                        </span>
                        {intStock !== null && (
                          <>
                            <span className="text-[#DCDAD4]">|</span>
                            <span className={`text-[11px] ${intStock < product.available_quantity ? 'text-[#B54708] font-bold' : 'text-[#5F6875]'}`}>
                              Dep: {intStock}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Precio */}
                    <td className="px-3 py-3 text-right font-medium text-[#101828] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${product.price?.toLocaleString("es-AR")}
                    </td>

                    {/* Costo */}
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {hasCost ? (
                        <span className="text-[#101828] font-medium">${product.cost.toLocaleString("es-AR")}</span>
                      ) : (
                        <StatusBadge variant="warning">Sin costo</StatusBadge>
                      )}
                    </td>

                    {/* Comisión */}
                    <td className="px-3 py-3 text-right text-[#5F6875] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {product.estimated_fee ? (
                        `$${((product.estimated_fee || 0) + (product.extra_fee_amount || 0)).toLocaleString("es-AR")}`
                      ) : "—"}
                    </td>

                    {/* Envío */}
                    <td className="px-3 py-3 text-right text-[#5F6875] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {product.estimated_shipping_cost !== null && product.estimated_shipping_cost !== undefined
                        ? `$${product.estimated_shipping_cost.toLocaleString("es-AR")}`
                        : "—"}
                    </td>

                    {/* Margen Neto */}
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {margin !== null && margin !== undefined && hasCost ? (
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${margin <= 10 ? 'text-[#D92D20]' : 'text-[#198754]'}`}>
                            {margin.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-[#5F6875]">
                            ${(product.profit_real_estimated ?? product.margin_amount ?? 0).toLocaleString("es-AR")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#5F6875]">—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-3 text-center">
                      <StatusBadge
                        variant={
                          product.profitability_status === 'complete' ? 'success' :
                          product.profitability_status === 'missing_cost' ? 'warning' : 'neutral'
                        }
                      >
                        {product.profitability_status === 'complete' ? 'Al día' :
                         product.profitability_status === 'missing_cost' ? 'Sin costo' :
                         product.profitability_status || 'Revisar'}
                      </StatusBadge>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingProduct(product)}
                        className="h-7 px-2 text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE]"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1 text-[#5F6875]" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              }

              // Multiple publications for SKU (Grouped Row)
              const isExpanded = !!expandedKeys[group.key];
              const representative = group.representative;
              const priceDisplay = group.minPrice === group.maxPrice
                ? `$${group.minPrice.toLocaleString("es-AR")}`
                : `$${group.minPrice.toLocaleString("es-AR")} - $${group.maxPrice.toLocaleString("es-AR")}`;

              const costDisplay = group.minCost === null
                ? <StatusBadge variant="warning">Sin costo</StatusBadge>
                : group.minCost === group.maxCost
                  ? `$${group.minCost.toLocaleString("es-AR")}`
                  : `$${group.minCost.toLocaleString("es-AR")} - $${group.maxCost!.toLocaleString("es-AR")}`;

              const marginDisplay = group.minMargin === null
                ? <span className="text-[#5F6875]">—</span>
                : group.minMargin === group.maxMargin
                  ? <span className={`font-bold ${group.minMargin <= 10 ? 'text-[#D92D20]' : 'text-[#198754]'}`}>{group.minMargin.toFixed(1)}%</span>
                  : <span className="font-semibold text-[#101828]">{group.minMargin.toFixed(0)}% - {group.maxMargin!.toFixed(0)}%</span>;

              return (
                <tbody key={group.key} className="border-b border-[#DCDAD4]">
                  <tr className="bg-[#FCFCFA] hover:bg-[#F5F3EE]/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleExpanded(group.key)}
                          className="p-1 rounded hover:bg-[#DCDAD4]/40 text-[#102A56] mt-0.5"
                          title={isExpanded ? "Colapsar variantes" : "Desglosar variantes"}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {representative.thumbnail_url && (
                          <img
                            src={representative.thumbnail_url}
                            alt=""
                            className="w-9 h-9 rounded object-cover border border-[#DCDAD4] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => toggleExpanded(group.key)}
                          />
                        )}
                        <div className="space-y-0.5 min-w-0 max-w-[260px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-bold text-[#101828] leading-tight truncate cursor-pointer hover:underline"
                              onClick={() => toggleExpanded(group.key)}
                              title={representative.title}
                            >
                              {representative.title}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-[#DCDAD4] bg-white text-[#5F6875] font-semibold">
                              {group.publications.length} pub.
                            </Badge>
                          </div>
                          <div className="text-[11px] font-mono text-[#5F6875]">
                            SKU: <strong className="text-[#101828]">{group.sku}</strong>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="font-semibold text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                        ML total: {group.totalAvailableQty}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right font-semibold text-[#101828] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {priceDisplay}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {costDisplay}
                    </td>

                    <td className="px-3 py-3 text-right text-[#5F6875] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ${group.minFee.toLocaleString("es-AR")}
                    </td>

                    <td className="px-3 py-3 text-right text-[#5F6875] tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {group.minShipping !== null ? `$${group.minShipping.toLocaleString("es-AR")}` : "—"}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {marginDisplay}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <StatusBadge
                        variant={
                          group.aggregatedStatus === 'complete' ? 'success' :
                          group.aggregatedStatus === 'missing_cost' ? 'warning' : 'neutral'
                        }
                      >
                        {group.aggregatedStatus === 'complete' ? 'Al día' :
                         group.aggregatedStatus === 'missing_cost' ? 'Sin costo' : 'Revisar'}
                      </StatusBadge>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(group.key)}
                        className="h-7 px-2 text-xs font-semibold text-[#102A56] hover:bg-[#F5F3EE]"
                      >
                        {isExpanded ? "Colapsar" : "Desglosar"}
                      </Button>
                    </td>
                  </tr>

                  {/* Expanded Variations */}
                  {isExpanded && group.publications.map((product) => {
                    const margin = product.profit_real_margin ?? product.margin_percent;
                    const hasCost = product.cost && product.cost > 0;

                    return (
                      <tr
                        key={product.id}
                        className="bg-[#F8FAFC]/70 hover:bg-[#F5F3EE]/50 transition-colors text-xs border-b border-[#E2E8F0]"
                      >
                        <td className="px-4 py-2.5 pl-12">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-3 h-3 text-[#5F6875] shrink-0" />
                            <div className="space-y-0.5 min-w-0 max-w-[240px]">
                              <p
                                className="font-medium text-[#101828] truncate cursor-pointer hover:underline text-xs"
                                onClick={() => setEditingProduct(product)}
                                title={product.title}
                              >
                                {product.title}
                              </p>
                              <p className="text-[10px] font-mono text-[#5F6875]">
                                ID: {product.meli_item_id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-center text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          ML: {product.available_quantity ?? 0}
                        </td>

                        <td className="px-3 py-2.5 text-right font-medium text-[#101828] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          ${product.price?.toLocaleString("es-AR")}
                        </td>

                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {hasCost ? `$${product.cost.toLocaleString("es-AR")}` : <span className="text-[#B54708]">Sin costo</span>}
                        </td>

                        <td className="px-3 py-2.5 text-right text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {product.estimated_fee ? `$${(product.estimated_fee + (product.extra_fee_amount || 0)).toLocaleString("es-AR")}` : "—"}
                        </td>

                        <td className="px-3 py-2.5 text-right text-[#5F6875] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {product.estimated_shipping_cost !== null && product.estimated_shipping_cost !== undefined
                            ? `$${product.estimated_shipping_cost.toLocaleString("es-AR")}`
                            : "—"}
                        </td>

                        <td className="px-3 py-2.5 text-right tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {margin !== null && margin !== undefined && hasCost ? (
                            <span className={`font-bold ${margin <= 10 ? 'text-[#D92D20]' : 'text-[#198754]'}`}>
                              {margin.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>

                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge
                            variant={product.profitability_status === 'complete' ? 'success' : 'warning'}
                            dot={false}
                          >
                            {product.profitability_status === 'complete' ? 'Al día' : 'Sin costo'}
                          </StatusBadge>
                        </td>

                        <td className="px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingProduct(product)}
                            className="h-6 px-2 text-[11px] text-[#5F6875] hover:text-[#101828]"
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>

      {/* Modales de Edición e Importación */}
      {editingProduct && (
        <ProductCommandCenter
          product={editingProduct}
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            handleSuccess();
          }}
        />
      )}

      {isImportModalOpen && (
        <ImportCostsModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            handleSuccess();
          }}
        />
      )}
    </div>
  );
}
