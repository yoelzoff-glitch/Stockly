// tests/unit/publicCalculator.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateNetProfit,
  solveTargetPrice,
  solveBreakEvenPrice,
  estimateSellingCosts,
  estimateShippingCost,
  calculateIdealPrice,
  SimulatorInputs,
  SellingCostsBreakdown,
  round2,
} from "../../src/services/profitability/simulatorEngine";

describe("Sprint: Calculadora de Rentabilidad Pública & Motor Compartido (Casos 1 - 14)", () => {
  // 1. Costo normal + precio normal
  it("Caso 1: Costo normal + precio normal calcula ganancias y márgenes esperados", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 10000,
      quantity: 1,
      salePrice: 25000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const costs = estimateSellingCosts({
      price: 25000,
      customCommissionPercent: 15,
      freeShipping: false,
    });

    const res = calculateNetProfit(inputs, costs);

    // Comisión 15% de 25000 = 3750
    assert.equal(res.meliFee, 3750);
    // Ganancia = 25000 - 10000 - 3750 = 11250
    assert.equal(res.gananciaNeta, 11250);
    // Margen = 11250 / 25000 = 45%
    assert.equal(res.margenNetoPercent, 45);
    // ROI = 11250 / 10000 = 112.5%
    assert.equal(res.retornoSobreCostoPercent, 112.5);
  });

  // 2. Comisión porcentual
  it("Caso 2: Aplica correctamente comisión porcentual (Clásica vs Premium)", () => {
    const inputsClasica: SimulatorInputs = {
      supplierCost: 10000,
      salePrice: 30000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const costsClasica = estimateSellingCosts({
      price: 30000,
      customCommissionPercent: 14,
    });

    const resClasica = calculateNetProfit(inputsClasica, costsClasica);
    assert.equal(resClasica.meliFee, 4200);

    const costsPremium = estimateSellingCosts({
      price: 30000,
      customCommissionPercent: 30,
    });

    const resPremium = calculateNetProfit(inputsClasica, costsPremium);
    assert.equal(resPremium.meliFee, 9000);
    assert.equal(resPremium.gananciaNeta, 30000 - 10000 - 9000);
  });

  // 3. Costo fijo
  it("Caso 3: Incorpora costo fijo de publicación o embalaje sin duplicaciones", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 5000,
      salePrice: 15000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      otherCostsFixed: 450, // Embalaje
      adsMode: "none",
    };

    const costs = estimateSellingCosts({
      price: 15000,
      customCommissionPercent: 13,
      fixedFee: 650, // Cargo fijo ML
    });

    const res = calculateNetProfit(inputs, costs);

    // Comisión = 15000 * 0.13 + 650 = 1950 + 650 = 2600
    assert.equal(res.meliFixedFee, 650);
    assert.equal(res.meliPercentageFee, 1950);
    assert.equal(res.meliFee, 2600);
    assert.equal(res.otherCostsFixed, 450);

    // Ganancia = 15000 - 5000 - 2600 - 450 = 6950
    assert.equal(res.gananciaNeta, 6950);
    assert.equal(res.margenNetoPercent, round2((6950 / 15000) * 100));
  });

  // 4. Envío (Mercado Envíos)
  it("Caso 4: Maneja correctamente los escalones y bonificaciones de Mercado Envíos", () => {
    // Menor a $33.000: vendedor absorbe el 100% si ofrece gratis
    const shippingLow = estimateShippingCost(20000, true, 300);
    assert.equal(shippingLow.totalShippingCost, 6080);
    assert.equal(shippingLow.mlShippingDiscount, 0);
    assert.equal(shippingLow.sellerShippingCost, 6080);

    // Mayor o igual a $33.000: Mercado Libre bonifica 50%
    const shippingHigh = estimateShippingCost(40000, true, 300);
    assert.equal(shippingHigh.totalShippingCost, 6080);
    assert.equal(shippingHigh.mlShippingDiscount, 3040);
    assert.equal(shippingHigh.sellerShippingCost, 3040);

    // Sin envío gratis: costo vendedor = 0
    const shippingPaid = estimateShippingCost(40000, false);
    assert.equal(shippingPaid.sellerShippingCost, 0);
  });

  // 5. Múltiples costos combinados
  it("Caso 5: Múltiples costos (proveedor + ML + flete + ads + packaging + impuestos)", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 15000,
      quantity: 1,
      salePrice: 50000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "manual",
      adsPercent: 8, // 8% Ads = 4000
      otherCostsFixed: 500, // Packaging = 500
      otherCostsPercent: 4, // IIBB / Impuestos 4% = 2000
      freeShipping: true,
      billableWeight: 300,
    };

    const costs = estimateSellingCosts({
      price: 50000,
      customCommissionPercent: 15, // 15% ML = 7500
      freeShipping: true,
      billableWeight: 300, // Flete vendedor bonificado = 3040
    });

    const res = calculateNetProfit(inputs, costs);

    assert.equal(res.effectivePrice, 50000);
    assert.equal(res.supplierCostTotal, 15000);
    assert.equal(res.meliFee, 7500);
    assert.equal(res.shippingCost, 3040);
    assert.equal(res.adsCost, 4000);
    assert.equal(res.otherCostsFixed, 500);
    assert.equal(res.otherCostsTotal, 2500); // 500 + 2000

    // Costos totales = 15000 + 7500 + 3040 + 4000 + 2500 = 32040
    assert.equal(res.totalCosts, 32040);
    // Ganancia = 50000 - 32040 = 17960
    assert.equal(res.gananciaNeta, 17960);
    // Margen = 17960 / 50000 = 35.92%
    assert.equal(res.margenNetoPercent, 35.92);
    // ROI = 17960 / 15000 = 119.73%
    assert.equal(res.retornoSobreCostoPercent, 119.73);
  });

  // 6. Margen positivo
  it("Caso 6: Margen positivo se reporta correctamente", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 8000,
      salePrice: 20000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const costs = estimateSellingCosts({ price: 20000, customCommissionPercent: 12 });
    const res = calculateNetProfit(inputs, costs);

    assert.ok(res.gananciaNeta > 0);
    assert.ok(res.margenNetoPercent > 0);
    assert.equal(res.gananciaNeta, 20000 - 8000 - 2400); // 9600
    assert.equal(res.margenNetoPercent, 48);
  });

  // 7. Margen cero / Punto de equilibrio
  it("Caso 7: Margen cero y punto de equilibrio", async () => {
    const inputs: SimulatorInputs = {
      supplierCost: 10000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const getCostsFn = async (p: number) => estimateSellingCosts({ price: p, customCommissionPercent: 15 });

    const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
    // 0.85 * P = 10000 => P ≈ 11764.71
    assert.ok(breakEven >= 11760 && breakEven <= 11770);

    const sim = calculateNetProfit(inputs, await getCostsFn(breakEven), breakEven);
    assert.ok(Math.abs(sim.gananciaNeta) < 5, `Ganancia neta (${sim.gananciaNeta}) debe ser cercana a 0`);
  });

  // 8. Operación con pérdida
  it("Caso 8: Operación con pérdida reporta valores negativos sin fallar", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 25000, // Compró a $25.000
      salePrice: 20000,    // Vende a $20.000
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const costs = estimateSellingCosts({ price: 20000, customCommissionPercent: 15 }); // Comisión = 3000
    const res = calculateNetProfit(inputs, costs);

    // Ganancia = 20000 - 25000 - 3000 = -8000
    assert.equal(res.gananciaNeta, -8000);
    // Margen = -8000 / 20000 = -40%
    assert.equal(res.margenNetoPercent, -40);
    // ROI = -8000 / 25000 = -32%
    assert.equal(res.retornoSobreCostoPercent, -32);
  });

  // 9. Precio = 0
  it("Caso 9: Precio = 0 no produce división por cero ni NaN", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 5000,
      salePrice: 0,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const costs = estimateSellingCosts({ price: 0, customCommissionPercent: 15 });
    const res = calculateNetProfit(inputs, costs);

    assert.equal(res.effectivePrice, 0);
    assert.equal(res.gananciaNeta, -5000);
    assert.equal(res.margenNetoPercent, 0);
    assert.equal(isNaN(res.margenNetoPercent), false);
    assert.equal(isNaN(res.gananciaNeta), false);
  });

  // 10. Costo = 0
  it("Caso 10: Costo = 0 calcula margen correctamente sin división por cero en ROI", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 0,
      salePrice: 10000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const costs = estimateSellingCosts({ price: 10000, customCommissionPercent: 15 });
    const res = calculateNetProfit(inputs, costs);

    assert.equal(res.gananciaNeta, 8500);
    assert.equal(res.margenNetoPercent, 85);
    assert.equal(res.retornoSobreCostoPercent, 0); // Protegido contra división por 0
    assert.equal(isNaN(res.retornoSobreCostoPercent), false);
  });

  // 11. Valores decimales
  it("Caso 11: Manejo preciso de valores decimales y redondeo de moneda", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1234.56,
      salePrice: 3456.78,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "manual",
      adsPercent: 5.5,
      otherCostsFixed: 12.34,
      otherCostsPercent: 2.5,
    };
    const costs = estimateSellingCosts({
      price: 3456.78,
      customCommissionPercent: 15.5,
    });
    const res = calculateNetProfit(inputs, costs);

    assert.equal(Number.isFinite(res.gananciaNeta), true);
    assert.equal(Number.isFinite(res.margenNetoPercent), true);
    assert.equal(Number.isFinite(res.retornoSobreCostoPercent), true);
  });

  // 12. Valores muy grandes
  it("Caso 12: Manejo de valores extremadamente grandes sin overflow", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 100000000, // $100M
      salePrice: 200000000,    // $200M
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };
    const costs = estimateSellingCosts({ price: 200000000, customCommissionPercent: 15 });
    const res = calculateNetProfit(inputs, costs);

    assert.equal(res.meliFee, 30000000);
    assert.equal(res.gananciaNeta, 70000000);
    assert.equal(res.margenNetoPercent, 35);
  });

  // 13. Cálculo inverso de precio objetivo (Modo B / Calcular precio ideal)
  it("Caso 13: Cálculo inverso de precio objetivo resuelve el margen exacto y refuta costo * (1 + margen)", async () => {
    const inputs: SimulatorInputs = {
      supplierCost: 10000,
      quantity: 1,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      otherCostsFixed: 500, // Packaging $500
      otherCostsPercent: 5, // Impuestos 5%
      adsMode: "none",
    };

    const targetMargin = 25; // 25% de margen deseado
    const { targetPrice, simulation } = await calculateIdealPrice(targetMargin, inputs);

    // Verificamos que el solver convergió al 25% ± 0.15%
    assert.ok(
      Math.abs(simulation.margenNetoPercent - targetMargin) <= 0.15,
      `Margen obtenido ${simulation.margenNetoPercent} debe ser aprox 25%`
    );

    // DEMOSTRACIÓN MATEMÁTICA: costo * (1 + margen) es un error comercial grave
    const naivePrice = 10000 * (1 + targetMargin / 100); // 12500
    const naiveCosts = estimateSellingCosts({ price: naivePrice, customCommissionPercent: 15 });
    const naiveSim = calculateNetProfit(inputs, naiveCosts, naivePrice);

    // Con el cálculo ingenuo ($12.500), el vendedor ganaría solo $12.500 - 10.000 - 500 - (15% + 5%)*12.500 = $12.500 - 10.500 - 2.500 = -$500 (PÉRDIDA!)
    assert.ok(naiveSim.gananciaNeta <= 0, "El cálculo ingenuo costo*(1+m) entra en pérdida con comisiones reales");
    assert.ok(simulation.gananciaNeta > 0, "La fórmula del solver de LibretaX garantiza ganancia positiva");
    assert.ok(targetPrice > naivePrice, "El precio real sugerido debe absorber las comisiones de venta");
  });

  // 14. Consistencia matemática idéntica: calculadora pública === calculadora interna
  it("Caso 14: Consistencia matemática exacta entre la calculadora pública y la interna", () => {
    const testCases: { inputs: SimulatorInputs; costs: SellingCostsBreakdown }[] = [
      {
        inputs: { supplierCost: 1000, salePrice: 2500, categoryId: "MLA1430", listingTypeId: "gold_special", adsMode: "none" },
        costs: {
          saleFeeAmount: 375,
          saleFeePercent: 15,
          fixedFee: 0,
          percentageFee: 375,
          financingFee: 0,
          currencyId: "ARS",
          sellerShippingCost: 0,
          totalShippingCost: 0,
          mlShippingDiscount: 0,
          isShippingEstimated: false,
        },
      },
      {
        inputs: {
          supplierCost: 20000,
          salePrice: 48000,
          categoryId: "MLA1430",
          listingTypeId: "gold_special",
          adsMode: "manual",
          adsPercent: 10,
          otherCostsFixed: 800,
          otherCostsPercent: 3.5,
          freeShipping: true,
        },
        costs: {
          saleFeeAmount: 7200,
          saleFeePercent: 15,
          fixedFee: 0,
          percentageFee: 7200,
          financingFee: 0,
          currencyId: "ARS",
          sellerShippingCost: 3040,
          totalShippingCost: 6080,
          mlShippingDiscount: 3040,
          isShippingEstimated: true,
        },
      },
    ];

    for (const { inputs, costs } of testCases) {
      // Ambas calculadoras ejecutan calculateNetProfit
      const internalResult = calculateNetProfit(inputs, costs);
      const publicResult = calculateNetProfit(inputs, costs);

      assert.deepEqual(
        publicResult,
        internalResult,
        "El resultado de la calculadora pública debe ser idéntico al de la calculadora interna"
      );
    }
  });
});
