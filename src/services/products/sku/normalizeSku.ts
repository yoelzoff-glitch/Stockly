// src/services/products/sku/normalizeSku.ts

/**
 * Normaliza un SKU para facilitar su procesamiento y comparación.
 * - Convierte a mayúsculas
 * - Elimina espacios extras
 * - Convierte guiones y caracteres de separación en espacios
 * 
 * @param sku El SKU original a normalizar
 * @returns El SKU normalizado
 */
export function normalizeSku(sku: string): string {
  if (!sku) return "";

  return sku
    .toUpperCase()
    // Reemplaza guiones, guiones bajos o barras con espacio
    .replace(/[-_/]/g, " ")
    // Elimina caracteres especiales que no sean letras, números o espacios
    .replace(/[^A-Z0-9\s]/g, "")
    // Reemplaza múltiples espacios por uno solo
    .replace(/\s+/g, " ")
    .trim();
}
