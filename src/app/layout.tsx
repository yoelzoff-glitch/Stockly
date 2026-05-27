import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Klyvo - Gestión para Mercado Libre",
  description: "SaaS multi-tenant para vendedores de Mercado Libre",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.className} overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
