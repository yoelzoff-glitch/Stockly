import { CompetitorAnalysisError, ParsedCompetitorUrl } from "./types";

/**
 * Robust parser for Mercado Libre competitor URLs and identifiers.
 * Accepts:
 * - Direct IDs: MLA1234567890, MLA-1234567890, MLAU12345678
 * - Standard product URLs: https://articulo.mercadolibre.com.ar/MLA-1234567890-titulo...
 * - Catalog URLs: /p/MLA12345678, /up/MLA12345678, MLAU...
 * - URLs with listing override: ?wid=MLA1234567890 or &wid=MLA1234567890
 * - Tracking/recommendation query strings and mobile links
 */
export function parseCompetitorUrl(input: string): ParsedCompetitorUrl {
  if (!input || typeof input !== "string" || !input.trim()) {
    throw new CompetitorAnalysisError(
      "INVALID_COMPETITOR_URL",
      "URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre.",
      400
    );
  }

  const raw = input.trim();

  // 1. Check for 'wid' parameter (catalog listing variant)
  const widMatch = raw.match(/[?&#]wid=(ML[A-Z]{0,2}\d{6,14})/i);
  const hasWid = Boolean(widMatch);
  let widItemId: string | null = widMatch ? widMatch[1].toUpperCase() : null;

  // 2. Check for Catalog Product ID (/p/..., /up/..., MLAU...)
  let catalogProductId: string | null = null;
  const pMatch = raw.match(/\/(?:p|up)\/(ML[A-Z]{0,2}\d{5,14})/i);
  if (pMatch) {
    catalogProductId = pMatch[1].toUpperCase();
  } else {
    const mlauMatch = raw.match(/\b(MLAU\d{5,14})\b/i);
    if (mlauMatch) {
      catalogProductId = mlauMatch[1].toUpperCase();
    }
  }

  // 3. Check for standard item ID (e.g. MLA-1234567890 or MLA1234567890)
  let standardItemId: string | null = null;
  const itemMatch = raw.match(/(ML[A-Z]{1,2})[-_]?(\d{6,14})/i);
  if (itemMatch) {
    standardItemId = `${itemMatch[1].toUpperCase()}${itemMatch[2]}`;
  }

  // 4. Resolve primary itemId and probable type
  const itemId = widItemId || (catalogProductId && !hasWid ? null : standardItemId);

  // If neither catalogProductId nor itemId could be found, it's invalid
  if (!itemId && !catalogProductId) {
    throw new CompetitorAnalysisError(
      "INVALID_COMPETITOR_URL",
      "URL inválida. Asegúrate de ingresar un enlace válido de una publicación de Mercado Libre.",
      400
    );
  }

  // Determine probable type
  // If hasWid is true, it's targeted to an item listing even inside a catalog URL
  const probableType: "item" | "catalog" =
    !hasWid && (Boolean(catalogProductId) || (itemId ? itemId.startsWith("MLAU") : false))
      ? "catalog"
      : "item";

  // Derive siteId (e.g., MLA, MLB, MLM, MLC, MLU)
  const candidate = itemId || catalogProductId || "";
  const siteMatch = candidate.match(/^(ML[A-Z]{1})/);
  const siteId = siteMatch ? siteMatch[1] : "MLA";

  return {
    originalUrl: raw,
    itemId: itemId || standardItemId,
    catalogProductId,
    hasWid,
    siteId,
    probableType,
  };
}
