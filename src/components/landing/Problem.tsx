import { FadeUp } from "./motion";

export function Problem() {
  const problems = [
    {
      num: "01",
      tag: "Dispersión",
      title: "Costos repartidos entre distintas pantallas",
      description:
        "Mercado Libre separa los cobros por publicación, cargos de envío y retenciones fiscales en reportes diferentes. Calcular si una venta dejó dinero exige cruzar múltiples pantallas y comprobantes dispersos.",
    },
    {
      num: "02",
      tag: "Canibalización",
      title: "Promociones que aumentan ventas pero reducen margen",
      description:
        "Participar en campañas de descuento o cupones co-financiados incrementa el volumen de órdenes, pero sin el costo unitario exacto podés terminar absorbiendo rebajas que diluyen por completo la ganancia de bolsillo.",
    },
    {
      num: "03",
      tag: "Desactualización",
      title: "Planillas que quedan desactualizadas",
      description:
        "Los costos de reposición de insumos cambian periódicamente, las alícuotas se actualizan y las tarifas de envío varían. Las planillas manuales quedan obsoletas rápido, generando ventas a pérdida sin advertencia previa.",
    },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-[rgba(0,57,104,0.10)] bg-[rgba(0,57,104,0.02)]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <FadeUp>
          <div className="max-w-3xl mb-16 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-sm bg-[#00DFDB]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#003968]">
                El problema operativo
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#002B4D] tracking-tight leading-tight">
              Vender más no siempre significa ganar más.
            </h2>
            <p className="text-base sm:text-lg text-[rgba(0,43,77,0.70)] leading-relaxed font-normal">
              Entre comisiones, envíos, descuentos, publicidad y costos de reposición, el margen puede desaparecer sin que lo veas. LibretaX organiza toda esa información para que puedas decidir con números reales.
            </p>
          </div>
        </FadeUp>

        {/* 3 Numbered Operational Problem Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {problems.map((prob, idx) => (
            <FadeUp key={prob.num} delay={0.1 + idx * 0.1}>
              <div className="h-full bg-white rounded-xl border border-[rgba(0,57,104,0.12)] p-7 flex flex-col justify-between shadow-2xs hover:shadow-xs hover:border-[rgba(0,223,219,0.50)] transition-all duration-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-extrabold text-[#003968] tabular-nums">
                      {prob.num}
                    </span>
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[rgba(0,57,104,0.04)] text-[rgba(0,43,77,0.70)] border border-[rgba(0,57,104,0.12)]">
                      {prob.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#002B4D] leading-snug">
                    {prob.title}
                  </h3>

                  <p className="text-sm text-[rgba(0,43,77,0.70)] leading-relaxed font-normal">
                    {prob.description}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-[rgba(0,57,104,0.10)]">
                  <span className="text-xs font-mono text-[#003968]">
                    LibretaX resuelve con datos unificados
                  </span>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
