"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Megaphone, 
  DollarSign, 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  RefreshCw, 
  Percent, 
  PieChart, 
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { getAdsDataAction } from "./actions";

interface AdsClientPageProps {
  initialAdsData: {
    campaigns: any[];
    productAdsList: any[];
    totalAdsInvestment: number;
    totalAdsRevenue: number;
    totalCleanNetProfit: number;
    averageAcos: number;
    overallRoas: number;
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
      console.error("Failed to load period ads data:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const freshData = await getAdsDataAction(selectedPeriod);
      setAdsData(freshData);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter products
  const filteredProducts = adsData.productAdsList.filter((p) => {
    const titleMatch = p.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = titleMatch || skuMatch;

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "profitable") return matchesSearch && p.profitability_status === "profitable";
    if (statusFilter === "warning") return matchesSearch && p.profitability_status === "warning";
    if (statusFilter === "loss") return matchesSearch && p.profitability_status === "loss";
    if (statusFilter === "missing_cost") return matchesSearch && p.profitability_status === "missing_cost";
    return matchesSearch;
  });

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Mercado Libre Product ADS</h2>
            <Badge className="bg-amber-400 text-slate-950 font-extrabold px-2.5 py-0.5">⚡ Publicidad</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supervisa presupuestos diarios, consumo publicitario y la ganancia limpia real descontando costo de joya cargado en BD, comisiones y envío.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Time Period Filter Selector */}
          <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs">
            <button
              onClick={() => handlePeriodChange("30days")}
              className={`px-2.5 py-1.5 rounded-md transition-all font-semibold ${selectedPeriod === "30days" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              📅 Últimos 30 días
            </button>
            <button
              onClick={() => handlePeriodChange("this_month")}
              className={`px-2.5 py-1.5 rounded-md transition-all font-semibold ${selectedPeriod === "this_month" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              📆 Este Mes
            </button>
            <button
              onClick={() => handlePeriodChange("last_month")}
              className={`px-2.5 py-1.5 rounded-md transition-all font-semibold ${selectedPeriod === "last_month" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              🗓️ Mes Anterior
            </button>
            <button
              onClick={() => handlePeriodChange("7days")}
              className={`px-2.5 py-1.5 rounded-md transition-all font-semibold ${selectedPeriod === "7days" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              ⚡ 7 Días
            </button>
            <button
              onClick={() => handlePeriodChange("today")}
              className={`px-2.5 py-1.5 rounded-md transition-all font-semibold ${selectedPeriod === "today" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              🎯 Hoy
            </button>
          </div>

          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Consumo en ADS */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión en Ads (Consumo)</CardTitle>
            <Megaphone className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${adsData.totalAdsInvestment.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Gasto publicitario acumulado
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Facturación por Ads */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Facturación por Ads</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">${adsData.totalAdsRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ventas brutas originadas por anuncios
            </p>
          </CardContent>
        </Card>

        {/* Card 3: ACOS Promedio & ROAS */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ACOS Promedio / ROAS</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {adsData.averageAcos}% <span className="text-xs font-normal text-muted-foreground">(ROAS {adsData.overallRoas}x)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Porcentaje de costo sobre facturación
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Ganancia Limpia Total */}
        <Card className="shadow-sm border-emerald-200 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900 dark:text-emerald-300">💰 Ganancia Limpia en Bolsillo</CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              ${adsData.totalCleanNetProfit.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mt-1">
              Limpio real tras costo BD + Fees + ADS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Campañas Activas */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Campañas de Mercado Libre Product ADS</span>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
              {adsData.campaigns.length} campañas en tu cuenta
            </Badge>
          </CardTitle>
          <CardDescription>
            Presupuestos diarios asignados, diagnósticos de rendimiento, consumo e ingresos atribuidos por publicidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="h-10 px-4 align-middle">Nombre de Campaña</th>
                  <th className="h-10 px-4 align-middle text-center">Estado</th>
                  <th className="h-10 px-4 align-middle">Diagnóstico</th>
                  <th className="h-10 px-4 align-middle text-right">Presupuesto Diario</th>
                  <th className="h-10 px-4 align-middle text-center">ROAS Objetivo</th>
                  <th className="h-10 px-4 align-middle text-right">Consumo (Inversión)</th>
                  <th className="h-10 px-4 align-middle text-right">Facturación Generada</th>
                  <th className="h-10 px-4 align-middle text-center">ROAS / ACOS</th>
                </tr>
              </thead>
              <tbody>
                {adsData.campaigns.map((c) => {
                  const isDijes = c.id === "camp-dijes" || c.name.includes("Dijes");
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-middle font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <span className="block text-slate-900">{c.name}</span>
                            <span className="text-xs text-slate-400 font-normal">
                              {isDijes ? "15 anuncios activos" : "9 anuncios pausados"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">
                        <Badge className={c.status === "active" ? "bg-emerald-100 text-emerald-800 border-emerald-200 font-bold" : "bg-slate-100 text-slate-700"}>
                          {c.status === "active" ? "Activa" : "Pausada"}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-xs">
                        {isDijes ? (
                          <div className="text-amber-700 bg-amber-50 border border-amber-200 p-1.5 rounded">
                            <span className="font-bold block">⚠️ Puede mejorar</span>
                            <span className="text-[11px] text-amber-800">Perdés ventas por falta de presupuesto</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4 align-middle text-right font-bold text-slate-900">
                        ${c.daily_budget?.toLocaleString('es-AR')} /día
                      </td>
                      <td className="p-4 align-middle text-center font-semibold text-slate-700">
                        {isDijes ? "4x" : "3.7x"}
                      </td>
                      <td className="p-4 align-middle text-right text-amber-700 font-bold">
                        ${c.consumed_budget?.toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 align-middle text-right text-indigo-700 font-bold">
                        ${c.revenue?.toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 align-middle text-center">
                        {c.status === "active" ? (
                          <div>
                            <span className="font-extrabold text-slate-900 block">{c.roas}x ROAS</span>
                            <span className="text-xs text-slate-500 font-medium">({c.acos}% ACOS)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Listado de Anuncios en Campaña ADS con Ganancia Limpia */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>Anuncios en Campaña Product ADS</span>
              <Badge className="bg-amber-400 text-slate-950 font-bold text-xs">Inversión Diaria ADS</Badge>
            </CardTitle>
            <CardDescription>
              Muestra exclusivamente productos anunciados en campañas publicitarias Product ADS (excluye ofertas, promociones de cuotas o cupones).
            </CardDescription>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Rentability Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 p-1 bg-slate-50 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "all" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
              >
                Todos ({adsData.productAdsList.length})
              </button>
              <button
                onClick={() => setStatusFilter("profitable")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "profitable" ? "bg-emerald-500 text-white shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
              >
                💰 Rentables
              </button>
              <button
                onClick={() => setStatusFilter("warning")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "warning" ? "bg-amber-400 text-slate-950 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"}`}
              >
                ⚠️ Ajustados
              </button>
              <button
                onClick={() => setStatusFilter("loss")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "loss" ? "bg-red-500 text-white shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"}`}
              >
                ❌ En Pérdida
              </button>
              <button
                onClick={() => setStatusFilter("missing_cost")}
                className={`px-2.5 py-1 rounded-md transition-all ${statusFilter === "missing_cost" ? "bg-slate-200 text-slate-800 shadow-sm font-semibold" : "text-slate-500 hover:text-slate-900"}`}
              >
                ❓ Sin Costo BD
              </button>
            </div>

            <Input
              placeholder="Buscar producto o SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No se encontraron productos que coincidan con la búsqueda o filtro.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="h-10 px-4 align-middle">Anuncio / Producto</th>
                    <th className="h-10 px-4 align-middle">SKU BD</th>
                    <th className="h-10 px-4 align-middle text-center">Clics & CPC</th>
                    <th className="h-10 px-4 align-middle text-center">ROAS ML</th>
                    <th className="h-10 px-4 align-middle text-center">Ventas Atribuidas</th>
                    <th className="h-10 px-4 align-middle text-right">Inversión ADS</th>
                    <th className="h-10 px-4 align-middle text-right">Costo BD + Fees</th>
                    <th className="h-10 px-4 align-middle text-right">💰 Ganancia Limpia Real</th>
                    <th className="h-10 px-4 align-middle text-center">Estado ADS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const hasCost = p.cost !== null && p.cost > 0;
                    const isProfit = p.clean_net_profit > 0;

                    return (
                      <tr key={p.product_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 align-middle font-medium min-w-[260px]">
                          <div className="flex items-center gap-3">
                            {p.thumbnail_url && (
                              <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-md object-cover border" />
                            )}
                            <span className="line-clamp-2 text-slate-900 font-semibold">{p.title}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs">
                            {p.sku || "Sin SKU"}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-center">
                          <div className="flex flex-col text-xs">
                            <span className="font-bold text-slate-800">{p.clics || 0} clics</span>
                            <span className="text-slate-400">CPC: ${p.cpc ? p.cpc.toFixed(2) : "0"}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-center">
                          {p.roas > 0 ? (
                            <span className="font-bold text-slate-900 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                              {p.roas}x
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-center">
                          <span className="font-extrabold text-sm text-slate-900">
                            {p.ads_units_sold} {p.ads_units_sold === 1 ? "venta" : "ventas"}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right text-amber-700 font-bold">
                          ${p.ads_investment?.toLocaleString('es-AR')}
                        </td>
                        <td className="p-4 align-middle text-right text-slate-600 font-medium">
                          {hasCost ? (
                            `$${(p.total_product_cost + p.total_fee_cost + p.total_shipping_cost + p.total_packaging_cost).toLocaleString('es-AR')}`
                          ) : (
                            <span className="text-slate-400 italic text-xs">Sin costo BD</span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-right">
                          {hasCost ? (
                            <div>
                              <span className={`font-extrabold text-sm ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
                                ${p.clean_net_profit?.toLocaleString('es-AR')}
                              </span>
                              {p.ads_units_sold > 0 && (
                                <span className="block text-xs font-semibold text-slate-500">
                                  ({p.clean_net_margin_percent.toFixed(1)}% neto)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium">Carga costo en BD</span>
                          )}
                        </td>
                        <td className="p-4 align-middle text-center">
                          {p.profitability_status === "profitable" && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Rentable
                            </Badge>
                          )}
                          {p.profitability_status === "warning" && (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-200 gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-600" /> Margen Bajo
                            </Badge>
                          )}
                          {p.profitability_status === "loss" && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                              <AlertTriangle className="h-3 w-3 text-red-600" /> Pérdida
                            </Badge>
                          )}
                          {p.profitability_status === "missing_cost" && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-300 gap-1">
                              <HelpCircle className="h-3 w-3 text-slate-400" /> Sin Costo
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
