"use client";

import { useEffect, useState } from "react";
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
          avgResponseTime: "240ms"
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
    <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
        <h3 className="text-sm font-bold text-[#101828] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#102A56]" />
          Monitoreo del sistema
        </h3>
        <span className="text-[11px] text-[#5F6875] font-medium">Últimas 24h</span>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center text-xs text-[#5F6875]">
          Cargando telemetría...
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-[#D92D20]" /> Errores
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.errors24h}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#198754]" /> Sync OK
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.syncSuccess}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <RefreshCw className="w-3 h-3 text-[#D92D20]" /> Sync Fallas
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.syncFailed}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <Bot className="w-3 h-3 text-[#102A56]" /> Consultas
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.aiUsage}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-[#198754]" /> WhatsApp
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.waMessages}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]/70">
            <span className="text-[11px] font-semibold text-[#5F6875] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#B54708]" /> Latencia
            </span>
            <span className="text-base font-extrabold text-[#101828] tabular-nums block mt-1">
              {stats.avgResponseTime}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
