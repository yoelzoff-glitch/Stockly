import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatCommandCenterActionResult } from "../../src/lib/ai/commandCenterResults";

describe("Command Center Action Result Formatter Tests", () => {
  test("handles total success when all items succeed", () => {
    const res = {
      success: true,
      results: [
        { success: true, itemId: "MLA1" },
        { success: true, itemId: "MLA2" },
      ],
    };

    const formatted = formatCommandCenterActionResult(res);
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

    const formatted = formatCommandCenterActionResult(res);
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

    const formatted = formatCommandCenterActionResult(res);
    assert.equal(formatted.success, true);
    assert.equal(formatted.partial, true);
    assert.ok(formatted.message?.includes("1 publicación modificada exitosamente"));
    assert.ok(formatted.message?.includes("1 falló"));
    assert.ok(formatted.message?.includes("era de catálogo y no permite cambios"));
  });

  test("returns original object if no results array is present", () => {
    const res = { success: false, error: "Generic action failure" };
    const formatted = formatCommandCenterActionResult(res);
    assert.equal(formatted.success, false);
    assert.equal(formatted.error, "Generic action failure");
  });
});
