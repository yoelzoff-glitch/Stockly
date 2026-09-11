import "server-only";

export interface GeoLocation {
  countryCode: string;
  countryName: string;
  regionCode: string;
  regionName: string;
  city: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  UY: "Uruguay",
  CL: "Chile",
  BR: "Brasil",
  PY: "Paraguay",
  BO: "Bolivia",
  PE: "Perú",
  CO: "Colombia",
  MX: "México",
  ES: "España",
  US: "Estados Unidos",
};

const AR_PROVINCES: Record<string, string> = {
  B: "Buenos Aires",
  BA: "Buenos Aires",
  C: "Ciudad Autónoma de Buenos Aires",
  CABA: "Ciudad Autónoma de Buenos Aires",
  DF: "Ciudad Autónoma de Buenos Aires",
  X: "Córdoba",
  CBA: "Córdoba",
  S: "Santa Fe",
  SF: "Santa Fe",
  M: "Mendoza",
  MZ: "Mendoza",
  T: "Tucumán",
  E: "Entre Ríos",
  ER: "Entre Ríos",
  W: "Corrientes",
  CR: "Corrientes",
  N: "Misiones",
  MN: "Misiones",
  H: "Chaco",
  CH: "Chaco",
  P: "Formosa",
  FO: "Formosa",
  Y: "Jujuy",
  JY: "Jujuy",
  A: "Salta",
  SA: "Salta",
  K: "Catamarca",
  CT: "Catamarca",
  F: "La Rioja",
  LR: "La Rioja",
  J: "San Juan",
  SJ: "San Juan",
  D: "San Luis",
  SL: "San Luis",
  L: "La Pampa",
  LP: "La Pampa",
  Q: "Neuquén",
  NQ: "Neuquén",
  R: "Río Negro",
  RN: "Río Negro",
  U: "Chubut",
  CHB: "Chubut",
  Z: "Santa Cruz",
  SC: "Santa Cruz",
  V: "Tierra del Fuego",
  TF: "Tierra del Fuego",
};

/**
 * Resolves visitor geographic information from reverse-proxy and CDN headers.
 * Never throws. Never persists full IP address.
 */
export function resolveVisitorGeo(req: Request): GeoLocation {
  const headers = req.headers;

  const rawCountry =
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    "UNKNOWN";

  const rawRegion =
    headers.get("x-vercel-ip-country-region") ||
    headers.get("cf-region-code") ||
    headers.get("x-region-code") ||
    "UNKNOWN";

  const rawCity =
    headers.get("x-vercel-ip-city") ||
    headers.get("cf-ipcity") ||
    headers.get("x-city") ||
    "";

  const countryCode = rawCountry.trim().toUpperCase();
  const regionCode = rawRegion.trim().toUpperCase();
  
  let city = "";
  try {
    city = decodeURIComponent(rawCity.trim());
  } catch {
    city = rawCity.trim();
  }

  const countryName = COUNTRY_NAMES[countryCode] || (countryCode === "UNKNOWN" ? "Desconocido" : countryCode);

  let regionName = "Otras";
  if (countryCode === "AR") {
    regionName = AR_PROVINCES[regionCode] || (regionCode === "UNKNOWN" ? "Desconocida" : regionCode);
  } else if (regionCode !== "UNKNOWN") {
    regionName = regionCode;
  } else {
    regionName = "Desconocida";
  }

  return {
    countryCode,
    countryName,
    regionCode,
    regionName,
    city: city || "Desconocida",
  };
}
