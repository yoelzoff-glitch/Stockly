// src/services/analytics/forecast/weekdayBaseline.ts

import { FORECAST_CONFIG } from "./config";
import { DailyProfitPoint } from "./types";
import { calculateMedian, calculateTrimmedMean } from "./outliers";

/**
 * Calculates robust baseline profit for each weekday (0 = Domingo to 6 = Sábado).
 * Uses a blend of Median (60%) and Trimmed Mean (40%), with recency weighting when enough data exists.
 * Preserves zero-profit days explicitly in the historical distribution.
 */
export function calculateWeekdayBaselines(
  series: DailyProfitPoint[]
): Record<number, number> {
  const baselines: Record<number, number> = {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0
  };

  if (series.length === 0) return baselines;

  // Group by weekday
  const weekdayGroups: Record<number, DailyProfitPoint[]> = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  series.forEach((pt) => {
    if (weekdayGroups[pt.weekday]) {
      weekdayGroups[pt.weekday].push(pt);
    }
  });

  // Calculate overall robust daily average as fallback for unobserved weekdays
  const allProfits = series.map((p) => p.netProfit);
  const globalMedian = calculateMedian(allProfits);
  const globalTrimmed = calculateTrimmedMean(allProfits);
  const globalFallback =
    globalMedian * FORECAST_CONFIG.BASELINE_MEDIAN_WEIGHT +
    globalTrimmed * FORECAST_CONFIG.BASELINE_TRIMMED_WEIGHT;

  // For each weekday (0 to 6)
  for (let w = 0; w <= 6; w++) {
    const points = weekdayGroups[w];

    if (!points || points.length === 0) {
      baselines[w] = Math.max(0, globalFallback);
      continue;
    }

    // If points exist, apply recency weights if series is sufficiently long
    // Points are assumed ordered or can be sorted chronologically
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const values = sorted.map((p) => p.netProfit);

    const median = calculateMedian(values);
    const trimmed = calculateTrimmedMean(values);

    let baseline =
      median * FORECAST_CONFIG.BASELINE_MEDIAN_WEIGHT +
      trimmed * FORECAST_CONFIG.BASELINE_TRIMMED_WEIGHT;

    // Recency weighting boost/dampening if we have >= 4 samples for this weekday
    if (sorted.length >= 4) {
      const recentPoints = sorted.slice(-2); // last 2 occurrences (last 2 weeks)
      const olderPoints = sorted.slice(0, -2);

      const recentAvg = recentPoints.reduce((sum, p) => sum + p.netProfit, 0) / recentPoints.length;
      const olderAvg = olderPoints.reduce((sum, p) => sum + p.netProfit, 0) / olderPoints.length;

      // 60% standard baseline, 40% recent weekday trend
      baseline = baseline * 0.60 + recentAvg * 0.40;
    }

    baselines[w] = Math.max(0, Math.round(baseline));
  }

  return baselines;
}
