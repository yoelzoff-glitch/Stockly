import { Info } from "lucide-react";

interface FeatureModule {
  name: string;
  description: string;
  category: string;
}

const modules: FeatureModule[] = [
  {
    name: "Rentabilidad",
    description: "Cálculo automático de la ganancia neta por venta descontando comisiones variables, retenciones impositivas, envíos y costos de reposición.",
    category: "Margen & Control",
  },
  {
    name: "Ventas",
    description: "Monitoreo y consolidación de órdenes de Mercado Libre con detalle financiero individual por publicación y comprador.",
    category: "Operación",
  },
  {
    name: "Productos",
    description: "Catálogo unificado sincronizado con Mercado Libre para auditar precios, márgenes mínimos y estado de publicaciones.",
    category: "Catálogo",
  },
  {
    name: "Stock interno",
    description: "Control de inventario físico en depósito desacoplado de las publicaciones para evitar ventas sin stock real.",
    category: "Inventario",
  },
  {
    name: "Compras",
    description: "Registro de ingresos de mercadería, listas de proveedores y actualización ágil de los costos de compra unitarios.",
    category: "Abastecimiento",
  },
  {
    name: "Envíos",
    description: "Auditoría de cargos de Mercado Envíos y logística Flex para verificar que el flete no absorba el margen proyectado.",
    category: "Logística",
  },
  {
    name: "Cancelaciones",
    description: "Trazabilidad de órdenes devueltas, mediaciones y costos absorbidos para entender el impacto real de los reclamos.",
    category: "Auditoría",
  },
  {
    name: "Publicidad",
    description: "Medición del gasto de Mercado Libre Ads y su ACOS en relación directa con la rentabilidad neta de cada producto.",
    category: "Publicidad",
  },
  {
    name: "Promociones y cupones",
    description: "Seguimiento del impacto de participar en campañas de descuento y cupones co-financiados sobre la ganancia final.",
    category: "Comercial",
  },
  {
    name: "Finanzas",
    description: "Balance consolidado de ingresos, deducciones impositivas, gastos fijos de estructura y resultado neto mensual.",
    category: "Finanzas",
  },
  {
    name: "Automatizaciones",
    description: "Reglas de control configurables para recibir alertas de publicaciones con margen negativo o stock crítico.",
    category: "Automatización",
  },
  {
    name: "Inteligencia artificial",
    description: "Asistente complementario para consultar métricas operativas por texto o voz y optimizar títulos según palabras clave de búsqueda.",
    category: "Asistencia",
  },
];

export function FeatureIndex() {
  return (
    <section id="modulos" className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Módulos del sistema
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Todo lo que necesita una cuenta comercial en un solo lugar.
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Cada módulo resuelve una necesidad concreta de la operativa diaria en Mercado Libre sin interfaces sobrecargadas.
          </p>
        </div>

        {/* Editorial Table / Structured Index */}
        <div className="bg-white rounded-xl border border-[#DCDAD4] shadow-xs overflow-hidden divide-y divide-[#DCDAD4]">
          <div className="grid grid-cols-12 bg-[#F5F3EE] p-4 text-xs font-bold uppercase tracking-wider text-[#5F6875] hidden md:grid">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Módulo</div>
            <div className="col-span-6">Propósito operativo</div>
            <div className="col-span-2 text-right">Área</div>
          </div>

          {modules.map((mod, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-12 p-4 md:p-5 gap-2 md:gap-4 items-center hover:bg-[#F5F3EE]/50 transition-colors"
            >
              <div className="md:col-span-1 text-xs font-mono font-bold text-[#5F6875]">
                {String(idx + 1).padStart(2, "0")}
              </div>

              <div className="md:col-span-3">
                <h3 className="text-base font-bold text-[#101828]">
                  {mod.name}
                </h3>
              </div>

              <div className="md:col-span-6 text-sm text-[#5F6875] leading-relaxed">
                {mod.description}
              </div>

              <div className="md:col-span-2 md:text-right">
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F3EE] text-[#102A56] border border-[#DCDAD4]">
                  {mod.category}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Mandatory Clarification Notice */}
        <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-white border border-[#DCDAD4] text-[#5F6875]">
          <Info className="w-5 h-5 text-[#102A56] shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm leading-relaxed">
            <strong className="text-[#101828] font-semibold">Aclaración operativa importante: </strong>
            Klyvo no responde automáticamente preguntas de compradores de Mercado Libre. Su foco es la gestión de rentabilidad, costos, inventario y control financiero del vendedor.
          </p>
        </div>

      </div>
    </section>
  );
}
