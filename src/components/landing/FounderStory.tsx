export function FounderStory() {
  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Letter / Founder Note */}
        <div className="bg-white rounded-xl border border-[#DCDAD4] p-8 sm:p-12 shadow-xs space-y-6">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Origen del proyecto
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight leading-tight">
            Klyvo nació de un problema real.
          </h2>

          <div className="space-y-4 text-base sm:text-lg text-[#5F6875] leading-relaxed font-normal">
            <p>
              Administrar una cuenta de Mercado Libre implicaba revisar ventas, costos, comisiones, promociones y cupones en distintos lugares. Entender la ganancia real llevaba demasiado tiempo y dependía de planillas que quedaban desactualizadas.
            </p>
            <p>
              Klyvo nació para reunir toda esa información, reducir el trabajo manual y convertir los datos de la operación en decisiones más claras.
            </p>
          </div>

          <div className="pt-6 border-t border-[#DCDAD4] flex items-center justify-between">
            <div>
              <p className="text-base font-bold text-[#101828]">
                Yoel Zoff
              </p>
              <p className="text-xs font-medium text-[#5F6875]">
                Creador de Klyvo
              </p>
            </div>
            <span className="text-xs font-mono text-[#5F6875] bg-[#F5F3EE] px-3 py-1 rounded border border-[#DCDAD4]">
              Desarrollado desde la operación
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
