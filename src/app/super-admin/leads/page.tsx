import { createAdminClient } from "@/lib/supabase/admin";
import {
  Inbox,
  Calendar,
  Mail,
  Building2,
  Globe,
  Tag,
  Clock,
  ExternalLink,
} from "lucide-react";

export const revalidate = 0;

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  intent: "meeting" | "contact";
  source: string;
  page_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  created_at: string;
}

export default async function SuperAdminLeadsPage() {
  const adminDb = createAdminClient();

  let leads: MarketingLead[] = [];
  let fetchError: string | null = null;

  try {
    const { data, error } = await adminDb
      .from("marketing_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      fetchError = error.message;
    } else if (data) {
      leads = data as MarketingLead[];
    }
  } catch (err: any) {
    fetchError = err?.message || "Error al consultar leads";
  }

  const totalLeads = leads.length;
  const meetingLeads = leads.filter((l) => l.intent === "meeting").length;
  const contactLeads = leads.filter((l) => l.intent === "contact").length;
  const meetingRate = totalLeads > 0 ? Math.round((meetingLeads / totalLeads) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-sm bg-[#3A86FF]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Crecimiento & Ventas
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-[#3A86FF]" />
            Leads Comerciales
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Solicitudes de reunión y prospectos capturados desde la landing de LibretaX.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1C2541] border border-[#2A375A] rounded-xl p-5">
          <span className="text-xs text-[#94A3B8] font-medium block mb-1">Total de Leads</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tabular-nums">{totalLeads}</span>
            <span className="text-xs text-[#64748B]">registros</span>
          </div>
        </div>

        <div className="bg-[#1C2541] border border-[#2A375A] rounded-xl p-5">
          <span className="text-xs text-[#94A3B8] font-medium block mb-1">Solicitudes de Reunión</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#A6F4C5] tabular-nums">{meetingLeads}</span>
            <span className="text-xs text-[#A6F4C5]/70">alta intención</span>
          </div>
        </div>

        <div className="bg-[#1C2541] border border-[#2A375A] rounded-xl p-5">
          <span className="text-xs text-[#94A3B8] font-medium block mb-1">Contactos por Email</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#60A5FA] tabular-nums">{contactLeads}</span>
            <span className="text-xs text-[#64748B]">a contactar</span>
          </div>
        </div>

        <div className="bg-[#1C2541] border border-[#2A375A] rounded-xl p-5">
          <span className="text-xs text-[#94A3B8] font-medium block mb-1">Ratio Reunión / Total</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tabular-nums">{meetingRate}%</span>
            <span className="text-xs text-[#64748B]">conversión</span>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {fetchError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
          <strong>Aviso:</strong> No se pudo conectar con la tabla de leads ({fetchError}).
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-[#1C2541] border border-[#2A375A] rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-[#2A375A] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Listado Cronológico</h2>
          <span className="text-xs text-[#64748B]">{leads.length} registros</span>
        </div>

        {leads.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-[#64748B]">
            Aún no se han capturado leads comerciales desde la landing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#E2E8F0]">
              <thead className="bg-[#0B132B]/60 text-[#94A3B8] text-[11px] uppercase tracking-wider font-semibold border-b border-[#2A375A]">
                <tr>
                  <th className="py-3.5 px-4">Fecha</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4">Email / Contacto</th>
                  <th className="py-3.5 px-4">Nombre</th>
                  <th className="py-3.5 px-4">Empresa / Tienda</th>
                  <th className="py-3.5 px-4">Campaña / UTM</th>
                  <th className="py-3.5 px-4">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A375A]/60">
                {leads.map((lead) => {
                  const isMeeting = lead.intent === "meeting";
                  const dateFormatted = new Date(lead.created_at).toLocaleString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={lead.id} className="hover:bg-[#2A375A]/30 transition-colors">
                      {/* Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#94A3B8] font-mono text-[11px]">
                        {dateFormatted}
                      </td>

                      {/* Tipo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isMeeting ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#A6F4C5]/10 text-[#34D399] border border-[#34D399]/30">
                            <Calendar className="w-3 h-3" />
                            Reunión
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#3A86FF]/10 text-[#60A5FA] border border-[#3A86FF]/30">
                            <Mail className="w-3 h-3" />
                            Contacto
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-medium text-white select-all">
                        {lead.email}
                      </td>

                      {/* Nombre */}
                      <td className="py-3.5 px-4 text-[#CBD5E1]">
                        {lead.name || <span className="text-[#64748B]">—</span>}
                      </td>

                      {/* Empresa */}
                      <td className="py-3.5 px-4 text-[#CBD5E1]">
                        {lead.company ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-[#94A3B8]" />
                            <span>{lead.company}</span>
                          </div>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>

                      {/* Campaña / UTM */}
                      <td className="py-3.5 px-4">
                        {lead.utm_source || lead.utm_campaign ? (
                          <div className="space-y-0.5">
                            <div className="text-[11px] text-[#A5B4FC] font-medium">
                              {lead.utm_source || "direct"} {lead.utm_medium ? `(${lead.utm_medium})` : ""}
                            </div>
                            {lead.utm_campaign && (
                              <div className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{lead.utm_campaign}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#64748B] text-[11px]">Orgánico / Directo</span>
                        )}
                      </td>

                      {/* Referrer */}
                      <td className="py-3.5 px-4 text-[#94A3B8] max-w-[180px] truncate text-[11px]">
                        {lead.referrer || <span className="text-[#64748B]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
