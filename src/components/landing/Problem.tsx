export function Problem() {
  const problems = [
    {
      num: "01",
      title: "Costos repartidos entre distintas pantallas",
      description:
        "Mercado Libre separa los cobros por publicación, cargos de envío y retenciones fiscales en reportes diferentes. Calcular si una venta dejó dinero exige cruzar múltiples pantallas y comprobantes dispersos.",
    },
    {
      num: "02",
      title: "Promociones que aumentan ventas pero reducen margen",
      description:
        "Participar en campañas de descuento o cupones co-financiados incrementa el volumen de órdenes, pero sin el costo unitario exacto podés terminar absorbiendo rebajas que diluyen por completo la ganancia de bolsillo.",
    },
    {
      num: "03",
      title: "Planillas que quedan desactualizadas",
      description:
        "Los costos de reposición de insumos cambian periódicamente, las alícuotas se actualizan y las tarifas de envío varían. Las planillas manuales quedan obsoletas rápido, generando ventas a pérdida sin advertencia previa.",
    },
  ];

  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Section Header */}
        <div className="max-w-3xl mb-16 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            El problema operativo
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight leading-tight">
            Vender más no siempre significa ganar más.
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Entre comisiones, envíos, descuentos, publicidad y costos de reposición, el margen puede desaparecer sin que lo veas. Klyvo organiza toda esa información para que puedas decidir con números reales.
          </p>
        </div>

        {/* Editorial Numbered 01, 02, 03 Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 border-t border-[#DCDAD4] pt-10">
          {problems.map((prob) => (
            <div key={prob.num} className="space-y-3">
              <span className="text-3xl font-extrabold text-[#102A56] tabular-nums block">
                {prob.num}
              </span>
              <h3 className="text-lg font-bold text-[#101828] leading-snug">
                {prob.title}
              </h3>
              <p className="text-sm text-[#5F6875] leading-relaxed font-normal">
                {prob.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
