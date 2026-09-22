import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateBalance } from "../../src/services/balance/calculateBalance";

describe("Balance Calculation Module — Pure Logic Unit Tests", () => {
  test("Caso base: Ganancia $300.000, CMV $500.000, Compras $700.000 -> Generado $800.000, Balance $100.000", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 300000,
      cmv: 500000,
      purchases: [
        {
          id: "po-1",
          created_at: "2026-09-10T10:00:00Z",
          purchase_date: "2026-09-10T10:00:00Z",
          total_amount: 700000,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 10,
              unit_cost: 70000,
              total_cost: 700000
            }
          ]
        }
      ]
    });

    assert.equal(result.cmv, 500000);
    assert.equal(result.gananciaDespuesDeGastos, 300000);
    assert.equal(result.generadoAntesDeReinvertir, 800000);
    assert.equal(result.comprasMercaderia, 700000);
    assert.equal(result.balanceDespuesDeCompras, 100000);
    assert.equal(result.proporcionDestinadaACompras, 87.5);
    assert.equal(result.comprasVsCMV, 200000); // 700.000 - 500.000
    assert.equal(result.hasIncompleteCosts, false);
    assert.equal(result.validPurchasesCount, 1);
    assert.equal(result.integrityStatus, "full");
    assert.equal(result.integrityLabel, "Conciliación Completa");
  });

  test("Reinversión superior a lo generado: Generado $800.000, Compras $950.000 -> Balance -$150.000", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 300000,
      cmv: 500000,
      purchases: [
        {
          id: "po-big",
          created_at: "2026-09-12T10:00:00Z",
          total_amount: 950000,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 95,
              unit_cost: 10000,
              total_cost: 950000
            }
          ]
        }
      ]
    });

    assert.equal(result.generadoAntesDeReinvertir, 800000);
    assert.equal(result.comprasMercaderia, 950000);
    assert.equal(result.balanceDespuesDeCompras, -150000);
    assert.equal(result.proporcionDestinadaACompras, 118.8);
    assert.equal(result.comprasVsCMV, 450000);
  });

  test("Reposición equivalente al CMV: Compras igualan al CMV ($500.000) -> Balance igual a ganancia después de gastos", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 300000,
      cmv: 500000,
      purchases: [
        {
          id: "po-cmv-match",
          created_at: "2026-09-15T10:00:00Z",
          total_amount: 500000,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 50,
              unit_cost: 10000,
              total_cost: 500000
            }
          ]
        }
      ]
    });

    assert.equal(result.comprasMercaderia, 500000);
    assert.equal(result.balanceDespuesDeCompras, 300000);
    assert.equal(result.balanceDespuesDeCompras, result.gananciaDespuesDeGastos);
    assert.equal(result.comprasVsCMV, 0);
  });

  test("Flete sincronizado y verificado: no hay doble descuento y estado es 'full'", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 280000,
      cmv: 500000,
      appliedFreightTotal: 20000,
      isProratedTimeframe: false,
      purchases: [
        {
          id: "po-with-freight",
          created_at: "2026-09-18T10:00:00Z",
          total_amount: 720000,
          extra_costs: 20000,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 7,
              unit_cost: 100000,
              total_cost: 700000
            }
          ]
        }
      ]
    });

    assert.equal(result.generadoAntesDeReinvertir, 780000);
    assert.equal(result.comprasMercaderia, 700000);
    assert.equal(result.totalExtraCosts, 20000);
    assert.equal(result.balanceDespuesDeCompras, 80000);
    assert.equal(result.freightAudit.status, "reconciled");
    assert.equal(result.integrityStatus, "full");
    assert.equal(result.integrityLabel, "Conciliación Completa");
  });

  test("Flete no sincronizado en Finanzas: no muestra Conciliación Completa y marca estimado", () => {
    // Compra registra flete de $25.000 pero en Finanzas no existe gasto de flete ($0)
    const result = calculateBalance({
      gananciaDespuesDeGastos: 300000,
      cmv: 500000,
      appliedFreightTotal: 0,
      isProratedTimeframe: false,
      purchases: [
        {
          id: "po-unsynced-freight",
          created_at: "2026-09-18T10:00:00Z",
          total_amount: 525000,
          extra_costs: 25000,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 5,
              unit_cost: 100000,
              total_cost: 500000
            }
          ]
        }
      ]
    });

    assert.notEqual(result.integrityStatus, "full");
    assert.equal(result.integrityStatus, "freight_unverified");
    assert.equal(result.integrityLabel, "Pendiente de Conciliación (Flete no verificado)");
    assert.equal(result.isProporcionEstimated, true);
    assert.equal(result.isComprasVsCMVEstimated, true);
  });

  test("Flete prorrateado en rango personalizado: marca 'freight_prorated' y resultado estimado", () => {
    // Período de 10 días donde Finanzas prorrateó el flete mensual a $6.667
    const result = calculateBalance({
      gananciaDespuesDeGastos: 150000,
      cmv: 200000,
      appliedFreightTotal: 6667,
      isProratedTimeframe: true,
      purchases: [
        {
          id: "po-prorated",
          created_at: "2026-09-05T10:00:00Z",
          total_amount: 220000,
          extra_costs: 20000,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 2,
              unit_cost: 100000,
              total_cost: 200000
            }
          ]
        }
      ]
    });

    assert.equal(result.integrityStatus, "freight_prorated");
    assert.equal(result.integrityLabel, "Resultado Estimado (Prorrateo temporal)");
    assert.equal(result.isProporcionEstimated, true);
  });

  test("Discrepancia entre flete de compras y Finanzas: marca 'freight_discrepancy'", () => {
    // Compras registra flete de $30.000 pero Finanzas tiene $15.000
    const result = calculateBalance({
      gananciaDespuesDeGastos: 300000,
      cmv: 500000,
      appliedFreightTotal: 15000,
      isProratedTimeframe: false,
      purchases: [
        {
          id: "po-diff-freight",
          created_at: "2026-09-10T10:00:00Z",
          total_amount: 530000,
          extra_costs: 30000,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 5,
              unit_cost: 100000,
              total_cost: 500000
            }
          ]
        }
      ]
    });

    assert.equal(result.integrityStatus, "freight_discrepancy");
    assert.equal(result.integrityLabel, "Pendiente de Conciliación (Discrepancia de fletes)");
  });

  test("Exclusión de compras anuladas (voided) del balance", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 200000,
      cmv: 100000,
      purchases: [
        {
          id: "po-valid",
          created_at: "2026-09-01T10:00:00Z",
          total_amount: 150000,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 1,
              unit_cost: 150000,
              total_cost: 150000
            }
          ]
        },
        {
          id: "po-voided",
          created_at: "2026-09-05T10:00:00Z",
          total_amount: 500000,
          extra_costs: 15000,
          status: "voided",
          purchase_order_items: [
            {
              id: "item-2",
              quantity: 5,
              unit_cost: 100000,
              total_cost: 500000
            }
          ]
        }
      ]
    });

    assert.equal(result.validPurchasesCount, 1);
    assert.equal(result.voidedPurchasesCount, 1);
    assert.equal(result.comprasMercaderia, 150000);
    assert.equal(result.balanceDespuesDeCompras, 150000); // 300.000 - 150.000
    assert.equal(result.processedPurchases.find(p => p.id === "po-voided")?.isVoided, true);
  });

  test("Costos desconocidos vs costo cero válido: marca cálculo parcial correctamente", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 100000,
      cmv: 50000,
      purchases: [
        {
          id: "po-free-sample",
          created_at: "2026-09-01T10:00:00Z",
          total_amount: 0,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-free",
              quantity: 10,
              unit_cost: 0,
              total_cost: 0
            }
          ]
        },
        {
          id: "po-unknown-cost",
          created_at: "2026-09-02T10:00:00Z",
          total_amount: null,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-unknown",
              quantity: 5,
              unit_cost: null,
              total_cost: null
            }
          ]
        }
      ]
    });

    assert.equal(result.hasIncompleteCosts, true);
    assert.equal(result.incompletePurchasesCount, 1);
    assert.equal(result.integrityStatus, "partial_costs");
    assert.equal(result.isProporcionEstimated, true);
    assert.equal(result.processedPurchases.find(p => p.id === "po-free-sample")?.hasIncompleteCost, false);
    assert.equal(result.processedPurchases.find(p => p.id === "po-unknown-cost")?.hasIncompleteCost, true);
  });

  test("Detección de discrepancia entre cabecera e ítems", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: 100000,
      cmv: 50000,
      appliedFreightTotal: 10000,
      isProratedTimeframe: false,
      purchases: [
        {
          id: "po-discrepancy",
          created_at: "2026-09-01T10:00:00Z",
          total_amount: 100000,
          extra_costs: 10000, // Header merchandise = 90.000
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 1,
              unit_cost: 85000,
              total_cost: 85000 // Items sum = 85.000 != 90.000
            }
          ]
        }
      ]
    });

    assert.equal(result.discrepancies.length, 1);
    assert.equal(result.discrepancies[0].orderId, "po-discrepancy");
    assert.equal(result.discrepancies[0].diff, 5000);
    assert.equal(result.integrityStatus, "items_discrepancy");
    assert.notEqual(result.integrityLabel, "Conciliación Completa");
  });

  test("Valores cero y resultado negativo: Proporción devuelve null ('No aplica')", () => {
    const result = calculateBalance({
      gananciaDespuesDeGastos: -200000,
      cmv: 50000,
      purchases: [
        {
          id: "po-1",
          created_at: "2026-09-01T10:00:00Z",
          total_amount: 100000,
          extra_costs: 0,
          status: "completed",
          purchase_order_items: [
            {
              id: "item-1",
              quantity: 1,
              unit_cost: 100000,
              total_cost: 100000
            }
          ]
        }
      ]
    });

    assert.equal(result.generadoAntesDeReinvertir, -150000);
    assert.equal(result.comprasMercaderia, 100000);
    assert.equal(result.balanceDespuesDeCompras, -250000);
    assert.equal(result.proporcionDestinadaACompras, null, "Debe ser null para que la UI muestre 'No aplica'");
  });
});
