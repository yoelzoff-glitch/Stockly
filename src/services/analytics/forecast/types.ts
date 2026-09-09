// src/services/analytics/forecast/types.ts

export interface DailyProfitPoint {
  date: string; // YYYY-MM-DD in tenant timezone
  weekday: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  netProfit: number;
  orderCount: number;
  revenue: number;
}

export type ForecastConfidence = "high" | "medium" | "low";

export interface MonthlyProfitForecast {
  actualProfitMTD: number;

  forecastExpected: number;
  forecastLow: number;
  forecastHigh: number;

  expectedRemainingProfit: number;

  daysElapsed: number;
  daysRemaining: number;
  daysInMonth: number;

  trendPercent: number;
  trendFactor: number;

  confidence: ForecastConfidence;

  weekdayBaselines: Record<number, number>; // 0 to 6 -> expected profit

  outlierDaysCount: number;

  methodologyVersion: string; // e.g. "v1"
}

export interface ForecastAiExplanation {
  summary: string;
  mainDriver: string;
  riskNote: string;
}

export interface ForecastCheckpointSimulation {
  checkpointDay: number;
  actualMTD: number;
  legacyForecast: number;
  robustForecast: number;
  actualMonthClose: number;
  legacyAbsoluteError: number;
  legacyPercentageError: number;
  robustAbsoluteError: number;
  robustPercentageError: number;
}

export interface ForecastBacktestResult {
  month: string; // YYYY-MM
  checkpoints: ForecastCheckpointSimulation[];
  legacyMape: number;
  robustMape: number;
  legacyMae: number;
  robustMae: number;
  percentageImprovement: number;
}
