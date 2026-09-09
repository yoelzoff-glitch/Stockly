import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateReplenishment } from "@/services/inventory/replenishment/calculateReplenishment";
import { generateRuleBasedExplanation } from "@/services/inventory/replenishment/ai/explainReplenishment";
import type { ReplenishmentSnapshot } from "@/services/inventory/replenishment/types";

describe("Sprint 29: Intelligent Restock Engine (calculateReplenishment)", () => {
  // Test 49: Demanda estable (7d=7, 14d=14, 30d=30, FULL=5)
  it("Test 49: Demanda estable produce una recomendación coherente con ~1 u/día y target de 26 días (21+5)", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-1",
      sku: "SKU-STABLE",
      title: "Dije Ángel Plata 925",
      fullStock: 5,
      internalStock: 50,
      sales7d: 7,
      sales14d: 14,
      sales30d: 30,
      sales60d: 60,
    };

    const rec = calculateReplenishment(snapshot);

    assert.equal(rec.velocity7, 1);
    assert.equal(rec.velocity14, 1);
    assert.equal(rec.velocity30, 1);
    assert.equal(rec.weightedVelocity, 1);
    assert.equal(rec.forecastVelocity, 1);
    assert.equal(rec.targetCoverageDays, 21);
    assert.equal(rec.safetyDays, 5);
    // targetUnits = 1 * (21 + 5) = 26; recommendedUnits = ceil(26 - 5) = 21
    assert.equal(rec.recommendedUnits, 21);
    assert.equal(rec.availableToSend, 21); // internalStock is 50, so can send all 21
    assert.equal(rec.coverageDays, 5); // 5 / 1 = 5 days
    assert.equal(rec.priority, "critical"); // coverage <= 5 days
    assert.equal(rec.confidence, "high");
  });

  // Test 50: Aceleración (30d velocity = 1, 7d velocity = 2)
  it("Test 50: Aceleración aumenta la velocidad pronosticada pero respeta los límites (clamp)", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-2",
      sku: "SKU-ACCEL",
      title: "Anillo Oro 18k",
      fullStock: 7,
      internalStock: 100,
      sales7d: 14, // velocity 2
      sales14d: 21, // velocity 1.5
      sales30d: 30, // velocity 1
      sales60d: 60,
    };

    const rec = calculateReplenishment(snapshot);

    assert.ok(rec.forecastVelocity > 1, `Expected forecast velocity > 1, got ${rec.forecastVelocity}`);
    // Check clamp: product trend factor must not exceed MAX_TREND_FACTOR (1.35)
    assert.ok(rec.forecastVelocity <= rec.weightedVelocity * 1.35 * 1.15);
    assert.ok(rec.trendPercent !== null && rec.trendPercent > 0);
  });

  // Test 51: Desaceleración (30d = 60, 7d = 3)
  it("Test 51: Desaceleración ajusta el ritmo hacia abajo sin ignorar la caída reciente", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-3",
      sku: "SKU-DECEL",
      title: "Cadena Plata 50cm",
      fullStock: 15,
      internalStock: 40,
      sales7d: 3, // velocity = 0.428
      sales14d: 14, // velocity = 1.0
      sales30d: 60, // velocity = 2.0
      sales60d: 120,
    };

    const rec = calculateReplenishment(snapshot);

    assert.ok(rec.forecastVelocity < 2.0, `Expected forecast velocity < 2.0, got ${rec.forecastVelocity}`);
    assert.ok(rec.trendPercent !== null && rec.trendPercent < 0);
  });

  // Test 52: Sin ventas (sales30d = 0, FULL = 20)
  it("Test 52: Producto sin ventas en 30 días no recomienda reposición arbitraria", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-4",
      sku: "SKU-NO-SALES",
      title: "Pulsera Cuero Vintage",
      fullStock: 20,
      internalStock: 50,
      sales7d: 0,
      sales14d: 0,
      sales30d: 0,
      sales60d: 0,
    };

    const rec = calculateReplenishment(snapshot);

    assert.equal(rec.recommendedUnits, 0);
    assert.equal(rec.priority, "ok");
    assert.equal(rec.forecastVelocity, 0);
  });

  // Test 53: Stock suficiente (FULL > target stock)
  it("Test 53: Stock FULL suficiente produce recommendedUnits = 0", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-5",
      sku: "SKU-OVERSTOCKED",
      title: "Aros Perla Cultivada",
      fullStock: 50,
      internalStock: 20,
      sales7d: 7,
      sales14d: 14,
      sales30d: 30, // velocity ~ 1
      sales60d: 60,
    };

    const rec = calculateReplenishment(snapshot);

    // Target is ~26 units, stock is 50
    assert.equal(rec.recommendedUnits, 0);
    assert.equal(rec.priority, "ok");
    assert.ok(rec.coverageDays !== null && rec.coverageDays > 26);
  });

  // Test 54: Stock interno insuficiente (recommended = 30, internal = 12)
  it("Test 54: Stock interno insuficiente limita availableToSend sin alterar recommendedUnits", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-6",
      sku: "SKU-LOW-INTERNAL",
      title: "Colgante Cristal Swarovski",
      fullStock: 0,
      internalStock: 12,
      sales7d: 8,
      sales14d: 16,
      sales30d: 35, // velocity ~ 1.16
      sales60d: 70,
    };

    const rec = calculateReplenishment(snapshot);

    assert.ok(rec.recommendedUnits >= 30, `Expected recommendedUnits >= 30, got ${rec.recommendedUnits}`);
    assert.equal(rec.availableToSend, 12);
  });

  // Test 55: Cuenta creciendo (accountTrend > 0 aumenta moderadamente la velocidad)
  it("Test 55: Evolución de la cuenta incrementa el forecast de forma acotada", () => {
    const baseSnapshot: ReplenishmentSnapshot = {
      productId: "prod-7",
      sku: "SKU-ACCOUNT-BASE",
      title: "Reloj Acero Cronógrafo",
      fullStock: 10,
      internalStock: 50,
      sales7d: 7,
      sales14d: 14,
      sales30d: 30,
      sales60d: 60,
      accountOrdersLast7d: 100,
      accountOrdersPrev7d: 100, // 0% growth
    };

    const growingSnapshot: ReplenishmentSnapshot = {
      ...baseSnapshot,
      accountOrdersLast7d: 125,
      accountOrdersPrev7d: 100, // +25% growth
    };

    const baseRec = calculateReplenishment(baseSnapshot);
    const growingRec = calculateReplenishment(growingSnapshot);

    assert.ok(growingRec.forecastVelocity > baseRec.forecastVelocity);
    assert.ok(growingRec.accountTrendPercent !== null && growingRec.accountTrendPercent > 0);
  });

  // Test 56: Outlier acotado
  it("Test 56: Venta excepcional aislada en 7d queda acotada por el factor de tendencia", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-8",
      sku: "SKU-OUTLIER",
      title: "Set Regalo Premium",
      fullStock: 5,
      internalStock: 50,
      sales7d: 50, // huge spike
      sales14d: 52,
      sales30d: 60, // normally 2/day
      sales60d: 120,
    };

    const rec = calculateReplenishment(snapshot);

    // velocity30 = 2, velocity7 = 7.14
    // trend factor is clamped to max 1.35
    assert.ok(rec.forecastVelocity < 10, `Forecast velocity should be bounded, got ${rec.forecastVelocity}`);
  });

  // Test 57: Agrupación física / publicaciones espejadas
  it("Test 57: Snapshot consolidado por SKU físico no duplica stock ni demanda", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-9",
      sku: "SKU-MIRRORED-SHARED",
      title: "Dije Sol y Luna Clásica + Premium",
      fullStock: 14, // combined physical stock in fulfillment
      internalStock: 30,
      sales7d: 14,
      sales14d: 28,
      sales30d: 60,
      sales60d: 120,
      publicationsCount: 2,
      meliItemIds: ["MLA1001", "MLA1002"],
    };

    const rec = calculateReplenishment(snapshot);

    assert.equal(rec.fullStock, 14);
    // 2 u/day * 26 = 52. 52 - 14 = 38
    assert.equal(rec.recommendedUnits, 38);
  });

  // Test 58: Fallback sin OpenAI
  it("Test 58: Generador de explicaciones determinístico (fallback) funciona sin OpenAI", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-10",
      sku: "SKU-FALLBACK",
      title: "Cadena Eslabón Fino",
      fullStock: 3,
      internalStock: 25,
      sales7d: 10,
      sales14d: 18,
      sales30d: 32,
      sales60d: 64,
    };

    const rec = calculateReplenishment(snapshot);
    const explanation = generateRuleBasedExplanation(rec);

    assert.ok(explanation.recommendationExplanation.length > 0);
    assert.ok(explanation.recommendationExplanation.includes("30") || explanation.recommendationExplanation.includes("unidades"));
    assert.ok(explanation.priorityExplanation.length > 0);
  });

  // Test 59: IA no puede alterar el número calculado
  it("Test 59: recommendedUnits es una propiedad determinística inalterable por la explicación", () => {
    const snapshot: ReplenishmentSnapshot = {
      productId: "prod-11",
      sku: "SKU-INTEGRITY",
      title: "Anillo Plata Simple",
      fullStock: 4,
      internalStock: 40,
      sales7d: 7,
      sales14d: 14,
      sales30d: 30,
      sales60d: 60,
    };

    const rec = calculateReplenishment(snapshot);
    const initialUnits = rec.recommendedUnits;

    // Simulation of OpenAI returning a different text: the number in rec must not change
    const explanation = generateRuleBasedExplanation(rec);
    rec.aiExplanation = explanation;

    assert.equal(rec.recommendedUnits, initialUnits);
  });
});
