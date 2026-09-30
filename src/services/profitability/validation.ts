// src/services/profitability/validation.ts
import { SimulatorInputs } from "./types";

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateSimulatorInputs(inputs: Partial<SimulatorInputs>, mode: "profit" | "ideal_price" | "max_cost" = "profit"): ValidationResult {
  const errors: Record<string, string> = {};

  if (mode === "profit" || mode === "max_cost") {
    if (inputs.salePrice === undefined || isNaN(inputs.salePrice) || inputs.salePrice <= 0) {
      errors.salePrice = "El precio de venta debe ser un número mayor a 0.";
    }
  }

  if (mode === "profit" || mode === "ideal_price") {
    if (inputs.supplierCost === undefined || isNaN(inputs.supplierCost) || inputs.supplierCost < 0) {
      errors.supplierCost = "El costo del producto no puede ser negativo.";
    }
  }

  if (mode === "ideal_price") {
    if (inputs.targetMarginPercent === undefined || isNaN(inputs.targetMarginPercent) || inputs.targetMarginPercent <= 0 || inputs.targetMarginPercent >= 90) {
      errors.targetMarginPercent = "El margen objetivo debe estar entre 1% y 89%.";
    }
  }

  if (inputs.customCommissionPercent !== undefined && (isNaN(inputs.customCommissionPercent) || inputs.customCommissionPercent < 0 || inputs.customCommissionPercent > 70)) {
    errors.customCommissionPercent = "La comisión debe ser un porcentaje válido entre 0% y 70%.";
  }

  if (inputs.adsPercent !== undefined && (isNaN(inputs.adsPercent) || inputs.adsPercent < 0 || inputs.adsPercent > 50)) {
    errors.adsPercent = "El porcentaje de publicidad debe estar entre 0% y 50%.";
  }

  if (inputs.otherCostsPercent !== undefined && (isNaN(inputs.otherCostsPercent) || inputs.otherCostsPercent < 0 || inputs.otherCostsPercent > 50)) {
    errors.otherCostsPercent = "El porcentaje de impuestos debe estar entre 0% y 50%.";
  }

  if (inputs.otherCostsFixed !== undefined && (isNaN(inputs.otherCostsFixed) || inputs.otherCostsFixed < 0)) {
    errors.otherCostsFixed = "Los costos fijos no pueden ser negativos.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
