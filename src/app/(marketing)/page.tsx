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
import { LeadCaptureModal } from "@/components/landing/LeadCaptureModal";

export const metadata: Metadata = {
  title: "LibretaX | Rentabilidad y gestión para Mercado Libre",
  description:
    "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
  alternates: {
    canonical: "https://www.libretax.com.ar",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://www.libretax.com.ar",
    siteName: "LibretaX",
    title: "LibretaX | Rentabilidad y gestión para Mercado Libre",
    description:
      "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LibretaX | Rentabilidad y gestión para Mercado Libre",
    description:
      "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LibretaX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://www.libretax.com.ar",
  description:
    "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
  inLanguage: "es",
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#F5F3EE] text-[#101828]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
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
      <LeadCaptureModal />
    </div>
  );
}
