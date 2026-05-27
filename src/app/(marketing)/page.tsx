import { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { LogoCloud } from "@/components/landing/LogoCloud";
import { Problem } from "@/components/landing/Problem";
import { Solution } from "@/components/landing/Solution";
import { ChatDemo } from "@/components/landing/ChatDemo";
import { Screenshots } from "@/components/landing/Screenshots";
import { Timeline } from "@/components/landing/Timeline";
import { Benefits } from "@/components/landing/Benefits";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Klyvo | IA para vendedores de Mercado Libre",
  description: "Controlá inventario, ganancias, promociones y automatizaciones con IA.",
  openGraph: {
    type: "website",
    title: "Klyvo | IA para vendedores de Mercado Libre",
    description: "Controlá inventario, ganancias, promociones y automatizaciones con IA.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Klyvo | IA para vendedores de Mercado Libre",
    description: "Controlá inventario, ganancias, promociones y automatizaciones con IA.",
  }
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main>
        <Hero />
        <LogoCloud />
        <Problem />
        <Solution />
        <ChatDemo />
        <Screenshots />
        <Timeline />
        <Benefits />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
