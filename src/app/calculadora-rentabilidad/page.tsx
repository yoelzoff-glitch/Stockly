// src/app/calculadora-rentabilidad/page.tsx
import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PublicProfitabilityCalculator } from "@/components/calculator/PublicProfitabilityCalculator";
import { createClient } from "@/lib/supabase/server";
import { HelpCircle, ChevronRight, Calculator, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Calculadora de Rentabilidad Mercado Libre | LibretaX",
  description:
    "Calculá gratis cuánto ganás vendiendo en Mercado Libre. Simulá comisiones, costos, envíos y margen antes de publicar un producto.",
  alternates: {
    canonical: "https://www.libretax.com.ar/calculadora-rentabilidad",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://www.libretax.com.ar/calculadora-rentabilidad",
    siteName: "LibretaX",
    title: "Calculadora de Rentabilidad Mercado Libre | LibretaX",
    description:
      "Calculá gratis cuánto ganás vendiendo en Mercado Libre. Simulá comisiones, costos, envíos y margen antes de publicar un producto.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Calculadora de Rentabilidad Mercado Libre | LibretaX",
    description:
      "Calculá gratis cuánto ganás vendiendo en Mercado Libre. Simulá comisiones, costos, envíos y margen antes de publicar un producto.",
  },
};

const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Calculadora de Rentabilidad Mercado Libre | LibretaX",
  url: "https://www.libretax.com.ar/calculadora-rentabilidad",
  applicationCategory: "BusinessApplication",
  operatingSystem: "All",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "ARS",
  },
  description:
    "Calculá gratis cuánto ganás vendiendo en Mercado Libre. Simulá comisiones, costos, envíos y margen antes de publicar un producto.",
  inLanguage: "es",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Inicio",
      item: "https://www.libretax.com.ar",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Calculadora de Rentabilidad",
      item: "https://www.libretax.com.ar/calculadora-rentabilidad",
    },
  ],
};

export default async function PublicCalculatorPage() {
  let isAuthenticated = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {
    isAuthenticated = false;
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#002B4D] flex flex-col selection:bg-[#F2C94C] selection:text-[#101828]">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Navbar />

      <main className="flex-1 pt-24 sm:pt-28 pb-16 lg:pb-24">
        {/* Header / Hero Section */}
        <section className="bg-gradient-to-b from-[#F5F3EE] via-[#F5F3EE]/60 to-white pt-8 pb-12 sm:pb-16 border-b border-[rgba(0,57,104,0.08)]">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 space-y-4 text-center sm:text-left">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center justify-center sm:justify-start gap-1 text-xs text-[rgba(0,43,77,0.60)] font-medium">
              <Link href="/" className="hover:text-[#003968] transition-colors">
                Inicio
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#002B4D] font-bold">Calculadora de Rentabilidad</span>
            </nav>

            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(0,57,104,0.06)] border border-[rgba(0,57,104,0.12)] text-xs font-bold text-[#003968]">
                <Calculator className="w-3.5 h-3.5 text-[#00DFDB]" />
                <span>Simulador Gratuito de Publicaciones</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#002B4D] leading-tight">
                Calculadora de Rentabilidad para Mercado Libre
              </h1>

              <p className="text-base sm:text-lg text-[rgba(0,43,77,0.75)] leading-relaxed">
                Calculá gratis y con precisión matemática cuánto te queda en mano de cada venta. Simulá comisiones de Clásica y Premium, bonificación de Mercado Envíos, Product Ads y determiná el precio de venta ideal para alcanzar tu margen deseado.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Calculator Section */}
        <section className="py-10 sm:py-14">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
            <PublicProfitabilityCalculator isAuthenticated={isAuthenticated} />
          </div>
        </section>

        {/* Informative / Educational FAQ Section for SEO */}
        <section className="py-12 lg:py-16 bg-[#F5F3EE]/50 border-t border-[rgba(0,57,104,0.08)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002B4D]">
                Preguntas frecuentes sobre costos en Mercado Libre
              </h2>
              <p className="text-sm text-[rgba(0,43,77,0.70)]">
                Todo lo que necesitás saber antes de fijar precios y publicar tus productos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm">
              <div className="bg-white p-5 rounded-2xl border border-[rgba(0,57,104,0.10)] shadow-2xs space-y-2">
                <h3 className="font-bold text-[#002B4D]">
                  ¿Cuál es la diferencia entre Margen y ROI (Rentabilidad sobre costo)?
                </h3>
                <p className="text-[rgba(0,43,77,0.70)] leading-relaxed text-xs">
                  <strong>Margen</strong> es la ganancia dividida por el precio de venta (por ejemplo, si ganás $2.500 de un precio de $10.000, tu margen es 25%). <strong>ROI</strong> es la ganancia dividida por el costo de compra del producto (si tu costo fue $5.000 y ganás $2.500, tu ROI es 50%).
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[rgba(0,57,104,0.10)] shadow-2xs space-y-2">
                <h3 className="font-bold text-[#002B4D]">
                  ¿Cómo funciona la bonificación de Mercado Envíos?
                </h3>
                <p className="text-[rgba(0,43,77,0.70)] leading-relaxed text-xs">
                  Para ventas mayores o iguales a $33.000 en Argentina, el envío gratis es obligatorio en publicaciones de productos nuevos. Mercado Libre bonifica hasta un 50% de la tarifa oficial para vendedores con reputación verde, y el 50% restante lo asume el vendedor.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[rgba(0,57,104,0.10)] shadow-2xs space-y-2">
                <h3 className="font-bold text-[#002B4D]">
                  ¿Qué diferencia hay entre publicación Clásica y Premium?
                </h3>
                <p className="text-[rgba(0,43,77,0.70)] leading-relaxed text-xs">
                  La publicación <strong>Clásica</strong> tiene una comisión más baja (generalmente entre 11% y 16% según la categoría). La publicación <strong>Premium</strong> tiene una comisión mayor (aproximadamente entre 27% y 32%) porque incluye cuotas sin interés para el comprador financiadas por Mercado Libre.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[rgba(0,57,104,0.10)] shadow-2xs space-y-2">
                <h3 className="font-bold text-[#002B4D]">
                  ¿Por qué no sirve calcular el precio como costo * (1 + margen)?
                </h3>
                <p className="text-[rgba(0,43,77,0.70)] leading-relaxed text-xs">
                  Porque las comisiones de Mercado Libre, impuestos y Product Ads se calculan como un porcentaje del <strong>precio final de venta</strong>, no del costo. Si multiplicás costo * 1,25 y luego Mercado Libre te descuenta un 20% del total, perderás dinero. La calculadora resuelve la fórmula matemática exacta.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
