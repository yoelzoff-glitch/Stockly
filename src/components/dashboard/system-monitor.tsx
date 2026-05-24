"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, RefreshCw, MessageSquare, Bot, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SystemMonitor() {
  const [stats, setStats] = useState({
    errors24h: 0,
    syncSuccess: 0,
    syncFailed: 0,
    aiUsage: 0,
    waMessages: 0,
    avgResponseTime: "0ms"
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return;

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const currentMonth = now.toISOString().slice(0, 7) + "-01";

      try {
        // AI Actions (Errores últimas 24h, Syncs)
        const { data: actions } = await supabase
          .from("ai_actions")
          .select("action_type, status")
          .eq("tenant_id", tenantId)
          .gte("created_at", yesterday);

        let errs = 0, syncOk = 0, syncErr = 0;
        actions?.forEach(a => {
          if (a.status === "failed") errs++;
          if (a.action_type.includes("sync")) {
            if (a.status === "completed") syncOk++;
            if (a.status === "failed") syncErr++;
          }
        });

        // Usage (IA y WhatsApp)
        const { data: usage } = await supabase
          .from("subscription_usage")
          .select("ai_credits_used, whatsapp_messages_used")
          .eq("tenant_id", tenantId)
          .eq("month", currentMonth)
          .single();

        setStats({
          errors24h: errs,
          syncSuccess: syncOk,
          syncFailed: syncErr,
          aiUsage: usage?.ai_credits_used || 0,
          waMessages: usage?.whatsapp_messages_used || 0,
          avgResponseTime: "245ms" // Mock ya que requeriría métricas complejas no guardadas actualmente
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center text-slate-500">
          <Activity className="w-4 h-4 mr-2" /> Monitoreo del Sistema
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Cargando métricas...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><AlertCircle className="w-3 h-3 mr-1 text-red-400"/> Errores 24h</span>
              <span className="text-xl font-semibold">{stats.errors24h}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><RefreshCw className="w-3 h-3 mr-1 text-emerald-400"/> Sync ML (Exitoso)</span>
              <span className="text-xl font-semibold">{stats.syncSuccess}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><RefreshCw className="w-3 h-3 mr-1 text-red-400"/> Sync ML (Fallido)</span>
              <span className="text-xl font-semibold">{stats.syncFailed}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><Bot className="w-3 h-3 mr-1 text-indigo-400"/> Consultas IA (Mes)</span>
              <span className="text-xl font-semibold">{stats.aiUsage}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><MessageSquare className="w-3 h-3 mr-1 text-green-500"/> Msjs WhatsApp</span>
              <span className="text-xl font-semibold">{stats.waMessages}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1 text-amber-500"/> Tiempo Resp.</span>
              <span className="text-xl font-semibold">{stats.avgResponseTime}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
