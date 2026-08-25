"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw, Edit2, Upload, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProductCommandCenter } from "@/components/dashboard/product-command-center";
import { ImportCostsModal } from "@/components/dashboard/import-costs-modal";
import { SearchInput } from "@/components/ui/search-input";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Product {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  cost: number | null;
  available_quantity: number;
  sold_quantity: number;
  status: string;
  thumbnail_url: string | null;
  last_synced_at: string;
}

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
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [logisticFilter, setLogisticFilter] = useState<"all" | "fulfillment" | "other">("all");

  // Calculate FULL Fulfillment metrics
  const fullProducts = initialProducts.filter(p => p.raw_data?.shipping?.logistic_type === "fulfillment");
  const fullStockTotal = fullProducts.reduce((sum, p) => sum + (p.available_quantity || 0), 0);
  const fullCriticalCount = fullProducts.filter(p => (p.available_quantity || 0) <= 5).length;

  const filteredInitialProducts = initialProducts.filter(product => {
    const isFull = product.raw_data?.shipping?.logistic_type === "fulfillment";
    if (logisticFilter === "fulfillment") return isFull;
    if (logisticFilter === "other") return !isFull;
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

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

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            Recalcular Rentabilidad
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Costos
          </Button>
          <Link href="/dashboard/integrations">
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards for FULL Fulfillment & Stock Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border-amber-200/60 dark:border-amber-900/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock en Bodega FULL</CardTitle>
            <Badge className="bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold px-2 py-0.5">⚡ FULL</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fullStockTotal} <span className="text-xs font-normal text-muted-foreground">unidades</span></div>
            <p className="text-xs text-muted-foreground mt-1">
              En depósitos de Mercado Libre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Publicaciones FULL</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fullProducts.length} <span className="text-xs font-normal text-muted-foreground">publicaciones</span></div>
            <p className="text-xs text-muted-foreground mt-1">
              Operadas con envío FULL
            </p>
          </CardContent>
        </Card>

        <Card className={fullCriticalCount > 0 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Crítico FULL</CardTitle>
            <span className="text-xs">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${fullCriticalCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {fullCriticalCount} <span className="text-xs font-normal text-muted-foreground">ítems</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Con 5 o menos unidades en ML
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle>Inventario</CardTitle>
            <CardDescription>
              Tus productos sincronizados desde Mercado Libre.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Logistics Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs">
              <button
                onClick={() => setLogisticFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${logisticFilter === "all" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
              >
                Todos
              </button>
              <button
                onClick={() => setLogisticFilter("fulfillment")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${logisticFilter === "fulfillment" ? "bg-amber-400 text-slate-950 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                ⚡ FULL ({fullProducts.length})
              </button>
              <button
                onClick={() => setLogisticFilter("other")}
                className={`px-2.5 py-1 rounded-md transition-all ${logisticFilter === "other" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
              >
                📦 Propio / Flex
              </button>
            </div>
            <SearchInput placeholder="Buscar por título, SKU..." />
          </div>
        </CardHeader>
        <CardContent>
          {!initialProducts || initialProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-5">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Todavía no sincronizaste productos</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
                Conecta tu cuenta de Mercado Libre y sincroniza tu catálogo para verlo aquí y empezar a operar.
              </p>
              <Link href="/dashboard/integrations">
                <Button className="rounded-full shadow-sm">Ir a Integraciones</Button>
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="border-b bg-slate-50 font-medium text-slate-600">
                    <tr>
                      <th className="h-10 px-4 align-middle">Producto</th>
                      <th className="h-10 px-4 align-middle text-right">Precio</th>
                      <th className="h-10 px-4 align-middle text-right">Costo</th>
                      <th className="h-10 px-4 align-middle text-right">Comisión</th>
                      <th className="h-10 px-4 align-middle text-right">Envío</th>
                      <th className="h-10 px-4 align-middle text-right">Margen Neto</th>
                      <th className="h-10 px-4 align-middle text-center">Estado Rentab.</th>
                      <th className="h-10 px-4 align-middle text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.map((group) => {
                      if (!group.hasMultiple) {
                        const product = group.representative;
                        const isFullProduct = product.raw_data?.shipping?.logistic_type === "fulfillment";
                        return (
                          <tr key={product.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-50">
                            <td className="p-4 align-middle font-medium min-w-[250px]">
                              <div className="flex items-center gap-3">
                                <div className="w-6" />
                                {product.thumbnail_url && (
                                  <img
                                    src={product.thumbnail_url}
                                    alt=""
                                    className="w-10 h-10 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setEditingProduct(product)}
                                  />
                                )}
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className="line-clamp-2 cursor-pointer hover:text-indigo-600 transition-colors"
                                      onClick={() => setEditingProduct(product)}
                                    >
                                      {product.title}
                                    </span>
                                    {isFullProduct && (
                                      <Badge className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-[10px] px-1.5 py-0 h-4 shadow-sm border-0">
                                        ⚡ FULL
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] text-muted-foreground">
                                      <span>SKU: {product.sku || 'N/A'}</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>{isFullProduct ? 'Stock FULL:' : 'ML:'} <strong className="text-slate-700 dark:text-slate-300">{product.available_quantity}</strong></span>
                                        {(() => {
                                          const intStock = getInternalStock(product);
                                          if (intStock === null) return null;
                                          const isLow = intStock < product.available_quantity;
                                          return (
                                            <>
                                              <span>|</span>
                                              <span className={isLow ? "text-red-500 font-semibold flex items-center gap-0.5" : "text-slate-500"}>
                                                Depósito: <strong className={isLow ? "text-red-600 dark:text-red-400 font-bold" : "text-slate-700 dark:text-slate-350"}>{intStock}</strong>
                                                {isLow && " ⚠️"}
                                              </span>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    {product.product_sku_components && product.product_sku_components.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {product.product_sku_components.map((c: any, i: number) => (
                                          <Badge key={i} variant="secondary" className="text-[10px] px-1 py-0 h-4 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                            {c.component_normalized}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap">
                              ${product.price?.toLocaleString()}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap">
                              {product.cost ? (
                                `$${product.cost.toLocaleString()}`
                              ) : (
                                <StatusBadge variant="neutral">Sin costo</StatusBadge>
                              )}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground">
                              {product.estimated_fee ? (
                                <div className="flex flex-col items-end">
                                  <span>${((product.estimated_fee || 0) + (product.extra_fee_amount || 0)).toLocaleString()}</span>
                                  {product.extra_fee_amount > 0 && (
                                    <span className="text-[10px] text-amber-600 font-medium">Incl. cuotas</span>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground">
                              {product.estimated_shipping_cost !== null && product.estimated_shipping_cost !== undefined ? `$${product.estimated_shipping_cost.toLocaleString()}` : '-'}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap">
                              {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                                <div className="flex flex-col items-end">
                                  <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                    {product.profit_real_margin.toFixed(1)}%
                                  </span>
                                  <span className="text-xs text-muted-foreground">${product.profit_real_estimated?.toLocaleString()}</span>
                                </div>
                              ) : product.margin_percent !== null && product.margin_percent !== undefined ? (
                                <div className="flex flex-col items-end">
                                  <span className={product.margin_percent <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                    {product.margin_percent.toFixed(1)}%
                                  </span>
                                  <span className="text-xs text-muted-foreground">${product.margin_amount?.toLocaleString()}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </td>
                            <td className="p-4 align-middle text-center">
                              <StatusBadge variant={
                                product.profitability_status === 'complete' ? 'success' :
                                  product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                              }>
                                {product.profitability_status || 'unknown'}
                              </StatusBadge>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <Button variant="ghost" size="sm" onClick={() => setEditingProduct(product)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </Button>
                            </td>
                          </tr>
                        );
                      }

                      // Multiple publications for SKU
                      const isExpanded = !!expandedKeys[group.key];
                      const representative = group.representative;
                      
                      const priceDisplay = group.minPrice === group.maxPrice 
                        ? `$${group.minPrice.toLocaleString()}` 
                        : `$${group.minPrice.toLocaleString()} - $${group.maxPrice.toLocaleString()}`;

                      const costDisplay = group.minCost === null
                        ? <StatusBadge variant="neutral">Sin costo</StatusBadge>
                        : group.minCost === group.maxCost 
                          ? `$${group.minCost.toLocaleString()}` 
                          : `$${group.minCost.toLocaleString()} - $${group.maxCost!.toLocaleString()}`;

                      const feeDisplay = group.minFee === group.maxFee 
                        ? `$${group.minFee.toLocaleString()}` 
                        : `$${group.minFee.toLocaleString()} - $${group.maxFee.toLocaleString()}`;

                      const shippingDisplay = group.minShipping === null 
                        ? '-' 
                        : group.minShipping === group.maxShipping 
                          ? `$${group.minShipping.toLocaleString()}` 
                          : `$${group.minShipping.toLocaleString()} - $${group.maxShipping!.toLocaleString()}`;

                      const marginDisplay = group.minMargin === null 
                        ? <span className="text-muted-foreground">N/A</span> 
                        : group.minMargin === group.maxMargin 
                          ? <span className={group.minMargin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>{group.minMargin.toFixed(1)}%</span> 
                          : <span className="font-semibold text-slate-700">{group.minMargin.toFixed(0)}% - {group.maxMargin!.toFixed(0)}%</span>;

                      return (
                        <>
                          <tr key={group.key} className="border-b border-slate-200 transition-colors bg-indigo-50/20 hover:bg-indigo-50/40">
                            <td className="p-4 align-middle font-semibold min-w-[250px]">
                              <div className="flex items-center gap-3">
                                <span 
                                  className="cursor-pointer text-indigo-650 hover:text-indigo-800 transition-colors p-1"
                                  onClick={() => toggleExpanded(group.key)}
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </span>
                                {representative.thumbnail_url && (
                                  <img
                                    src={representative.thumbnail_url}
                                    alt=""
                                    className="w-10 h-10 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => toggleExpanded(group.key)}
                                  />
                                )}
                                <div className="flex flex-col">
                                  <span
                                    className="line-clamp-2 cursor-pointer hover:text-indigo-600 transition-colors text-slate-900"
                                    onClick={() => toggleExpanded(group.key)}
                                  >
                                    {representative.title}
                                  </span>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex flex-col gap-0.5 mt-0.5 text-[11px] text-muted-foreground font-normal">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded">SKU: {group.sku}</span>
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-750 border-indigo-200 text-[10px] py-0 px-1.5 h-5 font-semibold">
                                          {group.publications.length} publicaciones
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5 font-normal">
                                        <span>ML total: <strong className="text-slate-700">{group.totalAvailableQty}</strong></span>
                                        {(() => {
                                          const intStock = getInternalStock(representative);
                                          if (intStock === null) return null;
                                          const isLow = intStock < group.totalAvailableQty;
                                          return (
                                            <>
                                              <span>|</span>
                                              <span className={isLow ? "text-red-500 font-semibold flex items-center gap-0.5" : "text-slate-500"}>
                                                Depósito: <strong className={isLow ? "text-red-650 font-bold" : "text-slate-750"}>{intStock}</strong>
                                                {isLow && " ⚠️"}
                                              </span>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap font-medium text-slate-800">
                              {priceDisplay}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap font-medium text-slate-800">
                              {costDisplay}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground font-normal">
                              {feeDisplay}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap text-muted-foreground font-normal">
                              {shippingDisplay}
                            </td>
                            <td className="p-4 align-middle text-right whitespace-nowrap font-medium">
                              {marginDisplay}
                            </td>
                            <td className="p-4 align-middle text-center font-normal">
                              <StatusBadge variant={
                                group.aggregatedStatus === 'complete' ? 'success' :
                                  group.aggregatedStatus === 'missing_cost' ? 'danger' : 'warning'
                              }>
                                {group.aggregatedStatus}
                              </StatusBadge>
                            </td>
                            <td className="p-4 align-middle text-right font-normal">
                              <Button variant="ghost" size="sm" className="text-indigo-650 hover:text-indigo-850" onClick={() => toggleExpanded(group.key)}>
                                {isExpanded ? "Colapsar" : "Desglosar"}
                              </Button>
                            </td>
                          </tr>

                          {isExpanded && group.publications.map((product) => (
                            <tr key={product.id} className="border-b border-slate-100 transition-colors bg-slate-50/50 hover:bg-slate-100/60">
                              <td className="p-4 pl-10 align-middle font-medium min-w-[250px]">
                                <div className="flex items-center gap-3">
                                  {product.thumbnail_url && (
                                    <img
                                      src={product.thumbnail_url}
                                      alt=""
                                      className="w-8 h-8 rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => setEditingProduct(product)}
                                    />
                                  )}
                                  <div className="flex flex-col">
                                    <span
                                      className="line-clamp-1 text-xs cursor-pointer hover:text-indigo-600 transition-colors text-slate-700"
                                      onClick={() => setEditingProduct(product)}
                                    >
                                      {product.title}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-normal">
                                      <span>ID: <strong className="text-slate-600">{product.meli_item_id || 'N/A'}</strong></span>
                                      <span>|</span>
                                      <span>ML: <strong className="text-slate-600">{product.available_quantity}</strong></span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 align-middle text-right whitespace-nowrap text-xs text-slate-650">
                                ${product.price?.toLocaleString()}
                              </td>
                              <td className="p-4 align-middle text-right whitespace-nowrap text-xs text-slate-650">
                                {product.cost ? (
                                  `$${product.cost.toLocaleString()}`
                                ) : (
                                  <StatusBadge variant="neutral">Sin costo</StatusBadge>
                                )}
                              </td>
                              <td className="p-4 align-middle text-right whitespace-nowrap text-xs text-muted-foreground">
                                {product.estimated_fee ? (
                                  <div className="flex flex-col items-end">
                                    <span>${((product.estimated_fee || 0) + (product.extra_fee_amount || 0)).toLocaleString()}</span>
                                    {product.extra_fee_amount > 0 && (
                                      <span className="text-[9px] text-amber-600 font-medium">Incl. cuotas</span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="p-4 align-middle text-right whitespace-nowrap text-xs text-muted-foreground">
                                {product.estimated_shipping_cost !== null && product.estimated_shipping_cost !== undefined ? `$${product.estimated_shipping_cost.toLocaleString()}` : '-'}
                              </td>
                              <td className="p-4 align-middle text-right whitespace-nowrap text-xs">
                                {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                                  <div className="flex flex-col items-end">
                                    <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                      {product.profit_real_margin.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">${product.profit_real_estimated?.toLocaleString()}</span>
                                  </div>
                                ) : product.margin_percent !== null && product.margin_percent !== undefined ? (
                                  <div className="flex flex-col items-end">
                                    <span className={product.margin_percent <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                      {product.margin_percent.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">${product.margin_amount?.toLocaleString()}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </td>
                              <td className="p-4 align-middle text-center">
                                <StatusBadge variant={
                                  product.profitability_status === 'complete' ? 'success' :
                                    product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                                }>
                                  {product.profitability_status || 'unknown'}
                                </StatusBadge>
                              </td>
                              <td className="p-4 align-middle text-right">
                                <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => setEditingProduct(product)}>
                                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                                  Editar
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {groupedProducts.map((group) => {
                  if (!group.hasMultiple) {
                    const product = group.representative;
                    return (
                      <div key={product.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          {product.thumbnail_url && (
                            <img
                              src={product.thumbnail_url}
                              alt=""
                              className="w-14 h-14 rounded-md object-cover border border-slate-100 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setEditingProduct(product)}
                            />
                          )}
                          <div>
                            <h4
                              className="font-medium text-sm line-clamp-2 text-slate-900 cursor-pointer hover:text-indigo-600 transition-colors"
                              onClick={() => setEditingProduct(product)}
                            >
                              {product.title}
                            </h4>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                              <span>SKU: {product.sku || 'N/A'}</span>
                              <div className="flex items-center gap-2 flex-wrap font-medium">
                                <span>ML: <strong className="text-slate-700">{product.available_quantity}</strong></span>
                                {(() => {
                                  const intStock = getInternalStock(product);
                                  if (intStock === null) return null;
                                  const isLow = intStock < product.available_quantity;
                                  return (
                                    <span className={isLow ? "text-red-500 flex items-center gap-0.5" : "text-slate-500"}>
                                      Depósito: <strong>{intStock}</strong> {isLow && "⚠️"}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm border-t border-slate-100 pt-3">
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase">Precio</span>
                            <span className="font-medium">${product.price?.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase">Costo</span>
                            <span>{product.cost ? `$${product.cost.toLocaleString()}` : 'N/A'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase">Margen</span>
                            <span>
                              {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                                <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                                  {product.profit_real_margin.toFixed(1)}%
                                </span>
                              ) : 'N/A'}
                            </span>
                          </div>
                          <div className="flex flex-col items-start justify-center">
                            <StatusBadge variant={
                              product.profitability_status === 'complete' ? 'success' :
                                product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                            }>
                              {product.profitability_status || 'unknown'}
                            </StatusBadge>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button variant="outline" className="w-full" onClick={() => setEditingProduct(product)}>
                            <Edit2 className="w-4 h-4 mr-2" />
                            Ver Detalles / Editar
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  // Multiple publications
                  const isExpanded = !!expandedKeys[group.key];
                  const representative = group.representative;

                  const priceDisplay = group.minPrice === group.maxPrice 
                    ? `$${group.minPrice.toLocaleString()}` 
                    : `$${group.minPrice.toLocaleString()} - $${group.maxPrice.toLocaleString()}`;

                  return (
                    <div key={group.key} className="space-y-3">
                      <div 
                        className="rounded-xl border border-indigo-150 bg-gradient-to-br from-white to-slate-50/30 p-4 space-y-4 shadow-sm cursor-pointer"
                        onClick={() => toggleExpanded(group.key)}
                      >
                        <div className="flex items-start gap-3">
                          {representative.thumbnail_url && (
                            <img
                              src={representative.thumbnail_url}
                              alt=""
                              className="w-14 h-14 rounded-md object-cover border border-slate-100 shrink-0"
                            />
                          )}
                          <div>
                            <h4 className="font-semibold text-sm line-clamp-2 text-slate-900">
                              {representative.title}
                            </h4>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-800 bg-slate-150 px-1 py-0.5 rounded">SKU: {group.sku}</span>
                                <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-[9px] py-0 px-1.5 h-4.5">
                                  {group.publications.length} publicaciones
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap font-medium">
                                <span>ML total: <strong className="text-slate-700">{group.totalAvailableQty}</strong></span>
                                {(() => {
                                  const intStock = getInternalStock(representative);
                                  if (intStock === null) return null;
                                  const isLow = intStock < group.totalAvailableQty;
                                  return (
                                    <span className={isLow ? "text-red-500 flex items-center gap-0.5" : "text-slate-500"}>
                                      Depósito: <strong>{intStock}</strong> {isLow && "⚠️"}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-xs">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 uppercase">Precio base</span>
                            <span className="font-semibold text-slate-700">{priceDisplay}</span>
                          </div>
                          <Button variant="outline" size="sm" className="h-7 text-xs font-semibold text-indigo-650 border-indigo-150" onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(group.key);
                          }}>
                            {isExpanded ? "Ocultar variantes" : "Ver variantes"}
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3 pl-3 border-l-2 border-indigo-400 space-y-3">
                          {group.publications.map((product) => (
                            <div key={product.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3 shadow-xs">
                              <div className="flex items-start gap-2.5">
                                {product.thumbnail_url && (
                                  <img
                                    src={product.thumbnail_url}
                                    alt=""
                                    className="w-10 h-10 rounded-md object-cover border border-slate-100 shrink-0"
                                  />
                                )}
                                <div className="min-w-0">
                                  <h5 className="font-medium text-xs line-clamp-1 text-slate-800">
                                    {product.title}
                                  </h5>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    ID: <span className="font-semibold text-slate-700">{product.meli_item_id || 'N/A'}</span> | ML: <span className="font-semibold text-slate-700">{product.available_quantity}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] border-t border-slate-100 pt-2 text-slate-650">
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 uppercase">Precio</span>
                                  <span className="font-semibold">${product.price?.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 uppercase">Costo</span>
                                  <span>{product.cost ? `$${product.cost.toLocaleString()}` : 'N/A'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 uppercase">Margen</span>
                                  <span>
                                    {product.profit_real_margin !== null && product.profit_real_margin !== undefined ? (
                                      <span className={product.profit_real_margin <= 10 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
                                        {product.profit_real_margin.toFixed(1)}%
                                      </span>
                                    ) : 'N/A'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-start">
                                  <StatusBadge variant={
                                    product.profitability_status === 'complete' ? 'success' :
                                      product.profitability_status === 'missing_cost' ? 'danger' : 'warning'
                                  }>
                                    {product.profitability_status || 'unknown'}
                                  </StatusBadge>
                                </div>
                              </div>

                              <div className="pt-1.5 border-t border-slate-100">
                                <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" onClick={() => setEditingProduct(product)}>
                                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                                  Editar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {totalCount > 50 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {initialProducts.length} de {totalCount} productos
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", (currentPage - 1).toString());
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage * 50 >= totalCount}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set("page", (currentPage + 1).toString());
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
