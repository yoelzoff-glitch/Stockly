import { KeyRound, RefreshCw, BarChart2 } from "lucide-react";
import { FadeUp } from "./motion";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: KeyRound,
      title: "Conectás tu cuenta",
      description:
        "Autorizás la conexión mediante el protocolo oficial OAuth de Mercado Libre. LibretaX nunca solicita ni almacena la contraseña de tu cuenta.",
    },
    {
      num: "02",
      icon: RefreshCw,
      title: "LibretaX sincroniza",
      description:
        "El sistema importa tu catálogo de publicaciones, órdenes recientes, envíos y cargos asociados para construir la base de indicadores.",
    },
    {
      num: "03",
      icon: BarChart2,
      title: "Decidís con información real",
      description:
        "Cargás tus costos de compra o reposición y analizás ventas, márgenes netos, promociones, publicidad y stock desde un único lugar.",
    },
  ];

  return (
    <section id="como-funciona" className="py-20 md:py-28 border-b border-[#DCDAD4] bg-white">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="max-w-2xl mb-16 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#5B2FE4]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#102A56]">
                Paso a paso
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#101828] tracking-tight">
              Cómo funciona LibretaX
            </h2>
            <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
              Una integración pensada para empezar a trabajar con datos reales de tu cuenta de forma ordenada y segura.
            </p>
          </div>
        </FadeUp>

        {/* 3 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <FadeUp key={step.num} delay={0.1 + idx * 0.1}>
                <div className="h-full bg-[#F5F3EE] rounded-2xl border border-[#DCDAD4] p-7 sm:p-8 flex flex-col justify-between shadow-2xs hover:shadow-xs hover:border-[#102A56]/30 transition-all duration-200">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-3xl font-extrabold text-[#102A56] tabular-nums">
                        {step.num}
                      </span>
                      <div className="w-12 h-12 rounded-xl bg-white border border-[#DCDAD4] flex items-center justify-center text-[#102A56] shadow-2xs">
                        <Icon className="w-5 h-5 text-[#5B2FE4]" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-[#101828] mb-2.5">
                      {step.title}
                    </h3>

                    <p className="text-sm text-[#5F6875] leading-relaxed font-normal">
                      {step.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#DCDAD4]/80">
                    <span className="text-[11px] font-mono text-[#5F6875]">
                      Paso {step.num} de 03
                    </span>
                  </div>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
