/**
 * Pure formatter for Command Center AI action execution results.
 * Handles total success, total failure, and partial success states with catalog rejection context.
 */

export interface CommandCenterActionResult {
  success: boolean;
  error?: string;
  results?: any[];
  partial?: boolean;
  message?: string;
}

export function formatCommandCenterActionResult(
  res: { success: boolean; error?: string; results?: any[] }
): CommandCenterActionResult {
  if (res.success && res.results && res.results.length > 0) {
    const failed = res.results.filter((r: any) => !r.success);
    const succeeded = res.results.filter((r: any) => r.success);

    if (succeeded.length > 0 && failed.length > 0) {
      const catalogFailedCount = failed.filter((f: any) =>
        f.error?.toLowerCase().includes("catálogo") ||
        f.error?.toLowerCase().includes("catalogo") ||
        f.error?.toLowerCase().includes("catalog") ||
        f.error?.toLowerCase().includes("cannot update item")
      ).length;

      let reason = "";
      if (catalogFailedCount > 0) {
        reason = ` (${catalogFailedCount} ${catalogFailedCount === 1 ? "era de catálogo y no permite cambios" : "eran de catálogo y no permiten cambios"})`;
      }

      return {
        success: true,
        partial: true,
        message: `${succeeded.length} ${succeeded.length === 1 ? "publicación modificada" : "publicaciones modificadas"} exitosamente y ${failed.length} ${failed.length === 1 ? "falló" : "fallaron"}${reason}.`,
        results: res.results,
      };
    } else if (failed.length > 0 && succeeded.length === 0) {
      return {
        success: false,
        error: failed[0].error || "Error al modificar las publicaciones",
        results: res.results,
      };
    } else if (succeeded.length > 0 && failed.length === 0) {
      return {
        success: true,
        message: `${succeeded.length} ${succeeded.length === 1 ? "publicación modificada" : "publicaciones modificadas"} exitosamente.`,
        results: res.results,
      };
    }
  }

  return res;
}
