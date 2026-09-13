import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveDateRange,
  resolveMonthToDateComparison,
  formatPeriodLabel,
} from "../../src/services/ai/dateRanges";

describe("Copilot Date Ranges & Timezone Tests", () => {
  const argentinaTz = "America/Argentina/Buenos_Aires";

  test("resolveDateRange handles 'hoy' accurately in Argentina timezone", () => {
    const range = resolveDateRange("hoy", argentinaTz);
    assert.ok(range.from instanceof Date);
    assert.ok(range.to instanceof Date);
    assert.ok(range.from.getTime() <= range.to.getTime());
    assert.equal(range.label, "Hoy");
  });

  test("resolveDateRange handles 'ayer' ending exactly 1ms before 'hoy' begins", () => {
    const hoy = resolveDateRange("hoy", argentinaTz);
    const ayer = resolveDateRange("ayer", argentinaTz);
    assert.equal(ayer.label, "Ayer");
    assert.equal(ayer.to.getTime() + 1, hoy.from.getTime());
    // Exactly 24 hours between start and end (+ 1ms)
    assert.equal(ayer.to.getTime() - ayer.from.getTime() + 1, 24 * 60 * 60 * 1000);
  });

  test("resolveDateRange handles 'esta_semana' and 'este_mes'", () => {
    const semana = resolveDateRange("esta_semana", argentinaTz);
    const mes = resolveDateRange("este_mes", argentinaTz);
    assert.ok(semana.from.getTime() <= semana.to.getTime());
    assert.ok(mes.from.getTime() <= mes.to.getTime());
    assert.equal(semana.label, "Esta semana");
    assert.equal(mes.label, "Este mes");
  });

  test("resolveMonthToDateComparison compares equivalent days of month (1-to-D)", () => {
    // Simulated anchor: 12th of September 2026 at 15:00 Buenos Aires time
    const anchorDate = new Date("2026-09-12T18:00:00.000Z"); // 15:00 UTC-3
    const comparison = resolveMonthToDateComparison(argentinaTz, anchorDate);

    assert.ok(comparison.current.from instanceof Date);
    assert.ok(comparison.current.to instanceof Date);
    assert.ok(comparison.previous.from instanceof Date);
    assert.ok(comparison.previous.to instanceof Date);

    // Duration of current and previous periods must be identical (apples to apples)
    const currentDuration = comparison.current.to.getTime() - comparison.current.from.getTime();
    const previousDuration = comparison.previous.to.getTime() - comparison.previous.from.getTime();
    
    // Within 1 hour difference
    const diffHours = Math.abs(currentDuration - previousDuration) / (1000 * 60 * 60);
    assert.ok(diffHours <= 1, `Duration difference should be <= 1h, got ${diffHours}`);
    assert.ok(comparison.current.label.includes("mes actual"));
    assert.ok(comparison.previous.label.includes("mes anterior"));
  });

  test("resolveDateRange handles explicit date anchor", () => {
    const anchor = new Date("2026-08-15T15:00:00.000Z");
    const custom = resolveDateRange("hoy", argentinaTz, anchor);
    assert.ok(custom.from instanceof Date);
    assert.ok(custom.to instanceof Date);
    assert.equal(custom.label, "Hoy");
  });

  test("formatPeriodLabel formats date intervals correctly", () => {
    const d1 = new Date("2026-09-01T03:00:00.000Z");
    const d2 = new Date("2026-09-12T23:59:59.999Z");
    const label = formatPeriodLabel(d1, d2, argentinaTz);
    assert.ok(typeof label === "string" && label.length > 0);
  });
});
