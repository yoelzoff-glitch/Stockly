interface FounderProps {
  name: string;
  role: string;
  area: string;
}

function Founder({ name, role, area }: FounderProps) {
  return (
    <div className="space-y-1">
      <p className="text-base sm:text-lg font-bold text-[#101828] tracking-tight">
        {name}
      </p>
      <p className="text-xs sm:text-sm font-semibold text-[#102A56]">
        {role}
      </p>
      <p className="text-xs sm:text-sm text-[#5F6875] leading-relaxed pt-0.5">
        {area}
      </p>
    </div>
  );
}

export function FounderStory() {
  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Letter / Founder Note */}
        <div className="bg-white rounded-xl border border-[#DCDAD4] p-8 sm:p-12 shadow-xs space-y-6 sm:space-y-8">
          
          {/* Header & Origin Tag */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
              Origen del proyecto
            </span>
            <span className="text-xs font-mono text-[#5F6875] bg-[#F5F3EE] px-3 py-1 rounded border border-[#DCDAD4] w-fit">
              Desarrollado desde la operación
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight leading-tight">
            LibretaX nació de un problema real.
          </h2>

          <div className="space-y-4 text-base sm:text-lg text-[#5F6875] leading-relaxed font-normal">
            <p>
              Administrar una cuenta de Mercado Libre implicaba revisar ventas, costos, comisiones, promociones y cupones en distintos lugares. Entender la ganancia real llevaba demasiado tiempo y dependía de planillas que quedaban desactualizadas.
            </p>
            <p>
              LibretaX nació para reunir toda esa información, reducir el trabajo manual y convertir los datos de la operación en decisiones más claras.
            </p>
          </div>

          {/* Co-Founders Team Block */}
          <div className="pt-6 sm:pt-8 border-t border-[#DCDAD4]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <Founder
                name="Yoel Zoff"
                role="Co-Founder & CTO"
                area="Producto, desarrollo, arquitectura e infraestructura"
              />
              <Founder
                name="Juan Peyret"
                role="Co-Founder"
                area="Branding y estrategia comercial"
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
