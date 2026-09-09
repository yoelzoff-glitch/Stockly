// src/services/analytics/forecast/outliers.ts

import { FORECAST_CONFIG } from "./config";
import { DailyProfitPoint } from "./types";

/**
 * Calculates Median of an array of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculates Trimmed Mean (removes top and bottom trimRatio percent).
 */
export function calculateTrimmedMean(values: number[], trimRatio = FORECAST_CONFIG.TRIM_PERCENTILE): number {
  if (values.length === 0) return 0;
  if (values.length <= 4) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const cutCount = Math.floor(sorted.length * trimRatio);
  const remaining = sorted.slice(cutCount, sorted.length - cutCount);
  if (remaining.length === 0) return calculateMedian(values);
  return remaining.reduce((sum, v) => sum + v, 0) / remaining.length;
}

/**
 * Calculates Median Absolute Deviation (MAD).
 */
export function calculateMAD(values: number[], medianVal?: number): number {
  if (values.length === 0) return 0;
  const med = medianVal ?? calculateMedian(values);
  const absoluteDeviations = values.map((v) => Math.abs(v - med));
  return calculateMedian(absoluteDeviations);
}

export interface OutlierAnalysisResult {
  winsorizedPoints: DailyProfitPoint[];
  outlierCount: number;
  outlierDates: string[];
  bounds: { lower: number; upper: number };
}

/**
 * Detects outliers using MAD and creates a winsorized series for forecast baseline estimation.
 * Notice: Original data is never permanently discarded; this limits extreme day influence on future forecast.
 */
export function analyzeAndWinsorizeProfitSeries(
  series: DailyProfitPoint[],
  madMultiplier = FORECAST_CONFIG.MAD_MULTIPLIER
): OutlierAnalysisResult {
  if (series.length < 5) {
    return {
      winsorizedPoints: [...series],
      outlierCount: 0,
      outlierDates: [],
      bounds: { lower: -Infinity, upper: Infinity },
    };
  }

  const profits = series.map((p) => p.netProfit);
  const median = calculateMedian(profits);
  const mad = calculateMAD(profits, median);

  // If dispersion is very small, use standard deviation / IQR fallback
  let spread = mad * 1.4826; // normalized MAD for normal distribution
  if (spread === 0) {
    // Check IQR
    const sorted = [...profits].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    spread = (q3 - q1) / 1.349;
  }

  // Minimum meaningful threshold to avoid flagging normal small fluctuations
  const minSpread = Math.max(Math.abs(median) * 0.20, 1000);
  const effectiveSpread = Math.max(spread, minSpread);

  const lowerBound = median - effectiveSpread * madMultiplier;
  const upperBound = median + effectiveSpread * madMultiplier;

  const outlierDates: string[] = [];
  const winsorizedPoints: DailyProfitPoint[] = series.map((pt) => {
    if (pt.netProfit > upperBound) {
      outlierDates.push(pt.date);
      return { ...pt, netProfit: upperBound };
    } else if (pt.netProfit < lowerBound) {
      outlierDates.push(pt.date);
      return { ...pt, netProfit: lowerBound };
    }
    return { ...pt };
  });

  return {
    winsorizedPoints,
    outlierCount: outlierDates.length,
    outlierDates,
    bounds: { lower: lowerBound, upper: upperBound },
  };
}
