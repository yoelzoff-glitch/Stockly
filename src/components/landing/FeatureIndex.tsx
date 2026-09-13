import { Info, Layers } from "lucide-react";
import { FadeUp } from "./motion";

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
    <section id="modulos" className="py-20 md:py-28 border-b border-[rgba(0,57,104,0.10)] bg-[rgba(0,57,104,0.02)]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="max-w-3xl mb-16 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#00DFDB]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#003968]">
                Módulos del sistema
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#002B4D] tracking-tight">
              Todo lo que necesita una cuenta comercial en un solo lugar.
            </h2>
            <p className="text-base sm:text-lg text-[rgba(0,43,77,0.70)] leading-relaxed">
              Cada módulo resuelve una necesidad concreta de la operativa diaria en Mercado Libre sin interfaces sobrecargadas.
            </p>
          </div>
        </FadeUp>

        {/* Structured Ledger Table */}
        <FadeUp delay={0.1}>
          <div className="bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] shadow-xs overflow-hidden divide-y divide-[rgba(0,57,104,0.08)]">
            {/* Header Row */}
            <div className="grid grid-cols-12 bg-[rgba(0,57,104,0.04)] p-4 text-xs font-mono font-bold uppercase tracking-wider text-[#003968] hidden md:grid">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Módulo</div>
              <div className="col-span-6">Propósito operativo</div>
              <div className="col-span-2 text-right">Área</div>
            </div>

            {/* Rows */}
            {modules.map((mod, idx) => (
              <div
                key={mod.name}
                className="grid grid-cols-1 md:grid-cols-12 p-4 md:p-5 gap-2 md:gap-4 items-center hover:bg-[rgba(0,223,219,0.03)] transition-colors"
              >
                <div className="md:col-span-1 text-xs font-mono font-bold text-[#00DFDB]">
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div className="md:col-span-3">
                  <h3 className="text-base font-bold text-[#002B4D]">
                    {mod.name}
                  </h3>
                </div>

                <div className="md:col-span-6 text-sm text-[rgba(0,43,77,0.70)] leading-relaxed">
                  {mod.description}
                </div>

                <div className="md:col-span-2 md:text-right">
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-[rgba(0,57,104,0.04)] text-[#003968] border border-[rgba(0,57,104,0.12)]">
                    {mod.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* Mandatory Operational Clarification */}
        <FadeUp delay={0.15}>
          <div className="mt-8 flex items-start gap-3 p-4 sm:p-5 rounded-xl bg-white border border-[rgba(0,57,104,0.12)] text-[rgba(0,43,77,0.70)] shadow-2xs">
            <Info className="w-5 h-5 text-[#003968] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm leading-relaxed">
              <strong className="text-[#002B4D] font-semibold">Aclaración operativa importante: </strong>
              LibretaX no responde automáticamente preguntas de compradores de Mercado Libre. Su foco es la gestión de rentabilidad, costos, inventario y control financiero del vendedor.
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
