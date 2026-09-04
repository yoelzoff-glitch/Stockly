import { KeyRound, RefreshCw, BarChart2 } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: KeyRound,
      title: "Conectás tu cuenta",
      description:
        "Autorizás la conexión mediante el protocolo oficial OAuth de Mercado Libre. Klyvo nunca solicita ni almacena la contraseña de tu cuenta.",
    },
    {
      num: "02",
      icon: RefreshCw,
      title: "Klyvo sincroniza",
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
        <div className="max-w-2xl mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Paso a paso
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Cómo funciona Klyvo
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Una integración pensada para empezar a trabajar con datos reales de tu cuenta de forma ordenada y segura.
          </p>
        </div>

        {/* 3 Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-[#F5F3EE] rounded-xl border border-[#DCDAD4] p-6 sm:p-7 space-y-4 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-2xl font-extrabold text-[#102A56] tabular-nums">
                      {step.num}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-white border border-[#DCDAD4] flex items-center justify-center text-[#102A56]">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#101828] mb-2">
                    {step.title}
                  </h3>

                  <p className="text-sm text-[#5F6875] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
