import { normalizeSku as serviceNormalizeSku } from "@/services/products/sku/normalizeSku";

/**
 * Normaliza un SKU para permitir la comparación de publicaciones hermanas y componentes de inventario.
 * 
 * @param sku El SKU original desde la base de datos o Mercado Libre
 * @returns El SKU normalizado o string vacío si no es válido
 */
export function normalizeSku(sku: string | null | undefined): string {
  if (!sku) return "";
  
  const trimmed = sku.trim().toUpperCase();
  if (trimmed === "N/A" || trimmed === "NULL" || trimmed === "UNDEFINED") {
    return "";
  }
  
  return serviceNormalizeSku(sku);
}
