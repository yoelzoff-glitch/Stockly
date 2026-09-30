// src/components/calculator/PublicProfitabilityCalculator.tsx
"use client";

import React, { useState, useEffect, useId } from "react";
import Link from "next/link";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  HelpCircle,
  Package,
  Info,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BarChart3,
  Percent,
  Truck,
  RotateCcw,
} from "lucide-react";
import {
  SimulatorInputs,
  SimulationResult,
  MarginComparisonRow,
  POPULAR_CATEGORIES_INFO,
  calculateNetProfit,
  estimateSellingCosts,
  solveTargetPrice,
  solveBreakEvenPrice,
  generateMarginComparisonTable,
  validateSimulatorInputs,
  round2,
} from "@/services/profitability/simulatorEngine";
import {
  trackProfitabilityCalculatorView,
  trackProfitabilityCalculatorCalculate,
  trackProfitabilityCalculatorResult,
  trackProfitabilityCalculatorSignupClick,
} from "@/lib/analytics/ga";

interface PublicProfitabilityCalculatorProps {
  isAuthenticated?: boolean;
}

export function PublicProfitabilityCalculator({
  isAuthenticated = false,
}: PublicProfitabilityCalculatorProps) {
  // Mode: "profit" (¿Cuánto gano?) | "ideal_price" (¿A cuánto vender para X% de margen?)
  const [mode, setMode] = useState<"profit" | "ideal_price">("profit");

  // Inputs
  const [supplierCost, setSupplierCost] = useState<string>("12000");
  const [isUsdCost, setIsUsdCost] = useState<boolean>(false);
  const [usdRate, setUsdRate] = useState<string>("1450");
  const [quantity, setQuantity] = useState<string>("1");
  const [salePrice, setSalePrice] = useState<string>("28000");
  const [targetMargin, setTargetMargin] = useState<string>("25");

  // Mercado Libre config
  const [categoryId, setCategoryId] = useState<string>("MLA1430"); // Ropa y Accesorios
  const [listingTypeId, setListingTypeId] = useState<string>("gold_special"); // Clásica
  const [customCommission, setCustomCommission] = useState<string>("15.5");
  const [isCustomCommissionActive, setIsCustomCommissionActive] = useState<boolean>(false);
  const [fixedFee, setFixedFee] = useState<string>("0");
  const [freeShipping, setFreeShipping] = useState<boolean>(false);
  const [billableWeight, setBillableWeight] = useState<string>("300");

  // Ads & Otros
  const [adsPercent, setAdsPercent] = useState<string>("0");
  const [otherCostsFixed, setOtherCostsFixed] = useState<string>("350"); // Packaging
  const [otherCostsPercent, setOtherCostsPercent] = useState<string>("0"); // Impuestos / retenciones

  // UI / Calculation states
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [comparisonRows, setComparisonRows] = useState<MarginComparisonRow[]>([]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Form IDs for accessibility
  const supplierCostId = useId();
  const salePriceId = useId();
  const targetMarginId = useId();
  const categoryIdSelect = useId();
  const commissionId = useId();
  const packagingCostId = useId();
  const taxesCostId = useId();
  const adsCostId = useId();
  const weightId = useId();

  // Track initial view
  useEffect(() => {
    trackProfitabilityCalculatorView("public_page");
  }, []);

  // Update default commission when category or listing type changes (if not manually overridden)
  useEffect(() => {
    if (!isCustomCommissionActive) {
      const cat = POPULAR_CATEGORIES_INFO.find((c) => c.id === categoryId);
      const isPremium = listingTypeId === "gold_pro";
      if (cat) {
        setCustomCommission(String(isPremium ? cat.premiumPercent : cat.clasicaPercent));
      } else {
        setCustomCommission(isPremium ? "31.0" : "15.0");
      }
    }
  }, [categoryId, listingTypeId, isCustomCommissionActive]);

  // If sale price crosses $33.000, suggest free shipping
  useEffect(() => {
    const p = parseFloat(salePrice) || 0;
    if (p >= 33000 && !freeShipping) {
      setFreeShipping(true);
    }
  }, [salePrice]);

  // Calculate supplier cost in ARS
  const getSupplierCostArs = (): number => {
    const raw = parseFloat(supplierCost) || 0;
    if (isUsdCost) {
      const rate = parseFloat(usdRate) || 1450;
      return round2(raw * rate);
    }
    return raw;
  };

  // Build simulator inputs
  const buildCurrentInputs = (): SimulatorInputs => {
    return {
      supplierCost: getSupplierCostArs(),
      quantity: Math.max(1, parseInt(quantity) || 1),
      salePrice: parseFloat(salePrice) || 0,
      targetMarginPercent: parseFloat(targetMargin) || 25,
      categoryId,
      listingTypeId,
      customCommissionPercent: parseFloat(customCommission) || undefined,
      freeShipping,
      billableWeight: parseFloat(billableWeight) || 300,
      adsMode: parseFloat(adsPercent) > 0 ? "manual" : "none",
      adsPercent: parseFloat(adsPercent) || 0,
      otherCostsFixed: parseFloat(otherCostsFixed) || 0,
      otherCostsPercent: parseFloat(otherCostsPercent) || 0,
    };
  };

  // Perform calculation
  const runCalculation = async () => {
    setValidationError(null);
    setIsCalculating(true);

    const inputs = buildCurrentInputs();
    const validation = validateSimulatorInputs(
      inputs,
      mode === "profit" ? "profit" : "ideal_price"
    );

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      setValidationError(firstError || "Revisá los datos ingresados.");
      setIsCalculating(false);
      return;
    }

    trackProfitabilityCalculatorCalculate(mode);

    try {
      const getCostsFn = async (p: number) => {
        return estimateSellingCosts({
          price: p,
          listingTypeId: inputs.listingTypeId,
          categoryId: inputs.categoryId,
          customCommissionPercent: inputs.customCommissionPercent,
          fixedFee: parseFloat(fixedFee) || 0,
          freeShipping: inputs.freeShipping,
          billableWeight: inputs.billableWeight,
        });
      };

      if (mode === "profit") {
        const costs = await getCostsFn(inputs.salePrice || 0);
        const sim = calculateNetProfit(inputs, costs);
        
        // Calculate break-even and comparison table
        const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
        sim.breakEvenPrice = breakEven;

        const table = await generateMarginComparisonTable(inputs, getCostsFn);
        setResult(sim);
        setComparisonRows(table);
      } else {
        // Ideal price mode (solver)
        const targetM = parseFloat(targetMargin) || 25;
        const { targetPrice, simulation } = await solveTargetPrice(targetM, inputs, getCostsFn);
        
        const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
        simulation.breakEvenPrice = breakEven;

        const table = await generateMarginComparisonTable(inputs, getCostsFn);
        setResult(simulation);
        setSalePrice(String(targetPrice));
        setComparisonRows(table);
      }

      trackProfitabilityCalculatorResult(mode);
    } catch (err: any) {
      setValidationError(err.message || "Error al calcular la rentabilidad.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Run calculation automatically on initial load
  useEffect(() => {
    runCalculation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Format currency
  const formatArs = (val: number): string => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number): string => {
    return `${val.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8" id="calculadora">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2 bg-[#F5F3EE] rounded-2xl border border-[rgba(0,57,104,0.12)] shadow-xs">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <button
            type="button"
            onClick={() => {
              setMode("profit");
              setValidationError(null);
            }}
            className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              mode === "profit"
                ? "bg-[#003968] text-white shadow-xs"
                : "text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] hover:bg-white/60"
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span>Calcular rentabilidad</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("ideal_price");
              setValidationError(null);
            }}
            className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              mode === "ideal_price"
                ? "bg-[#003968] text-white shadow-xs"
                : "text-[rgba(0,43,77,0.70)] hover:text-[#002B4D] hover:bg-white/60"
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Calcular precio ideal</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[rgba(0,57,104,0.08)] text-xs font-medium text-[rgba(0,43,77,0.70)]">
          <ShieldCheck className="w-4 h-4 text-[#00DFDB]" />
          <span>Fórmulas oficiales Mercado Libre 2026</span>
        </div>
      </div>

      {/* Main Grid: Form Inputs + Results Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Input Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[rgba(0,57,104,0.08)] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#002B4D]">
                {mode === "profit" ? "Datos de tu publicación" : "Costo y margen deseado"}
              </h2>
              <p className="text-xs text-[rgba(0,43,77,0.65)] mt-0.5">
                {mode === "profit"
                  ? "Ingresá tus costos y precio para estimar tu ganancia real."
                  : "Descubrí el precio exacto necesario para alcanzar tu margen objetivo."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSupplierCost("12000");
                setSalePrice("28000");
                setTargetMargin("25");
                setAdsPercent("0");
                setOtherCostsFixed("350");
                setOtherCostsPercent("0");
                setFreeShipping(false);
              }}
              className="text-xs font-semibold text-[rgba(0,43,77,0.50)] hover:text-[#003968] flex items-center gap-1 transition-colors"
              title="Restablecer valores por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* 1. Costo del Producto */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor={supplierCostId}
                  className="text-xs font-bold text-[#002B4D] flex items-center gap-1.5"
                >
                  <span>Costo unitario del producto</span>
                  <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Obligatorio
                  </span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsUsdCost(false)}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                      !isUsdCost ? "bg-[#003968] text-white" : "text-[rgba(0,43,77,0.60)] hover:bg-[#F5F3EE]"
                    }`}
                  >
                    $ ARS
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUsdCost(true)}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                      isUsdCost ? "bg-[#003968] text-white" : "text-[rgba(0,43,77,0.60)] hover:bg-[#F5F3EE]"
                    }`}
                  >
                    U$S USD
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-[rgba(0,43,77,0.40)]">
                  {isUsdCost ? "U$S" : "$"}
                </div>
                <input
                  id={supplierCostId}
                  type="number"
                  min="0"
                  step="any"
                  value={supplierCost}
                  onChange={(e) => setSupplierCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-11 pl-10 pr-4 text-base font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#00DFDB] focus:border-[#003968] transition-all"
                />
              </div>

              {isUsdCost && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[rgba(0,43,77,0.70)] bg-[#F5F3EE] p-2.5 rounded-lg border border-[rgba(0,57,104,0.08)]">
                  <span>Tipo de cambio USD:</span>
                  <input
                    type="number"
                    value={usdRate}
                    onChange={(e) => setUsdRate(e.target.value)}
                    className="w-24 h-7 px-2 text-xs font-bold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded"
                  />
                  <span className="font-semibold text-[#003968]">
                    = {formatArs(getSupplierCostArs())} ARS
                  </span>
                </div>
              )}
            </div>

            {/* 2. Precio de venta (Modo A) o Margen objetivo (Modo B) */}
            {mode === "profit" ? (
              <div>
                <label
                  htmlFor={salePriceId}
                  className="block text-xs font-bold text-[#002B4D] mb-1.5"
                >
                  Precio de venta estimado en Mercado Libre ($ ARS)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sm font-bold text-[rgba(0,43,77,0.40)]">
                    $
                  </div>
                  <input
                    id={salePriceId}
                    type="number"
                    min="0"
                    step="any"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="28000"
                    className="w-full h-11 pl-10 pr-4 text-base font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#00DFDB] focus:border-[#003968] transition-all"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor={targetMarginId}
                    className="text-xs font-bold text-[#002B4D]"
                  >
                    Margen neto objetivo deseado (%)
                  </label>
                  <span className="text-xs font-bold text-[#003968]">
                    {targetMargin}% sobre el precio de venta
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id={targetMarginId}
                      type="number"
                      min="1"
                      max="89"
                      step="1"
                      value={targetMargin}
                      onChange={(e) => setTargetMargin(e.target.value)}
                      placeholder="25"
                      className="w-full h-11 pl-4 pr-9 text-base font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#00DFDB] focus:border-[#003968] transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-sm font-bold text-[rgba(0,43,77,0.40)]">
                      %
                    </div>
                  </div>
                  {/* Quick Margin Pills */}
                  <div className="flex items-center gap-1.5">
                    {["15", "20", "25", "30"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTargetMargin(m)}
                        className={`px-2.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          targetMargin === m
                            ? "bg-[#003968] text-white border-[#003968]"
                            : "bg-[#F5F3EE] text-[#002B4D] border-[rgba(0,57,104,0.12)] hover:bg-white"
                        }`}
                      >
                        {m}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Categoría y Tipo de Publicación */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label
                  htmlFor={categoryIdSelect}
                  className="block text-xs font-bold text-[#002B4D] mb-1.5"
                >
                  Categoría de Mercado Libre
                </label>
                <select
                  id={categoryIdSelect}
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setIsCustomCommissionActive(false);
                  }}
                  className="w-full h-11 px-3 text-xs font-medium text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#00DFDB] focus:border-[#003968]"
                >
                  {POPULAR_CATEGORIES_INFO.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({listingTypeId === "gold_pro" ? `${cat.premiumPercent}%` : `${cat.clasicaPercent}%`})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002B4D] mb-1.5">
                  Tipo de publicación
                </label>
                <div className="grid grid-cols-2 gap-2 h-11 p-1 bg-[#F5F3EE] rounded-xl border border-[rgba(0,57,104,0.12)]">
                  <button
                    type="button"
                    onClick={() => {
                      setListingTypeId("gold_special");
                      setIsCustomCommissionActive(false);
                    }}
                    className={`rounded-lg text-xs font-bold transition-all ${
                      listingTypeId === "gold_special"
                        ? "bg-white text-[#003968] shadow-2xs"
                        : "text-[rgba(0,43,77,0.60)] hover:text-[#002B4D]"
                    }`}
                  >
                    Clásica
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setListingTypeId("gold_pro");
                      setIsCustomCommissionActive(false);
                    }}
                    className={`rounded-lg text-xs font-bold transition-all ${
                      listingTypeId === "gold_pro"
                        ? "bg-white text-[#003968] shadow-2xs"
                        : "text-[rgba(0,43,77,0.60)] hover:text-[#002B4D]"
                    }`}
                  >
                    Premium (Cuotas)
                  </button>
                </div>
              </div>
            </div>

            {/* Comisión personalizada (Editable) */}
            <div className="bg-[#F5F3EE]/70 rounded-xl p-3.5 border border-[rgba(0,57,104,0.08)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#003968] shrink-0" />
                <div>
                  <label htmlFor={commissionId} className="text-xs font-bold text-[#002B4D] block">
                    Comisión de Mercado Libre
                  </label>
                  <span className="text-[11px] text-[rgba(0,43,77,0.60)]">
                    {listingTypeId === "gold_pro" ? "Incluye cuotas sin interés" : "Estándar por categoría"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id={commissionId}
                  type="number"
                  step="0.1"
                  min="0"
                  max="60"
                  value={customCommission}
                  onChange={(e) => {
                    setCustomCommission(e.target.value);
                    setIsCustomCommissionActive(true);
                  }}
                  className="w-16 h-8 px-2 text-right text-xs font-bold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-lg"
                />
                <span className="text-xs font-bold text-[#002B4D]">%</span>
              </div>
            </div>

            {/* 4. Envío de Mercado Envíos */}
            <div className="pt-2 border-t border-[rgba(0,57,104,0.08)] space-y-3">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={freeShipping}
                    onChange={(e) => setFreeShipping(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#003968] rounded border-[rgba(0,57,104,0.25)] focus:ring-[#00DFDB]"
                  />
                  <div>
                    <span className="text-xs font-bold text-[#002B4D] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#003968]" />
                      <span>Ofrecer Envío Gratis (Mercado Envíos)</span>
                    </span>
                    <p className="text-[11px] text-[rgba(0,43,77,0.60)] mt-0.5 leading-relaxed">
                      {parseFloat(salePrice) >= 33000 || mode === "ideal_price"
                        ? "Para publicaciones >= $33.000 el envío gratis es obligatorio en ML con bonificación del 50% para sellers con buena reputación."
                        : "Ventas menores a $33.000 abonan el flete completo si decidís bonificarlo."}
                    </p>
                  </div>
                </label>
              </div>

              {freeShipping && (
                <div className="flex items-center gap-3 pl-6">
                  <label htmlFor={weightId} className="text-xs font-semibold text-[#002B4D]">
                    Peso estimado del paquete:
                  </label>
                  <select
                    id={weightId}
                    value={billableWeight}
                    onChange={(e) => setBillableWeight(e.target.value)}
                    className="h-8 px-2 text-xs font-medium text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-lg"
                  >
                    <option value="300">Hasta 500 g</option>
                    <option value="1000">500 g a 2 kg</option>
                    <option value="3000">Más de 2 kg</option>
                  </select>
                </div>
              )}
            </div>

            {/* Toggle Configuración Avanzada: Publicidad y Otros Costos */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-bold text-[#003968] hover:text-[#002B4D] flex items-center gap-1.5 py-1"
              >
                <span>{showAdvanced ? "Ocultar costos adicionales" : "+ Agregar publicidad, packaging e impuestos"}</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-[#F5F3EE]/80 rounded-xl border border-[rgba(0,57,104,0.08)] space-y-4 animate-in fade-in-50 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor={adsCostId} className="block text-[11px] font-bold text-[#002B4D] mb-1">
                        Publicidad (Product Ads)
                      </label>
                      <div className="relative">
                        <input
                          id={adsCostId}
                          type="number"
                          min="0"
                          max="40"
                          step="0.5"
                          value={adsPercent}
                          onChange={(e) => setAdsPercent(e.target.value)}
                          placeholder="0"
                          className="w-full h-9 pl-3 pr-7 text-xs font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-lg"
                        />
                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-xs text-[rgba(0,43,77,0.40)]">
                          %
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor={packagingCostId} className="block text-[11px] font-bold text-[#002B4D] mb-1">
                        Packaging / Embalaje fijo
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-xs text-[rgba(0,43,77,0.40)]">
                          $
                        </div>
                        <input
                          id={packagingCostId}
                          type="number"
                          min="0"
                          step="any"
                          value={otherCostsFixed}
                          onChange={(e) => setOtherCostsFixed(e.target.value)}
                          placeholder="350"
                          className="w-full h-9 pl-6 pr-3 text-xs font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-lg"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={taxesCostId} className="block text-[11px] font-bold text-[#002B4D] mb-1">
                        Impuestos / IIBB / Retenciones
                      </label>
                      <div className="relative">
                        <input
                          id={taxesCostId}
                          type="number"
                          min="0"
                          max="30"
                          step="0.5"
                          value={otherCostsPercent}
                          onChange={(e) => setOtherCostsPercent(e.target.value)}
                          placeholder="0"
                          className="w-full h-9 pl-3 pr-7 text-xs font-semibold text-[#002B4D] bg-white border border-[rgba(0,57,104,0.18)] rounded-lg"
                        />
                        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-xs text-[rgba(0,43,77,0.40)]">
                          %
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Calculate Button */}
          <button
            type="button"
            onClick={runCalculation}
            disabled={isCalculating}
            className="w-full h-12 rounded-xl text-sm font-bold text-white bg-[#003968] hover:bg-[#002B4D] active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isCalculating ? (
              <span>Calculando simulación...</span>
            ) : (
              <>
                <Calculator className="w-4 h-4" />
                <span>{mode === "profit" ? "Calcular mi rentabilidad" : "Calcular precio ideal sugerido"}</span>
              </>
            )}
          </button>
        </div>

        {/* RIGHT COLUMN: Results Card & Financial Breakdown (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {result ? (
            <div className="bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] p-6 sm:p-7 shadow-md shadow-[rgba(0,43,77,0.04)] space-y-6">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[rgba(0,43,77,0.50)]">
                  Resultado de la Simulación
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    result.gananciaNeta > 0
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {result.gananciaNeta > 0 ? "Operación Rentable" : "Operación a Pérdida"}
                </span>
              </div>

              {/* In Ideal Price Mode: Highlight suggested price */}
              {mode === "ideal_price" && (
                <div className="p-4 rounded-xl bg-[rgba(0,223,219,0.08)] border border-[rgba(0,223,219,0.40)]">
                  <span className="text-xs font-semibold text-[#003968] block">
                    Precio de venta sugerido en Mercado Libre
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-[#002B4D] tracking-tight mt-1">
                    {formatArs(result.listPrice)}
                  </div>
                  <span className="text-[11px] text-[rgba(0,43,77,0.70)] mt-1 block">
                    Para obtener un {targetMargin}% de margen neto tras comisiones y flete.
                  </span>
                </div>
              )}

              {/* Main Metric Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Ganancia Estimada */}
                <div className="p-4 rounded-xl bg-[#F5F3EE] border border-[rgba(0,57,104,0.08)]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[rgba(0,43,77,0.60)] block">
                    Ganancia estimada
                  </span>
                  <div
                    className={`text-xl sm:text-2xl font-black tracking-tight mt-1 ${
                      result.gananciaNeta >= 0 ? "text-[#002B4D]" : "text-red-600"
                    }`}
                  >
                    {formatArs(result.gananciaNeta)}
                  </div>
                  <span className="text-[10px] text-[rgba(0,43,77,0.50)] mt-0.5 block">
                    Limpio por unidad vendida
                  </span>
                </div>

                {/* Margen Neto (%) */}
                <div className="p-4 rounded-xl bg-[#F5F3EE] border border-[rgba(0,57,104,0.08)]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[rgba(0,43,77,0.60)] block">
                    Margen neto
                  </span>
                  <div
                    className={`text-xl sm:text-2xl font-black tracking-tight mt-1 ${
                      result.margenNetoPercent >= 15
                        ? "text-[#003968]"
                        : result.margenNetoPercent >= 0
                        ? "text-amber-700"
                        : "text-red-600"
                    }`}
                  >
                    {formatPercent(result.margenNetoPercent)}
                  </div>
                  <span className="text-[10px] text-[rgba(0,43,77,0.50)] mt-0.5 block">
                    Ganancia / Precio de venta
                  </span>
                </div>
              </div>

              {/* Secondary Metric: Retorno sobre costo (ROI) */}
              <div className="p-3.5 rounded-xl bg-white border border-[rgba(0,57,104,0.12)] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#002B4D] block">
                    Rentabilidad sobre costo (ROI)
                  </span>
                  <span className="text-[11px] text-[rgba(0,43,77,0.60)]">
                    Ganancia sobre lo invertido en el producto
                  </span>
                </div>
                <div className="text-sm font-black text-[#003968]">
                  {formatPercent(result.retornoSobreCostoPercent)}
                </div>
              </div>

              {/* Detailed Cost Breakdown Table */}
              <div className="space-y-2.5 pt-2 border-t border-[rgba(0,57,104,0.08)]">
                <span className="text-xs font-bold text-[#002B4D] uppercase tracking-wider block">
                  Desglose de la operación
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#002B4D] font-semibold">
                    <span>Precio de venta cobrado</span>
                    <span>{formatArs(result.effectivePrice)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[rgba(0,43,77,0.70)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span>Costo del producto</span>
                    </span>
                    <span>- {formatArs(result.supplierCostTotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[rgba(0,43,77,0.70)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>
                        Comisión Mercado Libre ({result.meliFeePercent}%)
                      </span>
                    </span>
                    <span>- {formatArs(result.meliFee)}</span>
                  </div>

                  {result.shippingCost > 0 && (
                    <div className="flex items-center justify-between text-[rgba(0,43,77,0.70)]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        <span>Costo de envío vendedor</span>
                      </span>
                      <span>- {formatArs(result.shippingCost)}</span>
                    </div>
                  )}

                  {result.adsCost > 0 && (
                    <div className="flex items-center justify-between text-[rgba(0,43,77,0.70)]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>Publicidad (Ads {result.adsPercent}%)</span>
                      </span>
                      <span>- {formatArs(result.adsCost)}</span>
                    </div>
                  )}

                  {result.otherCostsTotal > 0 && (
                    <div className="flex items-center justify-between text-[rgba(0,43,77,0.70)]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                        <span>Packaging e impuestos</span>
                      </span>
                      <span>- {formatArs(result.otherCostsTotal)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs font-bold text-[#002B4D] pt-2 border-t border-[rgba(0,57,104,0.08)]">
                    <span>Total de costos y cargos</span>
                    <span>- {formatArs(result.totalCosts)}</span>
                  </div>
                </div>
              </div>

              {/* Punto de equilibrio */}
              {result.breakEvenPrice && (
                <div className="p-3 rounded-lg bg-[rgba(0,57,104,0.04)] border border-[rgba(0,57,104,0.08)] flex items-center justify-between text-xs">
                  <span className="text-[rgba(0,43,77,0.70)]">Punto de equilibrio (ganancia $0):</span>
                  <span className="font-bold text-[#002B4D]">{formatArs(result.breakEvenPrice)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] p-8 text-center text-xs text-[rgba(0,43,77,0.60)]">
              Completá los datos y hacé clic en calcular para ver el desglose.
            </div>
          )}

          {/* Quick Margin Comparison Table */}
          {comparisonRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-[rgba(0,57,104,0.12)] p-5 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#002B4D] block">
                Precios requeridos según margen deseado
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(0,57,104,0.08)] text-[rgba(0,43,77,0.50)] font-semibold text-left">
                      <th className="pb-2">Margen</th>
                      <th className="pb-2">Precio sugerido</th>
                      <th className="pb-2 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(0,57,104,0.04)]">
                    {comparisonRows.map((row) => (
                      <tr key={row.targetMargin} className="hover:bg-[#F5F3EE]/50">
                        <td className="py-2 font-bold text-[#003968]">{row.targetMargin}%</td>
                        <td className="py-2 text-[#002B4D] font-medium">{formatArs(row.requiredPrice)}</td>
                        <td className="py-2 text-right font-bold text-emerald-700">{formatArs(row.netProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONTEXTUAL CONVERSION CARD TO LIBRETAX */}
      <div className="bg-gradient-to-br from-[#002B4D] to-[#003968] rounded-3xl p-7 sm:p-10 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#00DFDB]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Esto es una simulación manual unitaria</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            ¿Querés saber cuánto ganás realmente en cada una de tus ventas activas?
          </h3>

          <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
            Con <strong>LibretaX</strong> conectás tu cuenta de Mercado Libre en 30 segundos y ves la rentabilidad neta real de todo tu catálogo de forma automática, contemplando retenciones impositivas exactas, devoluciones, cargos de Flex y Product Ads.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            {isAuthenticated ? (
              <Link
                href="/dashboard/simulator"
                onClick={() => trackProfitabilityCalculatorSignupClick("authenticated_cta")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-[#002B4D] bg-[#00DFDB] hover:bg-white transition-all shadow-md active:scale-[0.99]"
              >
                <span>Abrir en mi LibretaX</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  onClick={() => trackProfitabilityCalculatorSignupClick("primary_cta")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-[#002B4D] bg-[#00DFDB] hover:bg-white transition-all shadow-md active:scale-[0.99]"
                >
                  <span>Analizar mi cuenta con LibretaX</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/register"
                  onClick={() => trackProfitabilityCalculatorSignupClick("secondary_cta")}
                  className="inline-flex items-center justify-center px-5 py-3.5 rounded-xl text-sm font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 transition-all text-center"
                >
                  <span>Crear cuenta gratis</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-96 h-96 rounded-full bg-[#00DFDB]/15 blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
