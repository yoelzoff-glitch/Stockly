import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { FadeUp } from "./motion";

interface TourStep {
  tag: string;
  path: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  bulletPoints: string[];
}

const steps: TourStep[] = [
  {
    tag: "01 / DASHBOARD & VENTAS",
    path: "app.libretax.com/dashboard/overview",
    title: "Entendé tu rentabilidad",
    description:
      "Visualizá la facturación bruta, las comisiones retenidas, los costos de envío y el resultado neto real de tu cuenta en una sola vista diaria o mensual.",
    imageSrc: "/libretax-dashboard-overview-v3.webp",
    imageAlt: "Dashboard de rentabilidad y ventas de LibretaX",
    bulletPoints: [
      "Total vendido vs. ganancia neta en pesos al centavo.",
      "Desglose de comisiones, envíos y descuentos por período.",
      "Indicador de publicaciones con margen bajo o negativo.",
    ],
  },
  {
    tag: "02 / CATÁLOGO & COSTOS",
    path: "app.libretax.com/dashboard/catalog",
    title: "Detectá costos faltantes",
    description:
      "Identificá qué productos de tu catálogo no tienen asignado su costo de compra o reposición para que ningún cálculo de margen quede incompleto.",
    imageSrc: "/libretax-catalog-costs-v3.webp",
    imageAlt: "Gestión de productos, costos y márgenes en LibretaX",
    bulletPoints: [
      "Alerta visual en publicaciones sin costo cargado.",
      "Cálculo de rentabilidad estimada por unidad vendida.",
      "Detección de publicaciones pausadas por falta de inventario.",
    ],
  },
  {
    tag: "03 / MERCADO LIBRE ADS",
    path: "app.libretax.com/dashboard/ads",
    title: "Medí publicidad con margen",
    description:
      "Evaluá si la inversión en Mercado Libre Ads realmente genera ganancia o si el ACOS está absorbiendo todo el margen de tus productos más vendidos.",
    imageSrc: "/libretax-mercadolibre-ads-v3.webp",
    imageAlt: "Análisis de Mercado Libre Ads y rentabilidad en LibretaX",
    bulletPoints: [
      "Cruce directo entre gasto publicitario y ganancia real.",
      "Identificación de campañas que canibalizan el margen neto.",
      "Seguimiento del ACOS y retorno por publicación promocionada.",
    ],
  },
  {
    tag: "04 / DEPÓSITO & COMBOS",
    path: "app.libretax.com/dashboard/internal-stock",
    title: "Controlá promociones y stock",
    description:
      "Administrá tus insumos físicos y depósitos. Cuando vendés un combo en Mercado Libre, LibretaX descuenta los componentes individuales para prevenir quiebres de inventario.",
    imageSrc: "/libretax-internal-stock-v3.webp",
    imageAlt: "Gestión de depósito y stock interno en LibretaX",
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
        <FadeUp>
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#5B2FE4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Recorrido por el producto
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#101828] tracking-tight">
              Pantallas reales diseñadas para operar todos los días.
            </h2>
            <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
              Sin mockups genéricos. Así se ve y organiza la información de tu cuenta adentro de LibretaX.
            </p>
          </div>
        </FadeUp>

        {/* Alternating Steps */}
        <div className="space-y-20 md:space-y-28">
          {steps.map((step, idx) => {
            const isImageLeft = idx % 2 === 1;

            return (
              <div
                key={step.tag}
                className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center"
              >
                {/* Content Column */}
                <div
                  className={`lg:col-span-5 space-y-5 ${
                    isImageLeft ? "lg:order-2" : "lg:order-1"
                  }`}
                >
                  <FadeUp delay={0.1}>
                    <div className="space-y-4">
                      <span className="text-xs font-mono font-bold text-[#5B2FE4] tracking-wider block">
                        {step.tag}
                      </span>

                      <h3 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight">
                        {step.title}
                      </h3>

                      <p className="text-base text-[#5F6875] leading-relaxed font-normal">
                        {step.description}
                      </p>

                      <ul className="space-y-3 pt-3 border-t border-[#DCDAD4]">
                        {step.bulletPoints.map((bp, bIdx) => (
                          <li
                            key={bIdx}
                            className="flex items-start gap-2.5 text-sm font-medium text-[#101828]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#198754] shrink-0 mt-0.5" />
                            <span>{bp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </FadeUp>
                </div>

                {/* Screenshot Frame Column */}
                <div
                  className={`lg:col-span-7 ${
                    isImageLeft ? "lg:order-1" : "lg:order-2"
                  }`}
                >
                  <FadeUp delay={0.15}>
                    <div className="group rounded-2xl border border-[#DCDAD4] bg-[#F5F3EE] p-2.5 sm:p-3 shadow-md shadow-[#102A56]/5 transition-all duration-300 hover:border-[#102A56]/30">
                      {/* Clean Browser Chrome */}
                      <div className="flex items-center justify-between pb-2.5 px-3 border-b border-[#DCDAD4]/80 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E5E2DA] group-hover:bg-[#EF4444]/60 transition-colors" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E5E2DA] group-hover:bg-[#F59E0B]/60 transition-colors" />
                          <span className="w-2.5 h-2.5 rounded-full bg-[#E5E2DA] group-hover:bg-[#10B981]/60 transition-colors" />
                        </div>
                        <span className="text-[11px] font-mono text-[#5F6875] truncate max-w-[260px] sm:max-w-none">
                          {step.path}
                        </span>
                        <div className="w-10 flex justify-end">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#198754]" />
                        </div>
                      </div>

                      {/* Real Screenshot with high-quality Next/Image rendering */}
                      <div className="relative rounded-xl overflow-hidden border border-[#DCDAD4] bg-white shadow-2xs">
                        <Image
                          src={step.imageSrc}
                          alt={step.imageAlt}
                          width={1440}
                          height={900}
                          className="w-full h-auto object-cover object-top block transition-transform duration-500 group-hover:scale-[1.01]"
                          priority={idx === 0}
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 700px"
                        />
                      </div>
                    </div>
                  </FadeUp>
                </div>
              </div>
            );
          })}
        </div>

        {/* Strategic Mid-Funnel CTA */}
        <FadeUp delay={0.2}>
          <div className="mt-20 p-8 rounded-2xl bg-[#F5F3EE] border border-[#DCDAD4] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-lg font-bold text-[#101828]">
                ¿Querés ver tus propios números con esta claridad?
              </h4>
              <p className="text-sm text-[#5F6875]">
                Conectá tu cuenta de Mercado Libre en menos de 2 minutos sin costo inicial.
              </p>
            </div>
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-all shrink-0 shadow-xs"
            >
              <span>Probar LibretaX</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
