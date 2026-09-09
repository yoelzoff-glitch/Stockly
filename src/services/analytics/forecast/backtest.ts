// src/services/analytics/forecast/backtest.ts

import { calculateMonthlyProfitForecast, getDaysInMonth } from "./calculateMonthlyProfitForecast";
import { DailyProfitPoint, ForecastBacktestResult, ForecastCheckpointSimulation } from "./types";

/**
 * Runs a backtest simulation over a closed historical month.
 *
 * Simulates what LibretaX would have projected at checkpoints:
 * day 5, day 10, day 15, day 20, day 25
 * and compares it against:
 * 1. Legacy Formula: (actualMTD / checkpointDay) * daysInMonth
 * 2. Robust Forecast: calculateMonthlyProfitForecast(...)
 *
 * Computes MAE, MAPE and percentage improvement.
 */
export function runMonthBacktest(
  fullSeries: DailyProfitPoint[],
  targetYear: number,
  targetMonth: number,
  checkpoints = [5, 10, 15, 20, 25]
): ForecastBacktestResult {
  const monthStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
  const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth);

  // Filter days belonging to the target month
  const monthPoints = fullSeries.filter((p) => p.date.startsWith(monthStr));
  const actualMonthClose = monthPoints.reduce((sum, p) => sum + p.netProfit, 0);

  const simulationResults: ForecastCheckpointSimulation[] = [];

  for (const checkpointDay of checkpoints) {
    if (checkpointDay >= daysInTargetMonth) continue;

    // Checkpoint date string: "YYYY-MM-DD"
    const checkpointDateStr = `${monthStr}-${String(checkpointDay).padStart(2, "0")}`;

    // Available historical series up to checkpoint day (including prior months and days 1..checkpointDay of target month)
    const availableSeries = fullSeries.filter((p) => p.date <= checkpointDateStr);

    // Actual MTD realized up to checkpoint day
    const mtdPoints = monthPoints.filter((p) => {
      const dayNum = parseInt(p.date.split("-")[2], 10);
      return dayNum <= checkpointDay;
    });
    const actualMTD = mtdPoints.reduce((sum, p) => sum + p.netProfit, 0);

    // 1. Legacy formula: (actualMTD / checkpointDay) * daysInTargetMonth
    const legacyForecast = Math.round((actualMTD / checkpointDay) * daysInTargetMonth);

    // 2. Robust forecast
    const forecastResult = calculateMonthlyProfitForecast({
      historicalSeries: availableSeries,
      currentYear: targetYear,
      currentMonth: targetMonth,
      currentDay: checkpointDay,
      actualProfitMTD: actualMTD,
    });
    const robustForecast = forecastResult.forecastExpected;

    // Error calculations
    const legacyAbsError = Math.abs(legacyForecast - actualMonthClose);
    const legacyPctError = actualMonthClose !== 0
      ? (legacyAbsError / Math.abs(actualMonthClose)) * 100
      : 0;

    const robustAbsError = Math.abs(robustForecast - actualMonthClose);
    const robustPctError = actualMonthClose !== 0
      ? (robustAbsError / Math.abs(actualMonthClose)) * 100
      : 0;

    simulationResults.push({
      checkpointDay,
      actualMTD,
      legacyForecast,
      robustForecast,
      actualMonthClose,
      legacyAbsoluteError: legacyAbsError,
      legacyPercentageError: Math.round(legacyPctError * 10) / 10,
      robustAbsoluteError: robustAbsError,
      robustPercentageError: Math.round(robustPctError * 10) / 10,
    });
  }

  // Summary Metrics
  const count = simulationResults.length || 1;
  const legacyMae = Math.round(simulationResults.reduce((sum, s) => sum + s.legacyAbsoluteError, 0) / count);
  const robustMae = Math.round(simulationResults.reduce((sum, s) => sum + s.robustAbsoluteError, 0) / count);

  const legacyMape = Math.round((simulationResults.reduce((sum, s) => sum + s.legacyPercentageError, 0) / count) * 10) / 10;
  const robustMape = Math.round((simulationResults.reduce((sum, s) => sum + s.robustPercentageError, 0) / count) * 10) / 10;

  let percentageImprovement = 0;
  if (legacyMape > 0) {
    percentageImprovement = Math.round(((legacyMape - robustMape) / legacyMape) * 1000) / 10;
  }

  return {
    month: monthStr,
    checkpoints: simulationResults,
    legacyMape,
    robustMape,
    legacyMae,
    robustMae,
    percentageImprovement,
  };
}
