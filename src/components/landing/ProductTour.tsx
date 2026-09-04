import Image from "next/image";

interface TourStep {
  tag: string;
  title: string;
  description: string;
  imageSrc?: string;
  imageAlt: string;
  placeholderText?: string;
  bulletPoints: string[];
}

const steps: TourStep[] = [
  {
    tag: "01. Dashboard & Ventas",
    title: "Entendé tu rentabilidad",
    description:
      "Visualizá la facturación bruta, las comisiones retenidas, los costos de envío y el resultado neto real de tu cuenta en una sola vista diaria o mensual.",
    imageSrc: "/dashboard-analytics-v2.png",
    imageAlt: "Vista de analíticas y rentabilidad neta de Klyvo",
    bulletPoints: [
      "Total vendido vs. ganancia neta en pesos al centavo.",
      "Desglose de comisiones, envíos y descuentos por período.",
      "Indicador de publicaciones con margen bajo o negativo.",
    ],
  },
  {
    tag: "02. Catálogo & Costos",
    title: "Detectá costos faltantes",
    description:
      "Identificá qué productos de tu catálogo no tienen asignado su costo de compra o reposición para que ningún cálculo de margen quede incompleto.",
    imageSrc: "/dashboard-product-management-v2.png",
    imageAlt: "Gestión de catálogo y asignación de costos unitarios",
    bulletPoints: [
      "Alerta visual en publicaciones sin costo cargado.",
      "Cálculo de rentabilidad estimada por unidad vendida.",
      "Detección de publicaciones pausadas por falta de inventario.",
    ],
  },
  {
    tag: "03. Mercado Libre Ads",
    title: "Medí publicidad con margen",
    description:
      "Evaluá si la inversión en Mercado Libre Ads realmente genera ganancia o si el ACOS está absorbiendo todo el margen de tus productos más vendidos.",
    imageAlt: "Auditoría de inversión publicitaria y margen de Mercado Libre Ads",
    placeholderText: "Marco preparado para captura sanitizada de Mercado Libre Ads",
    bulletPoints: [
      "Cruce directo entre gasto publicitario y ganancia real.",
      "Identificación de campañas que canibalizan el margen neto.",
      "Seguimiento del ACOS y retorno por publicación promocionada.",
    ],
  },
  {
    tag: "04. Depósito & Combos",
    title: "Controlá promociones y stock",
    description:
      "Administrá tus insumos físicos y depósitos. Cuando vendés un combo en Mercado Libre, Klyvo descuenta los componentes individuales para prevenir quiebres de inventario.",
    imageSrc: "/dashboard-internal-stock-v2.png",
    imageAlt: "Control de stock interno y componentes de depósito",
    bulletPoints: [
      "Inventario físico desacoplado de las publicaciones publicadas.",
      "Descuento automático de piezas individuales al vender combos.",
      "Puntos de reorden y alerta preventiva de reposición.",
    ],
  },
];

export function ProductTour() {
  return (
    <section id="recorrido" className="py-20 md:py-28 border-b border-[#DCDAD4] bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Recorrido por el producto
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Pantallas reales diseñadas para operar todos los días.
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Sin mockups inventados. Así se ve y organiza la información de tu cuenta adentro de Klyvo.
          </p>
        </div>

        {/* Alternating Steps */}
        <div className="space-y-20 md:space-y-24">
          {steps.map((step, idx) => {
            const isImageLeft = idx % 2 === 1;

            return (
              <div
                key={idx}
                className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
              >
                {/* Content Column */}
                <div
                  className={`lg:col-span-5 space-y-5 ${
                    isImageLeft ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
                    {step.tag}
                  </span>
                  
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight">
                    {step.title}
                  </h3>

                  <p className="text-base text-[#5F6875] leading-relaxed">
                    {step.description}
                  </p>

                  <ul className="space-y-2.5 pt-2 border-t border-[#DCDAD4]">
                    {step.bulletPoints.map((bp, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5 text-sm text-[#101828]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#102A56] mt-2 shrink-0" />
                        <span>{bp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Screenshot Frame Column */}
                <div
                  className={`lg:col-span-7 ${
                    isImageLeft ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <div className="rounded-xl border border-[#DCDAD4] bg-[#F5F3EE] p-3 shadow-xs">
                    {/* Clean Browser / App Window Chrome */}
                    <div className="flex items-center gap-1.5 pb-2.5 px-2 border-b border-[#DCDAD4] mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#DCDAD4]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#DCDAD4]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#DCDAD4]" />
                      <span className="text-[11px] text-[#5F6875] font-mono ml-2 truncate">
                        app.klyvo.com • {step.title.toLowerCase()}
                      </span>
                    </div>

                    {step.imageSrc ? (
                      <div className="relative rounded-lg overflow-hidden border border-[#DCDAD4] bg-white">
                        <Image
                          src={step.imageSrc}
                          alt={step.imageAlt}
                          width={1200}
                          height={750}
                          className="w-full h-auto object-cover object-top block"
                          priority={idx === 0}
                        />
                      </div>
                    ) : (
                      /* Prepared frame for future sanitized capture */
                      <div className="rounded-lg border border-dashed border-[#DCDAD4] bg-white p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[300px] space-y-4">
                        <div className="w-12 h-12 rounded-lg bg-[#F5F3EE] border border-[#DCDAD4] flex items-center justify-center text-[#102A56] font-bold text-sm">
                          ADS
                        </div>
                        <div className="max-w-md space-y-1">
                          <p className="text-sm font-semibold text-[#101828]">
                            {step.placeholderText}
                          </p>
                          <p className="text-xs text-[#5F6875]">
                            Auditoría de ACOS, atribución de ventas y rentabilidad neta publicitaria en tiempo real.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
