import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-white text-[#5F6875] border-t border-[#DCDAD4] py-14 lg:py-16">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          
          {/* Col 1: Brand & Desc (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" aria-label="Klyvo inicio">
              <img
                src="/logo.png"
                alt="Klyvo"
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-sm text-[#5F6875] leading-relaxed max-w-sm">
              Plataforma para vendedores de Mercado Libre. Centralizá ventas, costos, comisiones, envíos, publicidad y stock para conocer tu rentabilidad real.
            </p>
            <div className="pt-2 text-xs text-[#102A56] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#198754]" />
              <span>Conexión oficial mediante Mercado Libre OAuth 2.0</span>
            </div>
          </div>

          {/* Col 2: Navegación (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101828]">
              Navegación
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="#recorrido" className="hover:text-[#101828] transition-colors">
                  Recorrido del producto
                </Link>
              </li>
              <li>
                <Link href="#modulos" className="hover:text-[#101828] transition-colors">
                  Módulos y funciones
                </Link>
              </li>
              <li>
                <Link href="#como-funciona" className="hover:text-[#101828] transition-colors">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="#precios" className="hover:text-[#101828] transition-colors">
                  Planes y tarifas
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-[#101828] transition-colors">
                  Preguntas frecuentes
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Acceso y Legal (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101828]">
              Acceso y Legal
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/login" className="hover:text-[#101828] transition-colors">
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-[#101828] transition-colors">
                  Registrarse en Klyvo
                </Link>
              </li>
              <li>
                <Link href="/terminos" className="hover:text-[#101828] transition-colors">
                  Términos y condiciones del servicio
                </Link>
              </li>
              <li>
                <Link href="/privacidad" className="hover:text-[#101828] transition-colors">
                  Políticas de privacidad y datos
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-[#DCDAD4] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5F6875]">
          <p>
            &copy; {new Date().getFullYear()} Klyvo. Todos los derechos reservados.
          </p>
          <p className="text-center sm:text-right">
            Klyvo no está afiliado a MercadoLibre S.R.L. Integración desarrollada mediante su API pública oficial.
          </p>
        </div>
      </div>
    </footer>
  );
}
