// src/services/products/sku/parseCompositeSku.ts
import { normalizeSku } from "./normalizeSku";

export interface ParsedCompositeSku {
  sku_normalized: string;
  components: string[];
  tokens: string[];
}

/**
 * Parsea un SKU compuesto y extrae sus componentes lógicos.
 * Regla de componente: [Letras] [Números] [Sufijo Opcional Letras]
 * Si el SKU está formado por varios componentes, los separa.
 * 
 * @param sku El SKU crudo
 * @returns El objeto con componentes extraídos
 */
export function parseCompositeSku(sku: string): ParsedCompositeSku {
  const normalized = normalizeSku(sku);
  if (!normalized) {
    return { sku_normalized: "", components: [], tokens: [] };
  }

  const tokens = normalized.split(" ");
  
  // Regex para encontrar componentes: Letras + Numeros + (Opcionalmente Letras si no están seguidas de Numeros)
  // Ej: D 160 VN C 144 -> ["D 160 VN", "C 144"]
  const componentRegex = /[A-Z]+\s+\d+(?:\s+[A-Z]+(?!\s+\d+))?/g;
  
  const matches = normalized.match(componentRegex);
  
  // Si no hace match con el patrón o solo es un token, consideramos al propio string como 1 componente
  const components = matches && matches.length > 0 ? matches : [normalized];

  return {
    sku_normalized: normalized,
    components,
    tokens
  };
}
