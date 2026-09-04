import { Shield, Cpu } from "lucide-react";

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
    { name: "Mercado Libre", role: "Sincronización oficial de catálogo, órdenes y envíos" },
    { name: "Mercado Pago", role: "Auditoría de cobros, tasas de procesamiento y suscripciones" },
    { name: "Supabase", role: "Base de datos transaccional con cifrado y Row Level Security" },
    { name: "Inngest", role: "Orquestación de flujos de trabajo asíncronos y reintentos" },
    { name: "WhatsApp", role: "Canal de alertas y consultas operativas por texto y voz" },
    { name: "OpenAI", role: "Modelos para síntesis de consultas y auditoría de títulos" },
    { name: "Gemini", role: "Modelos para soporte analítico complementario" },
    { name: "Sentry", role: "Monitoreo de excepciones y estabilidad del sistema en tiempo real" },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Infraestructura y confianza
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Seguridad técnica e integraciones reales.
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Arquitectura pensada para proteger la información comercial de cada negocio y conectarse de manera confiable con las plataformas que utilizás.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* Column 1: Security */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-[#DCDAD4] pb-4">
              <Shield className="w-5 h-5 text-[#102A56]" />
              <h3 className="text-lg font-bold text-[#101828]">
                Criterios de seguridad operativa
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              {securityItems.map((item, idx) => (
                <div key={idx} className="space-y-1.5 p-4 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4]">
                  <h4 className="text-sm font-bold text-[#101828]">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#5F6875] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Integrations (Typographic list without unverified logos) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-[#DCDAD4] pb-4">
              <Cpu className="w-5 h-5 text-[#102A56]" />
              <h3 className="text-lg font-bold text-[#101828]">
                Integraciones verificadas
              </h3>
            </div>

            <div className="bg-[#F5F3EE] rounded-xl border border-[#DCDAD4] divide-y divide-[#DCDAD4] overflow-hidden">
              {integrations.map((integ, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-[#101828]">
                    {integ.name}
                  </span>
                  <span className="text-xs text-[#5F6875] text-right truncate">
                    {integ.role}
                  </span>
                </div>
              ))}
            </div>
            
            <p className="text-xs text-[#5F6875] italic">
              Conexiones directas mediante APIs oficiales bajo estándares de autenticación y cifrado.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
