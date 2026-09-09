// src/services/analytics/forecast/confidence.ts

import { FORECAST_CONFIG } from "./config";
import { DailyProfitPoint, ForecastConfidence } from "./types";
import { calculateMAD, calculateMedian } from "./outliers";

/**
 * Assesses the confidence level of the monthly profit forecast.
 * Criteria:
 * - High: >= 60 days of historical data, active regular sales, low dispersion, low outlier count.
 * - Medium: 30 - 59 days, or moderate dispersion / occasional zero days.
 * - Low: < 30 days, sporadic orders, high volatility or numerous outliers.
 */
export function calculateForecastConfidence(
  series: DailyProfitPoint[],
  outlierCount: number
): { confidence: ForecastConfidence; dispersionRatio: number } {
  const daysCount = series.length;

  if (daysCount < FORECAST_CONFIG.MEDIUM_CONFIDENCE_DAYS) {
    return {
      confidence: "low",
      dispersionRatio: FORECAST_CONFIG.LOW_CONFIDENCE_DISPERSION,
    };
  }

  const profits = series.map((p) => p.netProfit);
  const median = calculateMedian(profits);
  const mad = calculateMAD(profits, median);

  // Coefficient of dispersion
  const cv = median > 0 ? mad / median : 1.0;
  const zeroSalesDays = series.filter((p) => p.netProfit <= 0).length;
  const zeroSalesRatio = zeroSalesDays / Math.max(1, daysCount);
  const outlierRatio = outlierCount / Math.max(1, daysCount);

  // High confidence conditions
  if (
    daysCount >= 60 &&
    cv <= 0.60 &&
    zeroSalesRatio <= 0.20 &&
    outlierRatio <= 0.08
  ) {
    return {
      confidence: "high",
      dispersionRatio: FORECAST_CONFIG.HIGH_CONFIDENCE_DISPERSION,
    };
  }

  // Low confidence conditions for longer series
  if (cv > 1.20 || zeroSalesRatio > 0.50 || outlierRatio > 0.15) {
    return {
      confidence: "low",
      dispersionRatio: FORECAST_CONFIG.LOW_CONFIDENCE_DISPERSION,
    };
  }

  return {
    confidence: "medium",
    dispersionRatio: FORECAST_CONFIG.MEDIUM_CONFIDENCE_DISPERSION,
  };
}
