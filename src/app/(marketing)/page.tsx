import { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { ProductTour } from "@/components/landing/ProductTour";
import { FeatureIndex } from "@/components/landing/FeatureIndex";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FounderStory } from "@/components/landing/FounderStory";
import { SecurityAndIntegrations } from "@/components/landing/SecurityAndIntegrations";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Klyvo | Rentabilidad y gestión para Mercado Libre",
  description:
    "Centralizá ventas, costos, comisiones, promociones, publicidad y stock. Conocé la rentabilidad real de tu operación en Mercado Libre.",
  openGraph: {
    type: "website",
    title: "Klyvo | Rentabilidad y gestión para Mercado Libre",
    description:
      "Centralizá ventas, costos, comisiones, promociones, publicidad y stock. Conocé la rentabilidad real de tu operación en Mercado Libre.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klyvo | Rentabilidad y gestión para Mercado Libre",
    description:
      "Centralizá ventas, costos, comisiones, promociones, publicidad y stock. Conocé la rentabilidad real de tu operación en Mercado Libre.",
  },
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#101828]">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <ProductTour />
        <FeatureIndex />
        <HowItWorks />
        <FounderStory />
        <SecurityAndIntegrations />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
