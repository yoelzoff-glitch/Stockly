// src/services/analytics/forecast/calculateMonthlyProfitForecast.ts

import { FORECAST_CONFIG } from "./config";
import { DailyProfitPoint, MonthlyProfitForecast } from "./types";
import { analyzeAndWinsorizeProfitSeries } from "./outliers";
import { calculateWeekdayBaselines } from "./weekdayBaseline";
import { calculateRecentTrend } from "./trend";
import { calculateForecastConfidence } from "./confidence";

export interface ForecastInputParams {
  historicalSeries: DailyProfitPoint[]; // Up to 90 days of daily profit points
  currentYear: number;
  currentMonth: number; // 1 to 12
  currentDay: number;   // 1 to 31 (today in tenant timezone)
  actualProfitMTD: number; // Canonical MTD profit from financial data
}

/**
 * Returns exact number of days in a given year and month (1-indexed).
 * Correctly accounts for leap years (29 days in Feb) and 30/31 days.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Pure, deterministic monthly profit forecast engine.
 *
 * Formula:
 * monthlyForecast = actualProfitMTD + sum(expectedProfitForRemainingDay)
 * where expectedProfit(d) = weekdayBaseline(weekday(d)) * trendFactor
 */
export function calculateMonthlyProfitForecast({
  historicalSeries,
  currentYear,
  currentMonth,
  currentDay,
  actualProfitMTD,
}: ForecastInputParams): MonthlyProfitForecast {
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const daysElapsed = Math.min(daysInMonth, Math.max(1, currentDay));
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // 1. Outlier analysis & winsorization for future baselines
  const { winsorizedPoints, outlierCount } = analyzeAndWinsorizeProfitSeries(historicalSeries);

  // 2. Weekday baselines derived from winsorized robust series
  const weekdayBaselines = calculateWeekdayBaselines(winsorizedPoints);

  // 3. Recent trend factor with order volume validation and clamping
  const { trendPercent, trendFactor } = calculateRecentTrend(winsorizedPoints);

  // 4. Forecast remaining days of the current month
  // We forecast strictly for future days: tomorrow (currentDay + 1) through end of month.
  let expectedRemainingProfit = 0;

  for (let d = daysElapsed + 1; d <= daysInMonth; d++) {
    // Determine weekday for calendar date (currentYear, currentMonth, d)
    // Month is 0-indexed in JS Date constructor
    const dateObj = new Date(Date.UTC(currentYear, currentMonth - 1, d, 12, 0, 0));
    const weekday = dateObj.getUTCDay(); // 0 = Domingo, ..., 6 = Sábado

    const baseline = weekdayBaselines[weekday] ?? 0;
    const dayForecast = Math.round(baseline * trendFactor);
    expectedRemainingProfit += Math.max(0, dayForecast);
  }

  // 5. Total Expected Forecast
  const forecastExpected = Math.round(actualProfitMTD + expectedRemainingProfit);

  // 6. Confidence & Dispersion range
  const { confidence, dispersionRatio } = calculateForecastConfidence(
    historicalSeries,
    outlierCount
  );

  // Remaining profit dispersion
  const remainingSpread = Math.round(expectedRemainingProfit * dispersionRatio);

  // Low forecast must never be less than actual MTD profit already realized!
  const forecastLow = Math.max(
    Math.round(actualProfitMTD),
    Math.round(forecastExpected - remainingSpread)
  );
  const forecastHigh = Math.round(forecastExpected + remainingSpread);

  return {
    actualProfitMTD: Math.round(actualProfitMTD),
    forecastExpected,
    forecastLow,
    forecastHigh,
    expectedRemainingProfit: Math.round(expectedRemainingProfit),
    daysElapsed,
    daysRemaining,
    daysInMonth,
    trendPercent,
    trendFactor,
    confidence,
    weekdayBaselines,
    outlierDaysCount: outlierCount,
    methodologyVersion: FORECAST_CONFIG.METHODOLOGY_VERSION,
  };
}
