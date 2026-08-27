import { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LogoCloud } from "@/components/landing/LogoCloud";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { RoiCalculator } from "@/components/landing/RoiCalculator";
import { ChatDemo } from "@/components/landing/ChatDemo";
import { Screenshots } from "@/components/landing/Screenshots";
import { Benefits } from "@/components/landing/Benefits";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Klyvo | Copiloto e Inteligencia Operativa para Mercado Libre",
  description: "Audita tus costos reales, recuperá comisiones impositivas y automatizá stock, repricing y títulos SEO en Mercado Libre.",
  openGraph: {
    type: "website",
    title: "Klyvo | Copiloto e Inteligencia Operativa para Mercado Libre",
    description: "Audita tus costos reales, recuperá comisiones impositivas y automatizá stock, repricing y títulos SEO en Mercado Libre.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klyvo | Copiloto e Inteligencia Operativa para Mercado Libre",
    description: "Audita tus costos reales, recuperá comisiones impositivas y automatizá stock, repricing y títulos SEO en Mercado Libre.",
  }
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      <Navbar />
      <main>
        <Hero />
        <LogoCloud />
        <Problem />
        <Solution />
        <RoiCalculator />
        <ChatDemo />
        <Screenshots />
        <Benefits />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
