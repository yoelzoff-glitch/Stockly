import Link from "next/link";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  skuLimit: string;
  price: string;
  billingPeriod: string;
  description: string;
  features: string[];
  ctaText: string;
}

const plans: Plan[] = [
  {
    name: "Starter",
    skuLimit: "Hasta 100 SKUs activos",
    price: "$ 49,99 USD",
    billingPeriod: "/ mes",
    description: "Para pequeños vendedores que inician el orden de su operativa.",
    features: [
      "15 días de prueba gratis",
      "Auditoría de comisiones y margen neto",
      "Monitoreo de órdenes y costos de envío",
      "Control de stock interno en depósito",
      "500 consultas de IA mensuales",
      "250 procesos automáticos de sincronización",
      "1 número de WhatsApp vinculado",
    ],
    ctaText: "Probar Starter",
  },
  {
    name: "Pro",
    skuLimit: "Hasta 400 SKUs activos",
    price: "$ 79,99 USD",
    billingPeriod: "/ mes",
    description: "Para catálogos medianos con volumen constante de ventas.",
    features: [
      "Todo lo incluido en Starter",
      "15 días de prueba gratis",
      "Cálculo de rentabilidad sobre Mercado Libre Ads",
      "1.500 consultas de IA mensuales",
      "800 procesos automáticos de sincronización",
      "Hasta 2 números de WhatsApp vinculados",
      "Soporte prioritario por canales directos",
    ],
    ctaText: "Probar Pro",
  },
  {
    name: "Ultra",
    skuLimit: "Hasta 1.000 SKUs activos",
    price: "$ 129,99 USD",
    billingPeriod: "/ mes",
    description: "Para cuentas de alto volumen con múltiples líneas de producto.",
    features: [
      "Todo lo incluido en Pro",
      "15 días de prueba gratis",
      "Seguimiento de combos sin descalce de insumos",
      "5.000 consultas de IA mensuales",
      "1.500 procesos automáticos mensuales",
      "Hasta 2 números de WhatsApp vinculados",
      "Alertas preventivas de quiebre de stock",
    ],
    ctaText: "Probar Ultra",
  },
];

export function Pricing() {
  return (
    <section id="precios" className="py-20 md:py-28 border-b border-[#DCDAD4] bg-[#F5F3EE]">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-2xl mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
            Planes y suscripción
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#101828] tracking-tight">
            Tarifas claras según el tamaño de tu catálogo.
          </h2>
          <p className="text-base sm:text-lg text-[#5F6875] leading-relaxed">
            Todos los planes incluyen 15 días de prueba gratis sin tarjeta obligatoria. Facturación mensual en USD o equivalente en moneda local vía Mercado Pago.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="bg-white rounded-xl border border-[#DCDAD4] p-7 sm:p-8 flex flex-col justify-between shadow-xs"
            >
              <div>
                <div className="border-b border-[#DCDAD4] pb-5 mb-5">
                  <span className="text-xs font-semibold text-[#5F6875] uppercase tracking-wider block">
                    {plan.skuLimit}
                  </span>
                  <h3 className="text-2xl font-bold text-[#101828] mt-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-[#5F6875] mt-1.5 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-[#101828] tabular-nums">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium text-[#5F6875]">
                      {plan.billingPeriod}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#101828]">
                      <Check className="w-4 h-4 text-[#198754] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/register"
                className="w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-semibold text-[#102A56] bg-[#F5F3EE] hover:bg-[#EAE7DF] border border-[#DCDAD4] transition-colors"
              >
                {plan.ctaText}
              </Link>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="mt-8 text-xs text-[#5F6875] text-center">
          Podés pausar o cambiar de plan en cualquier momento desde tu panel de facturación.
        </p>

      </div>
    </section>
  );
}
