import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#101828] tracking-tight leading-tight">
          Tu operación ya genera los datos. <br className="hidden sm:inline" />
          Klyvo te ayuda a entenderlos.
        </h2>

        <p className="text-base sm:text-lg text-[#5F6875] max-w-xl mx-auto leading-relaxed">
          Conectá tu cuenta, cargá tus costos y empezá a conocer la rentabilidad real de tus ventas.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg text-sm font-semibold text-white bg-[#102A56] hover:bg-[#0A1D3C] transition-colors shadow-xs"
          >
            <span>Probar Klyvo</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 rounded-lg text-sm font-semibold text-[#101828] bg-white hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors"
          >
            Ingresar
          </Link>
        </div>

        <p className="text-xs text-[#5F6875] pt-2">
          15 días de prueba sin tarjeta obligatoria. Conexión oficial mediante Mercado Libre OAuth.
        </p>

      </div>
    </section>
  );
}
