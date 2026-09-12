import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { WebAnalyticsTracker } from "@/components/analytics/WebAnalyticsTracker";
import { GoogleAnalytics } from "@next/third-parties/google";
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
        url: "/libretax-logo.png",
        width: 1448,
        height: 1086,
        alt: "LibretaX",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LibretaX | Rentabilidad y gestión para Mercado Libre",
    description:
      "Analizá ventas, costos, márgenes, publicidad y rentabilidad de tu cuenta de Mercado Libre desde un solo lugar.",
    images: ["/libretax-logo.png"],
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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/icono.png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-N8VC2V7K08";

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.className} overflow-x-hidden`}>
        <WebAnalyticsTracker />
        {children}
        <GoogleAnalytics gaId={gaId} />
      </body>
    </html>
  );
}
