// src/services/profitability/types.ts

export interface SellingCostsBreakdown {
  saleFeeAmount: number;
  saleFeePercent: number;
  fixedFee: number;
  percentageFee: number;
  financingFee: number;
  currencyId: string;
  sellerShippingCost: number;
  totalShippingCost: number;
  mlShippingDiscount: number;
  isShippingEstimated: boolean;
  rawResponse?: any;
}

export interface SimulatorInputs {
  supplierCost: number;       // Costo de compra unitario
  quantity?: number;          // Cantidad por venta (default 1)
  salePrice?: number;         // Precio de lista estimado
  targetMarginPercent?: number; // Margen objetivo (e.g. 25 para 25%)

  // Mercado Libre
  categoryId: string;
  listingTypeId: string;      // "gold_special" (Clásica) | "gold_pro" (Premium)
  customCommissionPercent?: number; // Permite ingreso/ajuste manual de comisión
  logisticType?: string;
  shippingMode?: string;
  billableWeight?: number;
  freeShipping?: boolean;
  meliItemId?: string;
  customShippingCost?: number; // Permite costo manual de envío

  // Ads
  adsMode?: "none" | "manual" | "acos";
  adsPercent?: number;        // e.g. 8 para 8%

  // Descuentos / Promociones
  discountType?: "none" | "percent" | "fixed";
  discountValue?: number;     // e.g. 10% o $1000

  // Otros costos
  otherCostsFixed?: number;   // $ empaque, embalaje, etc.
  otherCostsPercent?: number; // % impuestos, percepciones, etc.
}

export interface SimulationResult {
  listPrice: number;
  effectivePrice: number;     // Precio final tras descuentos
  supplierCostTotal: number;
  supplierCostUnit: number;
  quantity: number;

  // Desglose de costos
  meliFee: number;
  meliFixedFee: number;
  meliPercentageFee: number;
  meliFeePercent: number;
  shippingCost: number;
  totalShippingCost: number;
  mlShippingDiscount: number;
  adsCost: number;
  adsPercent: number;
  discountAmount: number;
  otherCostsFixed: number;
  otherCostsPercent: number;
  otherCostsTotal: number;
  totalCosts: number;

  // Resultados principales
  gananciaNeta: number;
  margenNetoPercent: number;
  retornoSobreCostoPercent: number;

  // Punto de equilibrio
  breakEvenPrice?: number;

  // Comparación contra objetivo
  targetMarginPercent?: number;
  targetDifferencePoints?: number;
  isTargetAchieved?: boolean;

  // Modo C: Costo máximo de compra
  maxSupplierCostUnit?: number;
  supplierCostDiff?: number;
  isSupplierCostViable?: boolean;
}

export interface MarginComparisonRow {
  targetMargin: number;
  requiredPrice: number;
  netProfit: number;
  meliFee: number;
}

export interface EstimateSellingCostsParams {
  price: number;
  listingTypeId?: string;
  categoryId?: string;
  customCommissionPercent?: number;
  fixedFee?: number;
  freeShipping?: boolean;
  billableWeight?: number;
  customShippingCost?: number;
  currencyId?: string;
}

export interface CategoryRateInfo {
  id: string;
  name: string;
  clasicaPercent: number;
  premiumPercent: number;
}
