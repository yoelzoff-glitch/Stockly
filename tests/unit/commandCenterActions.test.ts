import { test, describe } from "node:test";
import assert from "node:assert/strict";

interface CommandCenterResult {
  success: boolean;
  error?: string;
  results?: any[];
  partial?: boolean;
  message?: string;
}

describe("Command Center Action Result Formatter Tests", () => {
  function formatResults(res: { success: boolean; error?: string; results?: any[] }): CommandCenterResult {
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
        };
      } else if (failed.length > 0 && succeeded.length === 0) {
        return { success: false, error: failed[0].error || "Error al modificar las publicaciones" };
      } else if (succeeded.length > 0 && failed.length === 0) {
        return {
          success: true,
          message: `${succeeded.length} ${succeeded.length === 1 ? "publicación modificada" : "publicaciones modificadas"} exitosamente.`,
        };
      }
    }
    return res;
  }

  test("handles total success when all items succeed", () => {
    const res = {
      success: true,
      results: [
        { success: true, itemId: "MLA1" },
        { success: true, itemId: "MLA2" },
      ],
    };

    const formatted = formatResults(res);
    assert.equal(formatted.success, true);
    assert.equal(formatted.message, "2 publicaciones modificadas exitosamente.");
  });

  test("handles total failure when all items fail", () => {
    const res = {
      success: true,
      results: [
        { success: false, itemId: "MLA1", error: "Item is paused" },
        { success: false, itemId: "MLA2", error: "Item is paused" },
      ],
    };

    const formatted = formatResults(res);
    assert.equal(formatted.success, false);
    assert.equal(formatted.error, "Item is paused");
  });

  test("handles partial success with catalog rejection explanation", () => {
    const res = {
      success: true,
      results: [
        { success: true, itemId: "MLA1" },
        { success: false, itemId: "MLA2", error: "Publicación de catálogo no permite edición de título" },
      ],
    };

    const formatted = formatResults(res);
    assert.equal(formatted.success, true);
    assert.equal(formatted.partial, true);
    assert.ok(formatted.message?.includes("1 publicación modificada exitosamente"));
    assert.ok(formatted.message?.includes("1 falló"));
    assert.ok(formatted.message?.includes("era de catálogo y no permite cambios"));
  });
});
