// src/services/products/sku/parseCompositeSku.ts
import { normalizeSku } from "./normalizeSku";

export interface ParsedCompositeSku {
  sku_normalized: string;
  components: string[];
  tokens: string[];
}

const KNOWN_PREFIXES = ['AR', 'BANQUETA', 'C', 'D', 'IMP', 'P', 'R', 'SKUD', 'TO'];

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
  
  const components: string[] = [];
  let remaining = normalized;

  while (remaining.length > 0) {
    const match = remaining.match(/^([A-Z]+)(\d+)/);
    if (!match) {
      components.push(remaining);
      break;
    }

    const prefix = match[1];
    const numbers = match[2];
    remaining = remaining.substring(match[0].length);

    const nextNumbersMatch = remaining.match(/^([A-Z]*)(\d+)/);
    if (nextNumbersMatch) {
      const lettersBetween = nextNumbersMatch[1];
      
      let nextPrefix = "";
      for (const p of KNOWN_PREFIXES) {
        if (lettersBetween.endsWith(p)) {
          if (p.length > nextPrefix.length) {
            nextPrefix = p;
          }
        }
      }

      if (nextPrefix) {
        const suffix = lettersBetween.substring(0, lettersBetween.length - nextPrefix.length);
        components.push(prefix + numbers + suffix);
        remaining = nextPrefix + remaining.substring(lettersBetween.length);
      } else {
        components.push(prefix + numbers + lettersBetween);
        remaining = remaining.substring(lettersBetween.length);
      }
    } else {
      components.push(prefix + numbers + remaining);
      break;
    }
  }

  return {
    sku_normalized: normalized,
    components,
    tokens
  };
}
