import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { WebAnalyticsTracker } from "@/components/analytics/WebAnalyticsTracker";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.libretax.com.ar"),
  title: {
    default: "LibretaX | Rentabilidad y gestión para Mercado Libre",
    template: "%s | LibretaX",
  },
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
    images: [
      {
        url: "/favicon.png",
        width: 512,
        height: 512,
        alt: "LibretaX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LibretaX | Rentabilidad y gestión para Mercado Libre",
    description:
      "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
    images: ["/favicon.png"],
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
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/icono.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.className} overflow-x-hidden`}>
        <WebAnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
