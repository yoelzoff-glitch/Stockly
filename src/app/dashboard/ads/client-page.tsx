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

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "N/D";
    return `$${val.toLocaleString()}`;
  };

  const formatPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "N/D";
    return `${val}%`;
  };

  const formatRoas = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "N/D";
    return `${val}x`;
  };

  // Filter products
  const filteredProducts = (adsData.productAdsList || []).filter((p) => {
    const titleMatch = p.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const skuMatch = p.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = titleMatch || skuMatch;

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "profitable") return matchesSearch && p.profitability_status === "complete";
    if (statusFilter === "warning") return matchesSearch && p.clean_net_margin_percent !== null && p.clean_net_margin_percent < 15;
    if (statusFilter === "loss") return matchesSearch && p.clean_net_profit !== null && p.clean_net_profit < 0;
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
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(adsData.totalAdsInvestment)}</div>
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
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(adsData.totalAdsRevenue)}</div>
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
              {formatPercent(adsData.averageAcos)} <span className="text-xs font-normal text-muted-foreground">(ROAS {formatRoas(adsData.overallRoas)})</span>
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
              {formatCurrency(adsData.totalCleanNetProfit)}
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
                  <th className="h-10 px-4 align-middle text-right">Presupuesto Diario</th>
                  <th className="h-10 px-4 align-middle text-right">Consumo (Inversión)</th>
                  <th className="h-10 px-4 align-middle text-right">Facturación Generada</th>
                  <th className="h-10 px-4 align-middle text-center">ROAS / ACOS</th>
                </tr>
              </thead>
              <tbody>
                {adsData.campaigns.map((c) => {
                  return (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-middle font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <span className="block text-slate-900">{c.name}</span>
                            <span className="text-xs text-slate-400 font-normal">
                              {c.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-center">
                        <Badge className={c.status === "active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                          {c.status === "active" ? "Activa" : "Pausada"}
                        </Badge>
                      </td>
                      <td className="p-4 align-middle text-right font-medium text-slate-700">
                        {c.daily_budget !== null ? `${formatCurrency(c.daily_budget)}/día` : "N/D"}
                      </td>
                      <td className="p-4 align-middle text-right font-semibold text-amber-600">
                        {formatCurrency(c.consumed_budget)}
                      </td>
                      <td className="p-4 align-middle text-right font-bold text-indigo-600">
                        {formatCurrency(c.revenue)}
                      </td>
                      <td className="p-4 align-middle text-center font-bold text-slate-900">
                        <div>{formatRoas(c.roas)} ROAS</div>
                        <div className="text-xs text-slate-400 font-normal">({formatPercent(c.acos)} ACOS)</div>
                      </td>
                    </tr>
                  );
                })}

                {adsData.campaigns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No hay campañas registradas en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Anuncios en Campaña */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>Anuncios en Campaña Product ADS</span>
                <Badge className="bg-amber-500 text-slate-950 font-semibold text-xs">Inversión Diaria ADS</Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                Muestra exclusivamente productos anunciados en campañas publicitarias Product ADS (excluye ofertas, promociones de cuotas o cupones).
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-[220px] bg-slate-50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="border-b bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="h-10 px-4 align-middle">Producto Anunciado</th>
                  <th className="h-10 px-4 align-middle text-right">Precio Venta</th>
                  <th className="h-10 px-4 align-middle text-right">Costo Joya BD</th>
                  <th className="h-10 px-4 align-middle text-center">Ventas Ads</th>
                  <th className="h-10 px-4 align-middle text-right">Facturación Ads</th>
                  <th className="h-10 px-4 align-middle text-right">Gasto Ads</th>
                  <th className="h-10 px-4 align-middle text-center">ACOS / ROAS</th>
                  <th className="h-10 px-4 align-middle text-right">Ganancia Limpia</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const hasLoss = p.clean_net_profit !== null && p.clean_net_profit < 0;
                  return (
                    <tr key={p.product_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 align-middle font-medium max-w-[280px]">
                        <div className="flex items-center gap-3">
                          {p.thumbnail_url ? (
                            <img src={p.thumbnail_url} alt={p.title} className="h-10 w-10 rounded-md object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 font-bold shrink-0">
                              ADS
                            </div>
                          )}
                          <div className="truncate">
                            <span className="block text-slate-900 font-semibold truncate">{p.title}</span>
                            <span className="text-xs text-slate-400 font-mono">SKU: {p.sku || "N/D"} | MLA: {p.meli_item_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 align-middle text-right text-slate-900 font-medium">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="p-4 align-middle text-right font-medium">
                        {p.cost !== null ? (
                          <span className="text-slate-700">{formatCurrency(p.cost)}</span>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                            Cargar costo
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 align-middle text-center font-bold text-slate-800">
                        {p.ads_units_sold} u.
                      </td>
                      <td className="p-4 align-middle text-right font-bold text-indigo-600">
                        {formatCurrency(p.ads_revenue)}
                      </td>
                      <td className="p-4 align-middle text-right font-semibold text-amber-600">
                        {formatCurrency(p.ads_investment)}
                      </td>
                      <td className="p-4 align-middle text-center font-medium text-slate-700">
                        <div>{formatPercent(p.acos_percent)} ACOS</div>
                        <div className="text-xs text-slate-400">({formatRoas(p.roas)} ROAS)</div>
                      </td>
                      <td className="p-4 align-middle text-right font-extrabold">
                        {p.clean_net_profit !== null ? (
                          <span className={hasLoss ? "text-red-600" : "text-emerald-600"}>
                            {formatCurrency(p.clean_net_profit)}
                          </span>
                        ) : (
                          <span className="text-slate-400">N/D</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No se encontraron anuncios correspondientes a los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
