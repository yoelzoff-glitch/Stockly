import type { MetadataRoute } from "next";

const BASE_URL = "https://www.libretax.com.ar";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacidad", "/terminos"],
      disallow: [
        "/dashboard/",
        "/dashboard",
        "/super-admin/",
        "/super-admin",
        "/admin/",
        "/admin",
        "/api/",
        "/auth/",
        "/login",
        "/register",
        "/onboarding/",
        "/onboarding",
        "/account-paused",
        "/propuesta",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
