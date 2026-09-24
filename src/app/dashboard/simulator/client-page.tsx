// src/app/dashboard/simulator/client-page.tsx
"use client";

import { useState } from "react";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Scale,
  Save,
  Trash2,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  simulateProfitAction,
  solveTargetPriceAction,
  solveMaxSupplierCostAction,
  saveSimulationAction,
  deleteSimulationAction,
  getSavedSimulationsAction,
} from "./actions";
import {
  SimulatorInputs,
  SimulationResult,
  MarginComparisonRow,
} from "@/services/profitability/simulatorEngine";

// Categorías comunes de MLA para selección rápida
const POPULAR_CATEGORIES = [
  { id: "MLA1430", name: "Ropa y Accesorios" },
  { id: "MLA3937", name: "Joyas y Relojes" },
  { id: "MLA1051", name: "Celulares y Teléfonos" },
  { id: "MLA1000", name: "Electrónica, Audio y Video" },
  { id: "MLA1574", name: "Hogar, Muebles y Jardín" },
  { id: "MLA1276", name: "Deportes y Fitness" },
  { id: "MLA1246", name: "Belleza y Cuidado Personal" },
  { id: "MLA1132", name: "Juegos y Juguetes" },
];

export function SimulatorClient({
  initialProducts = [],
  usdRate = 1500,
  defaultPackagingCost = 0,
  initialSavedSimulations = [],
  totalSavedSimulations = 0,
}: {
  initialProducts: any[];
  usdRate: number;
  defaultPackagingCost: number;
  initialSavedSimulations: any[];
  totalSavedSimulations: number;
}) {
  // Modo de cálculo: "A" (¿Cuánto gano?) | "B" (¿A cuánto vender?) | "C" (¿Cuánto pagar?)
  const [mode, setMode] = useState<"A" | "B" | "C">("A");

  // Origen de datos: "new" (Producto nuevo) | "existing" (Publicación existente)
  const [productOrigin, setProductOrigin] = useState<"new" | "existing">("new");
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Entradas numéricas básicas
  const [supplierCost, setSupplierCost] = useState<string>("");
  const [isUsdSupplierCost, setIsUsdSupplierCost] = useState<boolean>(false);
  const [salePrice, setSalePrice] = useState<string>("");
  const [targetMargin, setTargetMargin] = useState<string>("25");
  const [quantity, setQuantity] = useState<string>("1");

  // Mercado Libre
  const [categoryId, setCategoryId] = useState<string>("MLA3937");
  const [listingTypeId, setListingTypeId] = useState<string>("gold_special"); // Clásica
  const [logisticType, setLogisticType] = useState<string>("drop_off");
  const [freeShipping, setFreeShipping] = useState<boolean>(false);
  const [billableWeight, setBillableWeight] = useState<string>("300");

  // Publicidad (Ads)
  const [adsMode, setAdsMode] = useState<"none" | "manual" | "acos">("none");
  const [adsPercent, setAdsPercent] = useState<string>("8");

  // Descuentos / Promociones
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState<string>("10");

  // Otros Costos
  const [otherCostsFixed, setOtherCostsFixed] = useState<string>(
    defaultPackagingCost > 0 ? String(defaultPackagingCost) : "0"
  );
  const [otherCostsPercent, setOtherCostsPercent] = useState<string>("0");

  // Estado de cálculo y resultados
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [comparisonRows, setComparisonRows] = useState<MarginComparisonRow[]>([]);

  // Guardado de simulaciones
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [simulationName, setSimulationName] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [savedSims, setSavedSims] = useState<any[]>(initialSavedSimulations);
  const [savedTotalCount, setSavedTotalCount] = useState<number>(totalSavedSimulations);
  const [savedPage, setSavedPage] = useState<number>(1);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(false);

  // Manejador al seleccionar un producto existente
  const handleSelectExistingProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = initialProducts.find((p) => p.id === prodId);
    if (!prod) return;

    if (prod.price) setSalePrice(String(prod.price));
    if (prod.cost || prod.cost_price) setSupplierCost(String(prod.cost || prod.cost_price));
    if (prod.category_id) setCategoryId(prod.category_id);
    if (prod.listing_type_id) setListingTypeId(prod.listing_type_id);
    
    // Si el precio supera los $33.000, sugerir envío gratis activo en MLA
    if (Number(prod.price) >= 33000) {
      setFreeShipping(true);
    }
  };

  // Cálculo del costo proveedor efectivo en ARS
  const getEffectiveSupplierCostArs = (): number => {
    const raw = parseFloat(supplierCost) || 0;
    return isUsdSupplierCost ? Number((raw * usdRate).toFixed(2)) : raw;
  };

  // Construcción del objeto de inputs
  const buildInputs = (): SimulatorInputs => {
    return {
      supplierCost: getEffectiveSupplierCostArs(),
      quantity: Math.max(1, parseInt(quantity) || 1),
      salePrice: parseFloat(salePrice) || 0,
      targetMarginPercent: parseFloat(targetMargin) || 25,
      categoryId,
      listingTypeId,
      logisticType,
      freeShipping,
      billableWeight: parseFloat(billableWeight) || 300,
      adsMode,
      adsPercent: adsMode === "none" ? 0 : parseFloat(adsPercent) || 0,
      discountType,
      discountValue: discountType === "none" ? 0 : parseFloat(discountValue) || 0,
      otherCostsFixed: parseFloat(otherCostsFixed) || 0,
      otherCostsPercent: parseFloat(otherCostsPercent) || 0,
      meliItemId: selectedProductId ? initialProducts.find(p => p.id === selectedProductId)?.meli_id : undefined,
    };
  };

  // Ejecutar cálculo según el modo seleccionado
  const handleCalculate = async () => {
    setIsCalculating(true);
    setCalcError(null);

    const inputs = buildInputs();

    try {
      if (mode === "A") {
        // Modo A: ¿Cuánto gano?
        if (!inputs.salePrice || inputs.salePrice <= 0) {
          setCalcError("Por favor ingresá un precio de venta estimado mayor a 0.");
          setIsCalculating(false);
          return;
        }

        const res = await simulateProfitAction(inputs);
        if (!res.success || !res.result) {
          throw new Error(res.error || "No se pudo calcular la rentabilidad.");
        }
        setResult(res.result);
        setComparisonRows(res.comparisonRows || []);
      } else if (mode === "B") {
        // Modo B: ¿A cuánto tengo que vender?
        if (!inputs.supplierCost || inputs.supplierCost <= 0) {
          setCalcError("Por favor ingresá el costo del proveedor.");
          setIsCalculating(false);
          return;
        }
        const targetM = parseFloat(targetMargin) || 25;

        const res = await solveTargetPriceAction(inputs, targetM);
        if (!res.success || !res.result) {
          throw new Error(res.error || "No se pudo resolver el precio sugerido.");
        }
        setResult(res.result);
        if (res.targetPrice) {
          setSalePrice(String(res.targetPrice));
        }
        setComparisonRows(res.comparisonRows || []);
      } else if (mode === "C") {
        // Modo C: ¿Cuánto puedo pagar?
        if (!inputs.salePrice || inputs.salePrice <= 0) {
          setCalcError("Por favor ingresá el precio de venta de mercado.");
          setIsCalculating(false);
          return;
        }
        const targetM = parseFloat(targetMargin) || 25;

        const res = await solveMaxSupplierCostAction(inputs, targetM);
        if (!res.success || !res.result) {
          throw new Error(res.error || "No se pudo calcular el costo máximo.");
        }
        setResult(res.result);
        setComparisonRows(res.comparisonRows || []);
      }
    } catch (err: any) {
      setCalcError(err.message || "Error al calcular simulación.");
    } finally {
      setIsCalculating(false);
    }
  };

  // Guardar simulación
  const handleSaveSimulation = async () => {
    if (!simulationName.trim()) {
      alert("Por favor escribí un nombre para identificar la simulación.");
      return;
    }
    if (!result) return;

    setIsSaving(true);
    try {
      const res = await saveSimulationAction({
        name: simulationName.trim(),
        scenarioMode: mode,
        inputs: buildInputs(),
        result,
      });

      if (res.success) {
        setSaveSuccessMsg("¡Simulación guardada correctamente!");
        setIsSaveModalOpen(false);
        setSimulationName("");
        // Refrescar listado
        const updated = await getSavedSimulationsAction(1, 10);
        if (updated.success) {
          setSavedSims(updated.simulations);
          setSavedTotalCount(updated.totalCount);
        }
      } else {
        alert(res.error || "Error al guardar simulación.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar simulación guardada
  const handleDeleteSaved = async (id: string) => {
    if (!confirm("¿Deseas eliminar esta simulación guardada?")) return;
    const res = await deleteSimulationAction(id);
    if (res.success) {
      setSavedSims(savedSims.filter((s) => s.id !== id));
      setSavedTotalCount((prev) => Math.max(0, prev - 1));
    } else {
      alert(res.error || "Error al eliminar simulación.");
    }
  };

  return (
    <div className="space-y-6 text-[#101828]">
      {/* 1. SELECTOR DE MODO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1.5 rounded-xl bg-[#F5F3EE] border border-[#DCDAD4]">
        <button
          type="button"
          onClick={() => {
            setMode("A");
            setResult(null);
            setCalcError(null);
          }}
          className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
            mode === "A"
              ? "bg-white shadow-sm border border-[#DCDAD4] text-[#102A56]"
              : "text-[#5F6875] hover:text-[#101828] hover:bg-white/50"
          }`}
        >
          <div className={`p-2 rounded-md ${mode === "A" ? "bg-[#102A56] text-white" : "bg-[#EBE9E1] text-[#5F6875]"}`}>
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">A — ¿Cuánto gano?</div>
            <div className="text-[11px] text-[#5F6875]">Tengo costo y precio estimado</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("B");
            setResult(null);
            setCalcError(null);
          }}
          className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
            mode === "B"
              ? "bg-white shadow-sm border border-[#DCDAD4] text-[#102A56]"
              : "text-[#5F6875] hover:text-[#101828] hover:bg-white/50"
          }`}
        >
          <div className={`p-2 rounded-md ${mode === "B" ? "bg-[#102A56] text-white" : "bg-[#EBE9E1] text-[#5F6875]"}`}>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">B — ¿A cuánto vender?</div>
            <div className="text-[11px] text-[#5F6875]">Buscar precio para margen objetivo</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("C");
            setResult(null);
            setCalcError(null);
          }}
          className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
            mode === "C"
              ? "bg-white shadow-sm border border-[#DCDAD4] text-[#102A56]"
              : "text-[#5F6875] hover:text-[#101828] hover:bg-white/50"
          }`}
        >
          <div className={`p-2 rounded-md ${mode === "C" ? "bg-[#102A56] text-white" : "bg-[#EBE9E1] text-[#5F6875]"}`}>
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">C — ¿Cuánto puedo pagar?</div>
            <div className="text-[11px] text-[#5F6875]">Costo máximo de compra a proveedor</div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* PANEL IZQUIERDO: CONFIGURACIÓN E INPUTS (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Selector de Producto: Nuevo vs Existente */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5F6875]">
                Origen del Producto
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProductOrigin("new");
                    setSelectedProductId("");
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                    productOrigin === "new"
                      ? "bg-[#102A56] text-white border-[#102A56]"
                      : "bg-white text-[#5F6875] border-[#DCDAD4] hover:bg-[#F5F3EE]"
                  }`}
                >
                  Producto nuevo
                </button>
                <button
                  type="button"
                  onClick={() => setProductOrigin("existing")}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium border transition-colors ${
                    productOrigin === "existing"
                      ? "bg-[#102A56] text-white border-[#102A56]"
                      : "bg-white text-[#5F6875] border-[#DCDAD4] hover:bg-[#F5F3EE]"
                  }`}
                >
                  Publicación existente
                </button>
              </div>
            </div>

            {productOrigin === "existing" && (
              <div className="space-y-1.5 pt-2 border-t border-[#DCDAD4]">
                <Label htmlFor="existingProduct" className="text-xs font-semibold text-[#101828]">
                  Seleccionar publicación de Mercado Libre:
                </Label>
                <select
                  id="existingProduct"
                  value={selectedProductId}
                  onChange={(e) => handleSelectExistingProduct(e.target.value)}
                  className="w-full h-9 text-xs rounded-md border border-[#DCDAD4] bg-white px-2.5 text-[#101828] focus:outline-hidden focus:ring-1 focus:ring-[#102A56]"
                >
                  <option value="">-- Seleccionar una publicación --</option>
                  {initialProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} (MLA: {p.meli_id}) — ${Number(p.price || 0).toLocaleString("es-AR")}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5F6875]">
                  Autocompleta precio, categoría y logística. El simulador es <strong>read-only</strong> y no modificará tu publicación en Mercado Libre.
                </p>
              </div>
            )}
          </div>

          {/* Sección 1: Datos Financieros Clave */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6875] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#102A56]" />
              Valores del Negocio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Costo Proveedor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="supplierCost" className="text-xs font-semibold text-[#101828]">
                    Costo proveedor / compra
                  </Label>
                  <label className="flex items-center gap-1 text-[11px] text-[#5F6875] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUsdSupplierCost}
                      onChange={(e) => setIsUsdSupplierCost(e.target.checked)}
                      className="rounded border-[#DCDAD4] text-[#102A56] w-3 h-3 cursor-pointer"
                    />
                    <span>En USD ($1.523)</span>
                  </label>
                </div>
                <div className="relative">
                  <Input
                    id="supplierCost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ej: 1000"
                    value={supplierCost}
                    onChange={(e) => setSupplierCost(e.target.value)}
                    className="h-9 text-xs border-[#DCDAD4] pr-12"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-[#5F6875]">
                    {isUsdSupplierCost ? "USD" : "ARS"}
                  </span>
                </div>
                {isUsdSupplierCost && parseFloat(supplierCost) > 0 && (
                  <p className="text-[11px] text-[#175CD3]">
                    ≈ ${(parseFloat(supplierCost) * usdRate).toLocaleString("es-AR", { minimumFractionDigits: 2 })} ARS
                  </p>
                )}
              </div>

              {/* Precio de Venta (Modo A o C) */}
              <div className="space-y-1.5">
                <Label htmlFor="salePrice" className="text-xs font-semibold text-[#101828]">
                  {mode === "B" ? "Precio de venta (Calculado por Solver)" : "Precio de venta estimado ($)"}
                </Label>
                <div className="relative">
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={mode === "B" ? "Se calculará automáticamente" : "Ej: 2000"}
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    disabled={mode === "B"}
                    className="h-9 text-xs border-[#DCDAD4] pr-12 disabled:bg-[#F5F3EE] disabled:text-[#5F6875]"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-[#5F6875]">
                    ARS
                  </span>
                </div>
                {mode === "B" && (
                  <p className="text-[11px] text-[#5F6875]">
                    El solver buscará el precio exacto para tu margen.
                  </p>
                )}
              </div>

              {/* Margen Objetivo % (Modo B o C, u opcional en A) */}
              <div className="space-y-1.5">
                <Label htmlFor="targetMargin" className="text-xs font-semibold text-[#101828]">
                  Margen neto objetivo (%)
                </Label>
                <div className="relative">
                  <Input
                    id="targetMargin"
                    type="number"
                    step="0.5"
                    min="1"
                    max="89"
                    placeholder="25"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(e.target.value)}
                    className="h-9 text-xs border-[#DCDAD4] pr-8"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-[#5F6875]">
                    %
                  </span>
                </div>
                <p className="text-[11px] text-[#5F6875]">
                  Porcentaje de ganancia neta deseada sobre el precio de venta.
                </p>
              </div>

              {/* Cantidad por venta */}
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs font-semibold text-[#101828]">
                  Cantidad de unidades por venta
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 text-xs border-[#DCDAD4]"
                />
                <p className="text-[11px] text-[#5F6875]">
                  Packs o combos (multiplica costo de producto).
                </p>
              </div>
            </div>
          </div>

          {/* Sección 2: Parámetros Oficiales Mercado Libre */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6875] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#102A56]" />
              Condiciones de Mercado Libre
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Categoría */}
              <div className="space-y-1.5">
                <Label htmlFor="categoryId" className="text-xs font-semibold text-[#101828]">
                  Categoría
                </Label>
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-9 text-xs rounded-md border border-[#DCDAD4] bg-white px-2.5 text-[#101828] focus:outline-hidden focus:ring-1 focus:ring-[#102A56]"
                >
                  {POPULAR_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-[#5F6875]">ID personalizado:</span>
                  <input
                    type="text"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value.trim().toUpperCase())}
                    placeholder="MLA..."
                    className="h-6 w-28 text-[11px] border border-[#DCDAD4] rounded px-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Tipo de Publicación */}
              <div className="space-y-1.5">
                <Label htmlFor="listingTypeId" className="text-xs font-semibold text-[#101828]">
                  Tipo de publicación
                </Label>
                <select
                  id="listingTypeId"
                  value={listingTypeId}
                  onChange={(e) => setListingTypeId(e.target.value)}
                  className="w-full h-9 text-xs rounded-md border border-[#DCDAD4] bg-white px-2.5 text-[#101828] focus:outline-hidden focus:ring-1 focus:ring-[#102A56]"
                >
                  <option value="gold_special">Clásica (gold_special) — Menor comisión</option>
                  <option value="gold_pro">Premium (gold_pro) — Cuotas sin interés</option>
                </select>
                <p className="text-[11px] text-[#5F6875]">
                  Se consultará la comisión exacta por API oficial en tiempo real.
                </p>
              </div>

              {/* Logística */}
              <div className="space-y-1.5">
                <Label htmlFor="logisticType" className="text-xs font-semibold text-[#101828]">
                  Método de envío / logística
                </Label>
                <select
                  id="logisticType"
                  value={logisticType}
                  onChange={(e) => setLogisticType(e.target.value)}
                  className="w-full h-9 text-xs rounded-md border border-[#DCDAD4] bg-white px-2.5 text-[#101828] focus:outline-hidden focus:ring-1 focus:ring-[#102A56]"
                >
                  <option value="drop_off">Mercado Envíos Colecta / Puntos (drop_off)</option>
                  <option value="fulfillment">Mercado Envíos Full (fulfillment)</option>
                  <option value="cross_docking">Mercado Envíos Flex / Rápido</option>
                </select>
              </div>

              {/* Envío gratis */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">
                  ¿Ofrecés envío gratis?
                </Label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-1.5 text-xs text-[#101828] cursor-pointer">
                    <input
                      type="radio"
                      name="freeShipping"
                      checked={!freeShipping}
                      onChange={() => setFreeShipping(false)}
                      className="text-[#102A56]"
                    />
                    <span>No (A cargo del comprador)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#101828] cursor-pointer">
                    <input
                      type="radio"
                      name="freeShipping"
                      checked={freeShipping}
                      onChange={() => setFreeShipping(true)}
                      className="text-[#102A56]"
                    />
                    <span>Sí (Vendedor asume costo)</span>
                  </label>
                </div>
                <p className="text-[11px] text-[#5F6875]">
                  En MLA compras ≥ $33.000 tienen envío gratis con subsidio de Mercado Libre.
                </p>
              </div>
            </div>
          </div>

          {/* Sección 3: Publicidad, Promociones y Otros Costos */}
          <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6875] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#102A56]" />
              Ads, Promociones y Costos Adicionales
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Product Ads */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Publicidad (Ads)</Label>
                <select
                  value={adsMode}
                  onChange={(e) => setAdsMode(e.target.value as any)}
                  className="w-full h-8 text-xs rounded border border-[#DCDAD4] bg-white px-2"
                >
                  <option value="none">Sin Ads (0%)</option>
                  <option value="manual">Ingresar % manual</option>
                </select>
                {adsMode === "manual" && (
                  <div className="relative pt-1">
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      value={adsPercent}
                      onChange={(e) => setAdsPercent(e.target.value)}
                      className="h-7 text-xs pr-6"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-[#5F6875]">%</span>
                  </div>
                )}
              </div>

              {/* Descuentos / Promociones */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Promoción / Descuento</Label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full h-8 text-xs rounded border border-[#DCDAD4] bg-white px-2"
                >
                  <option value="none">Sin descuento</option>
                  <option value="percent">% sobre lista</option>
                  <option value="fixed">$ monto fijo</option>
                </select>
                {discountType !== "none" && (
                  <div className="relative pt-1">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="h-7 text-xs pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-[#5F6875]">
                      {discountType === "percent" ? "%" : "ARS"}
                    </span>
                  </div>
                )}
              </div>

              {/* Otros Costos (Packaging / Extra) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Costos fijos extra ($)</Label>
                <Input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="Packaging, bolsas..."
                  value={otherCostsFixed}
                  onChange={(e) => setOtherCostsFixed(e.target.value)}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-[#5F6875]">Caja, film, mano de obra.</p>
              </div>
            </div>
          </div>

          {/* BOTÓN CALCULAR */}
          {calcError && (
            <div className="p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-xs text-[#B42318] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{calcError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={handleCalculate}
              disabled={isCalculating}
              className="h-10 px-6 bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-2"
            >
              {isCalculating ? (
                <>Calculando comisiones oficiales...</>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  Calcular Simulación
                </>
              )}
            </Button>

            {result && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSaveModalOpen(true)}
                className="h-10 px-4 text-xs font-semibold border-[#DCDAD4] hover:bg-[#F5F3EE] flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar simulación
              </Button>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: RESULTADOS Y DECISIÓN (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {!result && !isCalculating && (
            <div className="bg-[#FCFCFA] rounded-xl border border-dashed border-[#DCDAD4] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#EBE9E1] text-[#102A56] flex items-center justify-center mx-auto">
                <Calculator className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#101828]">Simulador Listo</h4>
              <p className="text-xs text-[#5F6875] max-w-sm mx-auto">
                Completá los costos y hacé clic en <strong>Calcular Simulación</strong> para ver la ganancia neta exacta con comisiones oficiales de Mercado Libre.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Tarjeta Principal de Ganancia */}
              <div className="bg-[#102A56] text-white rounded-xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-semibold text-white/70">
                    Resultado de Simulación
                  </span>
                  {result.isTargetAchieved !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        result.isTargetAchieved
                          ? "bg-[#12B76A]/20 text-[#6CE9A6] border border-[#12B76A]/30"
                          : "bg-[#F04438]/20 text-[#FDA29B] border border-[#F04438]/30"
                      }`}
                    >
                      {result.isTargetAchieved
                        ? "Objetivo alcanzado"
                        : `Faltan ${Math.abs(result.targetDifferencePoints || 0)} pts`}
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-xs text-white/70">Vendiendo a:</div>
                  <div className="text-2xl font-bold font-mono">
                    ${result.effectivePrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/70">Te quedarían:</div>
                    <div className={`text-3xl font-extrabold font-mono ${result.gananciaNeta >= 0 ? "text-[#6CE9A6]" : "text-[#FDA29B]"}`}>
                      ${result.gananciaNeta.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/70">Margen neto:</div>
                    <div className="text-xl font-bold font-mono">
                      {result.margenNetoPercent}%
                    </div>
                    <div className="text-[10px] text-white/60">
                      Retorno: {result.retornoSobreCostoPercent}%
                    </div>
                  </div>
                </div>

                {result.breakEvenPrice !== undefined && (
                  <div className="pt-2 border-t border-white/10 text-xs text-white/80 flex items-center justify-between">
                    <span>Punto de equilibrio (sin perder):</span>
                    <strong className="font-mono text-white">
                      ${result.breakEvenPrice.toLocaleString("es-AR")}
                    </strong>
                  </div>
                )}
              </div>

              {/* Bloque Especial Modo C: ¿Cuánto puedo pagar? / ¿Me sirve comprarlo? */}
              {result.maxSupplierCostUnit !== undefined && (
                <div className="bg-white rounded-xl border border-[#DCDAD4] p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#102A56]">
                    <Scale className="w-4 h-4 text-[#102A56]" />
                    ¿Me sirve el precio del proveedor?
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded bg-[#F5F3EE]">
                      <span className="text-[#5F6875] text-[11px]">Costo máx. proveedor:</span>
                      <div className="font-bold text-[#102A56] text-base font-mono">
                        ${result.maxSupplierCostUnit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#F5F3EE]">
                      <span className="text-[#5F6875] text-[11px]">Tu costo actual:</span>
                      <div className="font-bold text-[#102A56] text-base font-mono">
                        ${result.supplierCostUnit.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                      result.isSupplierCostViable
                        ? "bg-[#ECFDF3] border border-[#ABEFC6] text-[#067647]"
                        : "bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318]"
                    }`}
                  >
                    {result.isSupplierCostViable ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <div>
                      {result.isSupplierCostViable ? (
                        <span>
                          <strong>¡Viable!</strong> Tu costo está{" "}
                          <strong>${Math.abs(result.supplierCostDiff || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong>{" "}
                          por debajo del máximo para lograr tu margen objetivo del {result.targetMarginPercent}%.
                        </span>
                      ) : (
                        <span>
                          <strong>No viable para el objetivo:</strong> El proveedor te cobra{" "}
                          <strong>${Math.abs(result.supplierCostDiff || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong>{" "}
                          más de lo admisible para alcanzar {result.targetMarginPercent}% de margen.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Desglose Detallado de Costos */}
              <div className="bg-white rounded-xl border border-[#DCDAD4] p-4 shadow-xs space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5F6875]">
                  Desglose del Cálculo
                </span>

                <div className="divide-y divide-[#EBE9E1] text-xs">
                  <div className="flex justify-between py-1.5 font-semibold text-[#101828]">
                    <span>Precio de venta efectivo:</span>
                    <span className="font-mono">${result.effectivePrice.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between py-1.5 text-[#5F6875]">
                    <div>
                      <span>Comisión Mercado Libre ({result.meliFeePercent}%):</span>
                      {result.meliFixedFee > 0 && (
                        <div className="text-[10px] text-[#5F6875]">
                          (Incluye cargo fijo de ${result.meliFixedFee.toLocaleString("es-AR")})
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-[#D92D20]">
                      -${result.meliFee.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 text-[#5F6875]">
                    <div>
                      <span>Costo de envío (vendedor):</span>
                      {result.mlShippingDiscount > 0 && (
                        <div className="text-[10px] text-[#12B76A]">
                          (Bonificación ML: -${result.mlShippingDiscount.toLocaleString("es-AR")})
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-[#D92D20]">
                      -${result.shippingCost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {result.adsCost > 0 && (
                    <div className="flex justify-between py-1.5 text-[#5F6875]">
                      <span>Ads estimado ({result.adsPercent}%):</span>
                      <span className="font-mono text-[#D92D20]">
                        -${result.adsCost.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 text-[#5F6875]">
                    <span>Costo producto (x{result.quantity} un.):</span>
                    <span className="font-mono text-[#D92D20]">
                      -${result.supplierCostTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {result.otherCostsTotal > 0 && (
                    <div className="flex justify-between py-1.5 text-[#5F6875]">
                      <span>Otros costos (packaging / fijos):</span>
                      <span className="font-mono text-[#D92D20]">
                        -${result.otherCostsTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2 pb-1 font-bold text-sm text-[#101828]">
                    <span>GANANCIA NETA:</span>
                    <span className={`font-mono ${result.gananciaNeta >= 0 ? "text-[#027A48]" : "text-[#D92D20]"}`}>
                      ${result.gananciaNeta.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Comparador Rápido de Márgenes */}
              {comparisonRows.length > 0 && (
                <div className="bg-white rounded-xl border border-[#DCDAD4] p-4 shadow-xs space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5F6875]">
                    Comparador Rápido de Márgenes
                  </span>
                  <div className="border border-[#EBE9E1] rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] border-b border-[#EBE9E1]">
                        <tr>
                          <th className="px-3 py-1.5">Margen</th>
                          <th className="px-3 py-1.5">Precio necesario</th>
                          <th className="px-3 py-1.5 text-right">Ganancia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EBE9E1]">
                        {comparisonRows.map((row) => (
                          <tr key={row.targetMargin} className="hover:bg-[#F5F3EE]/50">
                            <td className="px-3 py-1.5 font-bold text-[#102A56]">{row.targetMargin}%</td>
                            <td className="px-3 py-1.5 font-mono">${row.requiredPrice.toLocaleString("es-AR")}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-[#027A48]">
                              +${Math.round(row.netProfit).toLocaleString("es-AR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 4: MIS SIMULACIONES GUARDADAS */}
      <div className="bg-white rounded-xl border border-[#DCDAD4] p-5 shadow-xs space-y-4 pt-6 mt-8">
        <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#101828]">Mis Simulaciones Guardadas</h3>
            <p className="text-xs text-[#5F6875]">Historial de escenarios y cotizaciones de proveedores para tu tenant.</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F5F3EE] text-[#5F6875]">
            {savedTotalCount} guardadas
          </span>
        </div>

        {savedSims.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#5F6875]">
            Aún no has guardado ninguna simulación. Podés calcular y hacer clic en <strong>Guardar simulación</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedSims.map((sim) => {
              const res = sim.result as SimulationResult;
              const dateStr = new Date(sim.created_at).toLocaleDateString("es-AR");

              return (
                <div
                  key={sim.id}
                  className="rounded-lg border border-[#DCDAD4] p-3.5 bg-[#FCFCFA] hover:border-[#102A56]/40 transition-colors space-y-2 relative"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#101828] line-clamp-1">{sim.name}</h4>
                      <span className="text-[10px] text-[#5F6875]">{dateStr}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(sim.id)}
                      className="text-[#5F6875] hover:text-[#D92D20] p-1 transition-colors"
                      title="Eliminar simulación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-[#EBE9E1]">
                    <div>
                      <span className="text-[#5F6875]">Costo:</span>{" "}
                      <strong className="font-mono">${res?.supplierCostTotal?.toLocaleString("es-AR")}</strong>
                    </div>
                    <div>
                      <span className="text-[#5F6875]">Venta:</span>{" "}
                      <strong className="font-mono">${res?.effectivePrice?.toLocaleString("es-AR")}</strong>
                    </div>
                    <div>
                      <span className="text-[#5F6875]">Ganancia:</span>{" "}
                      <strong className="font-mono text-[#027A48]">${res?.gananciaNeta?.toLocaleString("es-AR")}</strong>
                    </div>
                    <div>
                      <span className="text-[#5F6875]">Margen:</span>{" "}
                      <strong className="font-mono text-[#102A56]">{res?.margenNetoPercent}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL GUARDAR SIMULACIÓN */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#DCDAD4]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#101828]">
              Guardar Simulación
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Asignale un nombre descriptivo para consultarla más adelante en tu historial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="simName" className="text-xs font-semibold text-[#101828]">
                Nombre de la simulación
              </Label>
              <Input
                id="simName"
                placeholder="Ej: Cadena Virgen proveedor Elena"
                value={simulationName}
                onChange={(e) => setSimulationName(e.target.value)}
                className="h-8 text-xs border-[#DCDAD4]"
              />
            </div>
            {result && (
              <div className="p-2.5 rounded bg-[#F5F3EE] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#5F6875]">Precio venta estimado:</span>
                  <strong>${result.effectivePrice.toLocaleString("es-AR")}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6875]">Margen obtenido:</span>
                  <strong className="text-[#102A56]">{result.margenNetoPercent}%</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F6875]">Ganancia neta:</span>
                  <strong className="text-[#027A48]">${result.gananciaNeta.toLocaleString("es-AR")}</strong>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSaveModalOpen(false)}
              className="h-8 text-xs border-[#DCDAD4]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveSimulation}
              disabled={isSaving}
              className="h-8 text-xs bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold"
            >
              {isSaving ? "Guardando..." : "Confirmar y Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
