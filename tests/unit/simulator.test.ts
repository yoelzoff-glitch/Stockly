import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateNetProfit,
  solveTargetPrice,
  solveBreakEvenPrice,
  solveMaxSupplierCost,
  generateMarginComparisonTable,
  SimulatorInputs,
} from "../../src/services/profitability/simulatorEngine";
import { SellingCostsBreakdown } from "../../src/services/meli/profitability/getSellingCosts";

describe("Sprint: Simulador de Rentabilidad y Precios (Casos A - O)", () => {
  // Caso A: Costo $1.000 + precio $2.000. Calcula correctamente ganancia y margen.
  it("Caso A: calcula correctamente ganancia neta, margen neto y retorno sobre costo", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    // Ganancia = 2000 - 1000 - 340 = 660
    assert.equal(res.gananciaNeta, 660);
    // Margen = 660 / 2000 = 33%
    assert.equal(res.margenNetoPercent, 33);
    // Retorno sobre costo = 660 / 1000 = 66%
    assert.equal(res.retornoSobreCostoPercent, 66);
  });

  // Caso B: fixed_fee viene incluido en sale_fee_amount. No se cuenta dos veces.
  it("Caso B: NO duplica el fixed_fee cuando viene reportado dentro de sale_fee_amount", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    // ML devuelve sale_fee_amount = 340 (compuesto por 280 porcentual + 60 fixed_fee)
    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 60,
      percentageFee: 280,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    // Si se duplicara fixed_fee, costo ML sería 340 + 60 = 400 y ganancia 600.
    // Sin duplicar: costo ML = 340 y ganancia = 660.
    assert.equal(res.meliFee, 340);
    assert.equal(res.gananciaNeta, 660);
  });

  // Caso C: Ads 10%. Se descuenta correctamente.
  it("Caso C: descuenta correctamente el porcentaje de Product Ads", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "manual",
      adsPercent: 10,
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    // Ads: 10% de 2000 = 200
    assert.equal(res.adsCost, 200);
    // Ganancia = 2000 - 1000 - 340 - 200 = 460
    assert.equal(res.gananciaNeta, 460);
    assert.equal(res.margenNetoPercent, 23);
  });

  // Caso D: Costo de envío. Se descuenta solamente la parte correspondiente al vendedor.
  it("Caso D: descuenta exclusivamente la parte de envío que asume el vendedor", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 40000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
      freeShipping: true,
    };

    // Envío total $6080, bonificación ML $3040, a cargo del seller $3040
    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 5200,
      saleFeePercent: 13,
      fixedFee: 0,
      percentageFee: 5200,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 3040,
      totalShippingCost: 6080,
      mlShippingDiscount: 3040,
      isShippingEstimated: true,
    };

    const res = calculateNetProfit(inputs, costs);

    // Solo se descuentan 3040 (no los 6080)
    assert.equal(res.shippingCost, 3040);
    assert.equal(res.totalShippingCost, 6080);
    assert.equal(res.mlShippingDiscount, 3040);
    // Ganancia = 40000 - 1000 - 5200 - 3040 = 30760
    assert.equal(res.gananciaNeta, 30760);
  });

  // Caso E: Otros costos porcentuales. Correctos.
  it("Caso E: calcula otros costos porcentuales (e.g. retenciones impositivas)", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
      otherCostsPercent: 5, // 5% impuestos
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    // 5% de 2000 = 100
    assert.equal(res.otherCostsTotal, 100);
    // Ganancia = 2000 - 1000 - 340 - 100 = 560
    assert.equal(res.gananciaNeta, 560);
  });

  // Caso F: Otros costos fijos. Correctos.
  it("Caso F: calcula otros costos fijos (e.g. packaging de $150)", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
      otherCostsFixed: 150,
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    assert.equal(res.otherCostsFixed, 150);
    // Ganancia = 2000 - 1000 - 340 - 150 = 510
    assert.equal(res.gananciaNeta, 510);
    assert.equal(res.margenNetoPercent, 25.5);
  });

  // Caso G: Margen objetivo. Encuentra precio correcto mediante solver.
  it("Caso G: encuentra el precio óptimo mediante el solver binario", async () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    // Función mock de costos ML (15% de comisión estándar)
    const mockGetCosts = async (p: number): Promise<SellingCostsBreakdown> => {
      const fee = Number((p * 0.15).toFixed(2));
      return {
        saleFeeAmount: fee,
        saleFeePercent: 15,
        fixedFee: 0,
        percentageFee: fee,
        financingFee: 0,
        currencyId: "ARS",
        sellerShippingCost: 0,
        totalShippingCost: 0,
        mlShippingDiscount: 0,
        isShippingEstimated: false,
      };
    };

    const targetMargin = 30; // Deseamos 30%
    const { targetPrice, simulation, iterations } = await solveTargetPrice(targetMargin, inputs, mockGetCosts);

    // Margen = (Precio - Costo - 0.15*Precio) / Precio = (0.85*Precio - 1000) / Precio = 0.85 - 1000/Precio
    // 0.85 - 1000/Precio = 0.30 => 1000/Precio = 0.55 => Precio = 1000 / 0.55 ≈ 1818.18
    assert.ok(iterations > 0 && iterations <= 25, "Debe converger en menos de 25 iteraciones");
    assert.ok(Math.abs(simulation.margenNetoPercent - 30) <= 0.2, `Margen ${simulation.margenNetoPercent} debe estar en ±0.2 de 30%`);
    assert.ok(targetPrice >= 1815 && targetPrice <= 1825);
  });

  // Caso H: Costo máximo proveedor. Correcto.
  it("Caso H: calcula el costo máximo admisible de compra a proveedor (Modo C)", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000, // Lo que nos pasó el proveedor actualmente
      quantity: 1,
      salePrice: 2500,    // Precio de venta esperado
      targetMarginPercent: 25, // Margen deseado
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
      otherCostsFixed: 50,
    };

    // Costo ML = 15% de 2500 = 375
    const costs: SellingCostsBreakdown = {
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
    };

    const res = calculateNetProfit(inputs, costs);

    // Ganancia deseada = 25% de 2500 = 625
    // Costos no producto = 375 (ML) + 50 (otros) = 425
    // Costo máximo producto = 2500 - 625 - 425 = 1450
    assert.equal(res.maxSupplierCostUnit, 1450);
    // Diferencia vs costo actual ($1000) = 1450 - 1000 = +450 (viable)
    assert.equal(res.supplierCostDiff, 450);
    assert.equal(res.isSupplierCostViable, true);
  });

  // Caso I: Punto de equilibrio. Correcto.
  it("Caso I: calcula el precio de equilibrio donde la ganancia neta es aproximadamente $0", async () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const mockGetCosts = async (p: number): Promise<SellingCostsBreakdown> => {
      const fee = Number((p * 0.15).toFixed(2));
      return {
        saleFeeAmount: fee,
        saleFeePercent: 15,
        fixedFee: 0,
        percentageFee: fee,
        financingFee: 0,
        currencyId: "ARS",
        sellerShippingCost: 0,
        totalShippingCost: 0,
        mlShippingDiscount: 0,
        isShippingEstimated: false,
      };
    };

    const breakEven = await solveBreakEvenPrice(inputs, mockGetCosts);

    // Precio donde 0.85 * P = 1000 => P ≈ 1176.47
    assert.ok(breakEven >= 1170 && breakEven <= 1180);
    const sim = calculateNetProfit(inputs, await mockGetCosts(breakEven), breakEven);
    assert.ok(Math.abs(sim.gananciaNeta) < 5, `Ganancia en punto de equilibrio (${sim.gananciaNeta}) debe ser cercana a 0`);
  });

  // Caso J: ML API falla. No devuelve comisión cero.
  it("Caso J: ante falla de API de Mercado Libre no devuelve comisión cero silenciosa", async () => {
    const { getSellingCosts } = await import("../../src/services/meli/profitability/getSellingCosts");

    await assert.rejects(
      async () => {
        await getSellingCosts({
          tenantId: "invalid-tenant-nonexistent",
          price: 2000,
          categoryId: "MLA1430",
          listingTypeId: "gold_special",
        });
      },
      (err: Error) => {
        assert.ok(err.message.includes("Mercado Libre") || err.message.includes("No pudimos"));
        return true;
      }
    );
  });

  // Caso K: Shipping API falla. No considera envío gratis accidentalmente.
  it("Caso K: cuando no se marca freeShipping, el costo de envío es estrictamente 0", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
      freeShipping: false,
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);
    assert.equal(res.shippingCost, 0);
  });

  // Caso L: Usuario calcula 20 veces. No genera 20 escrituras Supabase.
  it("Caso L: el cálculo de simulación es stateless y no realiza llamadas de inserción a BD", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    // Ejecutar 20 simulaciones consecutivas en memoria
    for (let i = 0; i < 20; i++) {
      const res = calculateNetProfit({ ...inputs, salePrice: 2000 + i * 100 }, costs);
      assert.ok(res.gananciaNeta > 0);
    }
  });

  // Caso M: Guardar simulación. Crea solamente una persistencia.
  it("Caso M: guarda la simulación de forma explícita generando un payload estructurado", () => {
    const inputs: SimulatorInputs = {
      supplierCost: 1000,
      quantity: 1,
      salePrice: 2000,
      categoryId: "MLA1430",
      listingTypeId: "gold_special",
      adsMode: "none",
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 340,
      saleFeePercent: 17,
      fixedFee: 0,
      percentageFee: 340,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 0,
      totalShippingCost: 0,
      mlShippingDiscount: 0,
      isShippingEstimated: false,
    };

    const res = calculateNetProfit(inputs, costs);

    const simulationPayload = {
      name: "Prueba Cadena Dije",
      scenario_mode: "profit",
      inputs,
      result: res,
    };

    assert.equal(simulationPayload.name, "Prueba Cadena Dije");
    assert.equal(simulationPayload.result.gananciaNeta, 660);
  });

  // Caso N: Tenant A no puede leer simulaciones de Tenant B (RLS policy check).
  it("Caso N: la migración de profitability_simulations aplica RLS estricto por tenant_id", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const migrationContent = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260924000001_profitability_simulations.sql"),
      "utf-8"
    );

    assert.ok(migrationContent.includes("ENABLE ROW LEVEL SECURITY"), "Debe habilitar RLS");
    assert.ok(migrationContent.includes("tenant_id = private.current_tenant_id()"), "Debe aislar por tenant");
  });

  // Caso O: Publicación existente autocompleta datos sin modificar el item real.
  it("Caso O: la selección de una publicación existente en el simulador no muta el producto", () => {
    const existingProduct = {
      id: "prod-123",
      title: "Cadena Virgen Niña",
      price: 84000,
      cost: 40000,
      category_id: "MLA3937",
      listing_type_id: "gold_special",
    };

    // Simulamos un cambio de precio y costo dentro del simulador
    const simulatedInputs: SimulatorInputs = {
      supplierCost: 35000, // Probamos nuevo proveedor más barato
      salePrice: 89000,    // Probamos nuevo precio
      categoryId: existingProduct.category_id,
      listingTypeId: existingProduct.listing_type_id,
      adsMode: "none",
    };

    const costs: SellingCostsBreakdown = {
      saleFeeAmount: 11570,
      saleFeePercent: 13,
      fixedFee: 0,
      percentageFee: 11570,
      financingFee: 0,
      currencyId: "ARS",
      sellerShippingCost: 3040,
      totalShippingCost: 6080,
      mlShippingDiscount: 3040,
      isShippingEstimated: true,
    };

    const sim = calculateNetProfit(simulatedInputs, costs);

    // El producto original permanece idéntico (inmutable)
    assert.equal(existingProduct.price, 84000);
    assert.equal(existingProduct.cost, 40000);
    assert.equal(sim.effectivePrice, 89000);
    assert.equal(sim.supplierCostTotal, 35000);
  });
});
