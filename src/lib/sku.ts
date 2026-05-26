/**
 * Normaliza un SKU para permitir la comparación de publicaciones hermanas.
 * 
 * @param sku El SKU original desde la base de datos
 * @returns El SKU normalizado o string vacío si no es válido
 */
export function normalizeSku(sku: string | null | undefined): string {
  if (!sku) return "";
  
  const trimmed = sku.trim().toUpperCase();
  if (trimmed === "N/A" || trimmed === "NULL" || trimmed === "UNDEFINED") {
    return "";
  }
  
  // Reemplazar múltiples espacios o guiones con un solo espacio/guión si se desea,
  // pero para este caso base: remover espacios sobrantes
  return trimmed.replace(/\s+/g, ' ');
}
