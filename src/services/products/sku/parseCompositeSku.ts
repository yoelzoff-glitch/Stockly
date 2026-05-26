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

  // Tokens crudos separados por espacios para uso general
  const tokens = sku.trim().split(/\s+/);
  
  // Regex para encontrar componentes cuando NO hay espacios:
  // Letras + Numeros + (Opcionalmente Letras)
  // Ej: C145D260 -> ["C145", "D260"]
  // BANQUETA100 -> ["BANQUETA100"]
  const componentRegex = /[A-Z]+\d+[A-Z]*/g;
  
  const matches = normalized.match(componentRegex);
  
  // Si no hace match con el patrón o solo es un token, consideramos al propio string como 1 componente
  const components = matches && matches.length > 0 ? matches : [normalized];

  return {
    sku_normalized: normalized,
    components,
    tokens
  };
}
