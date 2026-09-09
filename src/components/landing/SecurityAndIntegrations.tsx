import { Shield, Cpu, Lock, CheckCircle2 } from "lucide-react";
import { FadeUp } from "./motion";

export function SecurityAndIntegrations() {
  const securityItems = [
    { title: "Aislamiento de datos por empresa", desc: "Cada cuenta opera en un entorno segregado garantizando total confidencialidad comercial." },
    { title: "Row Level Security (RLS)", desc: "Políticas estrictas a nivel de base de datos que impiden accesos no autorizados entre tenants." },
    { title: "Conexión OAuth oficial", desc: "Vinculación directa mediante el estándar oficial de Mercado Libre sin compartir contraseñas." },
    { title: "Operaciones sensibles con validación", desc: "Control de roles y verificación en acciones críticas que impactan sobre catálogo o precios." },
    { title: "Sincronización idempotente", desc: "Protección contra eventos duplicados para asegurar exactitud en inventario y facturación." },
    { title: "Trazabilidad y reintentos controlados", desc: "Monitoreo continuo de eventos y recuperación automática ante demoras en APIs externas." },
  ];

  const integrations = [
    { name: "Mercado Libre", role: "Sincronización oficial de catálogo, órdenes y envíos", tag: "Oficial OAuth 2.0" },
    { name: "Mercado Pago", role: "Auditoría de cobros, tasas de procesamiento y suscripciones", tag: "Checkout & Cobros" },
    { name: "Supabase", role: "Base de datos transaccional con cifrado y Row Level Security", tag: "PostgreSQL & RLS" },
    { name: "Inngest", role: "Orquestación de flujos de trabajo asíncronos y reintentos", tag: "Event-Driven" },
    { name: "WhatsApp", role: "Canal de alertas y consultas operativas por texto y voz", tag: "Alertas directas" },
    { name: "OpenAI & Gemini", role: "Modelos para síntesis de consultas y optimización analítica", tag: "IA Operativa" },
    { name: "Sentry", role: "Monitoreo de excepciones y estabilidad del sistema en tiempo real", tag: "Observabilidad" },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="max-w-3xl mb-16 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#5B2FE4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Infraestructura y confianza
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#101828] tracking-tight">
              Seguridad técnica e integraciones reales.
            </h2>
            <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
              Arquitectura pensada para proteger la información comercial de cada negocio y conectarse de manera confiable con las plataformas que utilizás.
            </p>
          </div>
        </FadeUp>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Column 1: Security */}
          <div className="lg:col-span-7 space-y-6">
            <FadeUp delay={0.1}>
              <div className="flex items-center gap-2.5 border-b border-[#DCDAD4] pb-4">
                <Shield className="w-5 h-5 text-[#5B2FE4]" />
                <h3 className="text-lg font-bold text-[#101828]">
                  Criterios de seguridad operativa
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {securityItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="space-y-1.5 p-4 rounded-xl bg-[#F5F3EE] border border-[#DCDAD4] hover:border-[#102A56]/30 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#102A56] shrink-0" />
                      <h4 className="text-sm font-bold text-[#101828]">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-[#5F6875] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>

          {/* Column 2: Integrations */}
          <div className="lg:col-span-5 space-y-6">
            <FadeUp delay={0.15}>
              <div className="flex items-center gap-2.5 border-b border-[#DCDAD4] pb-4">
                <Cpu className="w-5 h-5 text-[#5B2FE4]" />
                <h3 className="text-lg font-bold text-[#101828]">
                  Integraciones verificadas
                </h3>
              </div>

              <div className="bg-[#F5F3EE] rounded-2xl border border-[#DCDAD4] divide-y divide-[#DCDAD4] overflow-hidden shadow-2xs">
                {integrations.map((integ, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-white/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#101828]">
                          {integ.name}
                        </span>
                      </div>
                      <span className="text-xs text-[#5F6875] truncate block">
                        {integ.role}
                      </span>
                    </div>
                    <span className="inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white text-[#102A56] border border-[#DCDAD4] shrink-0">
                      {integ.tag}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[#5F6875] italic pt-1">
                Conexiones directas mediante APIs oficiales bajo estándares de autenticación y cifrado.
              </p>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
