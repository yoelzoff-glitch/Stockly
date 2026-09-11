"use client";

import { useState, useEffect, useTransition } from "react";
import {
  WebAnalyticsOverviewData,
  TimeseriesPoint,
  TopPageItem,
  TrafficSourceItem,
  CampaignItem,
  DevicesData,
  GeoData,
  RealtimeData,
  FunnelStep,
} from "@/services/super-admin/analytics";
import { fetchAnalyticsDashboardData, fetchRealtimeData } from "./actions";
import {
  Users,
  Activity,
  Globe,
  Smartphone,
  Compass,
  FileText,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  RefreshCw,
  Layers,
  Filter,
} from "lucide-react";

interface AnalyticsClientProps {
  initialOverview: WebAnalyticsOverviewData;
  initialTimeseries: TimeseriesPoint[];
  initialTopPages: TopPageItem[];
  initialSources: TrafficSourceItem[];
  initialCampaigns: CampaignItem[];
  initialDevices: DevicesData;
  initialGeo: GeoData;
  initialRealtime: RealtimeData;
  initialFunnel: FunnelStep[];
}

type TabKey = "overview" | "realtime" | "pages" | "acquisition" | "audience" | "devices";
type DateRangeKey = "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getDateRange(rangeKey: DateRangeKey): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  if (rangeKey === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from, to };
  }
  if (rangeKey === "yesterday") {
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { from: yesterdayStart.toISOString(), to: yesterdayEnd.toISOString() };
  }
  if (rangeKey === "7d") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  if (rangeKey === "30d") {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  if (rangeKey === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    return { from, to };
  }
  if (rangeKey === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).toISOString();
    return { from, to: lastMonthEnd };
  }

  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export function AnalyticsClient({
  initialOverview,
  initialTimeseries,
  initialTopPages,
  initialSources,
  initialCampaigns,
  initialDevices,
  initialGeo,
  initialRealtime,
  initialFunnel,
}: AnalyticsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("30d");
  const [environment, setEnvironment] = useState<"production" | "all">("production");
  const [excludeInternal, setExcludeInternal] = useState<boolean>(true);

  // Dashboard Data State
  const [overview, setOverview] = useState(initialOverview);
  const [timeseries, setTimeseries] = useState(initialTimeseries);
  const [topPages, setTopPages] = useState(initialTopPages);
  const [sources, setSources] = useState(initialSources);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [devices, setDevices] = useState(initialDevices);
  const [geo, setGeo] = useState(initialGeo);
  const [funnel, setFunnel] = useState(initialFunnel);
  const [realtime, setRealtime] = useState(initialRealtime);

  const [isPending, startTransition] = useTransition();
  const [isRefreshingRealtime, setIsRefreshingRealtime] = useState(false);

  // Refresh general data on filter change
  const reloadData = (range = dateRangeKey, env = environment, excl = excludeInternal) => {
    startTransition(async () => {
      const dates = getDateRange(range);
      const data = await fetchAnalyticsDashboardData({
        from: dates.from,
        to: dates.to,
        environment: env,
        excludeInternal: excl,
      });

      setOverview(data.overview);
      setTimeseries(data.timeseries);
      setTopPages(data.topPages);
      setSources(data.sources);
      setCampaigns(data.campaigns);
      setDevices(data.devices);
      setGeo(data.geo);
      setFunnel(data.funnel);
    });
  };

  // Realtime Polling every 15 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const pollRealtime = async () => {
      try {
        setIsRefreshingRealtime(true);
        const data = await fetchRealtimeData({
          environment,
          excludeInternal,
        });
        setRealtime(data);
      } catch (err) {
        console.error("Realtime poll error:", err);
      } finally {
        setIsRefreshingRealtime(false);
      }
    };

    interval = setInterval(pollRealtime, 15000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [environment, excludeInternal]);

  // Max value for timeseries SVG chart
  const maxMetric = Math.max(...timeseries.map((t) => Math.max(t.visitors, t.pageviews)), 10);

  return (
    <div className="space-y-6">
      {/* Top Header & Global Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Web Analytics & Realtime</h1>
            <button
              onClick={() => setActiveTab("realtime")}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{realtime.activeVisitors} activos ahora</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tráfico del sitio público, adquisición, audiencia geográfica y telemetría en vivo.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRangeKey}
            onChange={(e) => {
              const val = e.target.value as DateRangeKey;
              setDateRangeKey(val);
              reloadData(val, environment, excludeInternal);
            }}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="this_month">Este mes</option>
            <option value="last_month">Mes anterior</option>
          </select>

          {/* Environment filter */}
          <select
            value={environment}
            onChange={(e) => {
              const val = e.target.value as "production" | "all";
              setEnvironment(val);
              reloadData(dateRangeKey, val, excludeInternal);
            }}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="production">Solo Producción</option>
            <option value="all">Todos los entornos</option>
          </select>

          {/* Exclude internal toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => {
                const val = e.target.checked;
                setExcludeInternal(val);
                reloadData(dateRangeKey, environment, val);
              }}
              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
            />
            <span>Excluir visitas del equipo</span>
          </label>

          {/* Refresh Button */}
          <button
            onClick={() => reloadData()}
            disabled={isPending}
            className="p-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        {[
          { key: "overview", label: "Overview", icon: Layers },
          { key: "realtime", label: "Realtime", icon: Activity, badge: realtime.activeVisitors },
          { key: "pages", label: "Páginas", icon: FileText },
          { key: "acquisition", label: "Adquisición", icon: Compass },
          { key: "audience", label: "Audiencia", icon: Globe },
          { key: "devices", label: "Dispositivos", icon: Smartphone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Visitors */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Visitantes</span>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overview.totalVisitors.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {overview.visitorsDeltaPct >= 0 ? (
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />+{overview.visitorsDeltaPct}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-600 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {overview.visitorsDeltaPct}%
                  </span>
                )}
                <span className="text-slate-400">vs período anterior</span>
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Sesiones</span>
                <Compass className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overview.totalSessions.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {overview.sessionsDeltaPct >= 0 ? (
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />+{overview.sessionsDeltaPct}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-600 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {overview.sessionsDeltaPct}%
                  </span>
                )}
                <span className="text-slate-400">vs período anterior</span>
              </div>
            </div>

            {/* Pageviews */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pageviews</span>
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {overview.totalPageviews.toLocaleString()}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {overview.pageviewsDeltaPct >= 0 ? (
                  <span className="flex items-center text-emerald-600 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />+{overview.pageviewsDeltaPct}%
                  </span>
                ) : (
                  <span className="flex items-center text-rose-600 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                    {overview.pageviewsDeltaPct}%
                  </span>
                )}
                <span className="text-slate-400">vs período anterior</span>
              </div>
            </div>

            {/* Avg Duration */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Duración Media</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {formatDuration(overview.avgDurationSeconds)}
              </div>
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                <span>{overview.pagesPerSession} págs/sesión</span>
                <span className="text-slate-300">•</span>
                <span>{overview.bounceRate}% rebote</span>
              </div>
            </div>
          </div>

          {/* Timeseries Graph Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Evolución de Tráfico</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Visitantes
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-300" /> Pageviews
                </span>
              </div>
            </div>

            {timeseries.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No hay datos registrados en el período seleccionado.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-44 flex items-end gap-1 pt-6 pb-2 border-b border-slate-100">
                  {timeseries.map((pt, i) => {
                    const vHeight = Math.max(Math.round((pt.visitors / maxMetric) * 130), 4);
                    const pHeight = Math.max(Math.round((pt.pageviews / maxMetric) * 130), 4);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
                        {/* Tooltip on hover */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10">
                          {pt.date}: {pt.visitors} vis / {pt.pageviews} vistas
                        </div>
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            style={{ height: `${vHeight}px` }}
                            className="w-full max-w-[8px] bg-blue-500 rounded-t-sm transition-all"
                          />
                          <div
                            style={{ height: `${pHeight}px` }}
                            className="w-full max-w-[8px] bg-indigo-200 rounded-t-sm transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 px-1">
                  <span>{timeseries[0]?.date}</span>
                  <span>{timeseries[timeseries.length - 1]?.date}</span>
                </div>
              </div>
            )}
          </div>

          {/* 2-Column Grid: Top Pages & Top Sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Pages */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Páginas más visitadas</h3>
                <button
                  onClick={() => setActiveTab("pages")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  Ver todas <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {topPages.slice(0, 5).map((page, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-700 font-medium truncate max-w-[240px]">
                      {page.path}
                    </span>
                    <div className="flex items-center gap-4 text-slate-500 font-medium">
                      <span>{page.pageviews.toLocaleString()} vistas</span>
                      <span className="w-12 text-right">{formatDuration(page.avgDurationSeconds)}</span>
                    </div>
                  </div>
                ))}
                {topPages.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">Sin visitas aún.</div>
                )}
              </div>
            </div>

            {/* Top Sources */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Fuentes de tráfico</h3>
                <button
                  onClick={() => setActiveTab("acquisition")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                >
                  Ver detalle <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2.5">
                {sources.slice(0, 5).map((source, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800">{source.sourceName}</span>
                      <span className="text-slate-500">
                        {source.sessions.toLocaleString()} ({source.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(source.percentage, 100)}%` }}
                        className="h-full bg-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
                {sources.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">Sin fuentes registradas.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REALTIME */}
      {/* ========================================================================= */}
      {activeTab === "realtime" && (
        <div className="space-y-6">
          {/* Active users banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <Activity className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <div className="text-3xl font-black tracking-tight flex items-center gap-2">
                  {realtime.activeVisitors}
                  <span className="text-xs font-medium bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    Últimos 5 minutos
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Usuarios activos navegando actualmente en el sitio público
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRealtime ? "animate-spin" : ""}`} />
                Actualiza cada 15s
              </span>
              <button
                onClick={async () => {
                  setIsRefreshingRealtime(true);
                  const data = await fetchRealtimeData({ environment, excludeInternal });
                  setRealtime(data);
                  setIsRefreshingRealtime(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors"
              >
                Actualizar ahora
              </button>
            </div>
          </div>

          {/* Realtime Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Pages */}
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span>Páginas abiertas ahora</span>
                <span className="text-xs font-normal text-slate-500">{realtime.pages.length} URLs</span>
              </h3>
              <div className="divide-y divide-slate-100">
                {realtime.pages.map((pg, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-800 font-semibold truncate max-w-sm">
                      {pg.path}
                    </span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {pg.active_users} {pg.active_users === 1 ? "usuario" : "usuarios"}
                    </span>
                  </div>
                ))}
                {realtime.pages.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No hay usuarios activos en este instante.
                  </div>
                )}
              </div>
            </div>

            {/* Live Devices & Regions */}
            <div className="space-y-6">
              {/* Live Devices */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Dispositivos en vivo</h3>
                <div className="space-y-2">
                  {realtime.devices.map((dev, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700 font-medium">{dev.device_type}</span>
                      <span className="font-semibold text-slate-900">{dev.count}</span>
                    </div>
                  ))}
                  {realtime.devices.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">Sin datos</div>
                  )}
                </div>
              </div>

              {/* Live Regions */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Ubicaciones en vivo</h3>
                <div className="space-y-2">
                  {realtime.regions.map((reg, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-medium truncate max-w-[160px]">
                        {reg.region}
                      </span>
                      <span className="font-semibold text-slate-900">{reg.count}</span>
                    </div>
                  ))}
                  {realtime.regions.length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">Sin datos</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PÁGINAS */}
      {/* ========================================================================= */}
      {activeTab === "pages" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Rendimiento por Página</h3>
            <span className="text-xs text-slate-500">{topPages.length} páginas analizadas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Página</th>
                  <th className="px-5 py-3 text-right">Pageviews</th>
                  <th className="px-5 py-3 text-right">Visitantes</th>
                  <th className="px-5 py-3 text-right">Tiempo Promedio</th>
                  <th className="px-5 py-3 text-right">Entradas</th>
                  <th className="px-5 py-3 text-right">Salidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topPages.map((page, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-medium text-slate-900">{page.path}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                      {page.pageviews.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600">
                      {page.visitors.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 font-medium">
                      {formatDuration(page.avgDurationSeconds)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{page.entries}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{page.exits}</td>
                  </tr>
                ))}
                {topPages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Sin visitas registradas en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADQUISICIÓN & FUNNEL */}
      {/* ========================================================================= */}
      {activeTab === "acquisition" && (
        <div className="space-y-6">
          {/* Conversion Funnel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Embudo de Conversión Web</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {funnel.map((step, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {idx + 1}. {step.name}
                  </span>
                  <div className="text-xl font-bold text-slate-900">{step.count.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-blue-600">
                    {step.conversionRatePct}% conversión
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Traffic Sources Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Canales de Tráfico</h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Fuente</th>
                    <th className="px-5 py-3 text-right">Sesiones</th>
                    <th className="px-5 py-3 text-right">Visitantes</th>
                    <th className="px-5 py-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((src, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{src.sourceName}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {src.sessions.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">{src.visitors}</td>
                      <td className="px-5 py-3 text-right text-slate-600 font-semibold">{src.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* UTM Campaigns Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Campañas UTM</h3>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Campaña</th>
                    <th className="px-5 py-3">Fuente / Medio</th>
                    <th className="px-5 py-3 text-right">Sesiones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((cmp, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{cmp.campaign}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {cmp.source} / {cmp.medium}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">
                        {cmp.sessions.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                        No hay campañas UTM registradas aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIENCIA & UBICACIÓN */}
      {/* ========================================================================= */}
      {activeTab === "audience" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Argentina Provinces Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Provincias de Argentina</h3>
                <p className="text-[11px] text-slate-500">Desglose geográfico para clientes de Argentina</p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                AR
              </span>
            </div>

            <div className="p-5 space-y-3">
              {geo.provinces.map((prov, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{prov.region_name}</span>
                    <span className="text-slate-500">
                      {prov.sessions.toLocaleString()} sesiones ({prov.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(prov.percentage, 100)}%` }}
                      className="h-full bg-blue-600 rounded-full"
                    />
                  </div>
                </div>
              ))}
              {geo.provinces.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Sin registros geográficos para Argentina en este período.
                </div>
              )}
            </div>
          </div>

          {/* Top Countries Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Países</h3>
              <p className="text-[11px] text-slate-500">Visitantes por país de origen</p>
            </div>

            <div className="p-5 space-y-3">
              {geo.countries.map((cntry, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{cntry.country_name}</span>
                    <span className="text-slate-500">
                      {cntry.sessions.toLocaleString()} sesiones ({cntry.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(cntry.percentage, 100)}%` }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
              {geo.countries.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Sin registros internacionales en este período.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DISPOSITIVOS */}
      {/* ========================================================================= */}
      {activeTab === "devices" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Device Category */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Categoría de Dispositivo</h3>
            <div className="space-y-3">
              {devices.devices.map((dev, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium capitalize">
                    <span className="text-slate-800">{dev.device_type}</span>
                    <span className="text-slate-500">
                      {dev.sessions.toLocaleString()} ({dev.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(dev.percentage, 100)}%` }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Browsers */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Navegadores</h3>
            <div className="space-y-3">
              {devices.browsers.map((brw, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{brw.browser}</span>
                    <span className="text-slate-500">
                      {brw.sessions.toLocaleString()} ({brw.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(brw.percentage, 100)}%` }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operating Systems */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Sistemas Operativos</h3>
            <div className="space-y-3">
              {devices.os.map((ops, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800">{ops.os}</span>
                    <span className="text-slate-500">
                      {ops.sessions.toLocaleString()} ({ops.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(ops.percentage, 100)}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
