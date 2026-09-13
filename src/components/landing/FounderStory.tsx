import { FadeUp } from "./motion";

interface FounderProps {
  name: string;
  role: string;
  area: string;
  initials: string;
}

function Founder({ name, role, area, initials }: FounderProps) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-[rgba(0,57,104,0.02)] border border-[rgba(0,57,104,0.10)]">
      <div className="w-11 h-11 rounded-xl bg-white border border-[rgba(0,57,104,0.12)] flex items-center justify-center font-bold text-sm text-[#003968] shrink-0 shadow-2xs">
        {initials}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-base font-bold text-[#002B4D] tracking-tight">
          {name}
        </p>
        <p className="text-xs sm:text-sm font-semibold text-[#003968]">
          {role}
        </p>
        <p className="text-xs sm:text-sm text-[rgba(0,43,77,0.70)] leading-relaxed pt-0.5">
          {area}
        </p>
      </div>
    </div>
  );
}

export function FounderStory() {
  return (
    <section className="py-20 md:py-28 border-b border-[rgba(0,57,104,0.10)] bg-[rgba(0,57,104,0.02)]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp>
          {/* Editorial Letter / Founder Note */}
          <div className="bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] p-8 sm:p-12 shadow-sm space-y-7 sm:space-y-8">
            {/* Header & Origin Tag */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm bg-[#00DFDB]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#003968]">
                  Origen del proyecto
                </span>
              </div>
              <span className="text-xs font-mono text-[rgba(0,43,77,0.70)] bg-[rgba(0,57,104,0.04)] px-3 py-1 rounded-md border border-[rgba(0,57,104,0.12)] w-fit">
                Desarrollado desde la operación
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[#002B4D] tracking-tight leading-tight">
              LibretaX nació de un problema real.
            </h2>

            <div className="space-y-4 text-base sm:text-lg text-[rgba(0,43,77,0.70)] leading-relaxed font-normal border-l-2 border-[#00DFDB] pl-4 sm:pl-6">
              <p>
                Administrar una cuenta de Mercado Libre implicaba revisar ventas, costos, comisiones, promociones y cupones en distintos lugares. Entender la ganancia real llevaba demasiado tiempo y dependía de planillas que quedaban desactualizadas.
              </p>
              <p>
                LibretaX nació para reunir toda esa información, reducir el trabajo manual y convertir los datos de la operación en decisiones más claras.
              </p>
            </div>

            {/* Co-Founders Team Block */}
            <div className="pt-6 sm:pt-8 border-t border-[rgba(0,57,104,0.10)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Founder
                  name="Yoel Zoff"
                  role="Co-founder & CTO / Lead Developer"
                  area="Producto, desarrollo, arquitectura e infraestructura"
                  initials="YZ"
                />
                <Founder
                  name="Juan Peyret"
                  role="Co-founder & Head of Strategy & Brand"
                  area="Branding y estrategia comercial"
                  initials="JP"
                />
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
