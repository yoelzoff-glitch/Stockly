/**
 * Centralized application configuration and branding constants for LibretaX.
 */
export const APP_CONFIG = {
  name: "LibretaX",
  shortName: "LibretaX",
  tagline: "Gestión y rentabilidad en tiempo real para vendedores de Mercado Libre",
  description: "SaaS multi-tenant para vendedores de Mercado Libre",
  companyName: "LibretaX",
  supportEmail: "soporte@libretax.com",
  privacyEmail: "privacidad@libretax.com",
  salesEmail: "contacto@libretax.com",
  defaultUrl: process.env.NEXT_PUBLIC_APP_URL || "https://libretax.com",
} as const;
