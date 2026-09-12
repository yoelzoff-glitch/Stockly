import type { MetadataRoute } from "next";

const BASE_URL = "https://www.libretax.com.ar";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacidad`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terminos`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
