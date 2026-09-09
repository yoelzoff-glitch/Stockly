// src/services/analytics/forecast/trend.ts

import { FORECAST_CONFIG } from "./config";
import { DailyProfitPoint } from "./types";
import { calculateTrimmedMean } from "./outliers";

export interface TrendAnalysisResult {
  trendPercent: number; // e.g. +8.4%
  trendFactor: number;  // clamped [0.80, 1.25]
  profitTrendRatio: number;
  orderTrendRatio: number;
  ticketRecent: number;
  ticketHistorical: number;
}

/**
 * Calculates recent trend by comparing robust average of recent 7 days vs recent 28 days.
 * Includes order count momentum verification to prevent single large tickets from distorting acceleration.
 */
export function calculateRecentTrend(series: DailyProfitPoint[]): TrendAnalysisResult {
  if (series.length < 7) {
    return {
      trendPercent: 0,
      trendFactor: 1.0,
      profitTrendRatio: 1.0,
      orderTrendRatio: 1.0,
      ticketRecent: 0,
      ticketHistorical: 0,
    };
  }

  // Ensure chronological order
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));

  // Recent 7 days
  const last7 = sorted.slice(-FORECAST_CONFIG.RECENT_WINDOW_SHORT_DAYS);
  // Recent 28 days (or all available if < 28)
  const last28 = sorted.slice(-Math.min(sorted.length, FORECAST_CONFIG.RECENT_WINDOW_LONG_DAYS));

  const profit7 = calculateTrimmedMean(last7.map((p) => p.netProfit));
  const profit28 = calculateTrimmedMean(last28.map((p) => p.netProfit));

  const orders7 = last7.reduce((sum, p) => sum + p.orderCount, 0) / Math.max(1, last7.length);
  const orders28 = last28.reduce((sum, p) => sum + p.orderCount, 0) / Math.max(1, last28.length);

  const revenue7 = last7.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders7 = last7.reduce((sum, p) => sum + p.orderCount, 0);
  const ticketRecent = totalOrders7 > 0 ? revenue7 / totalOrders7 : 0;

  const revenue28 = last28.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders28 = last28.reduce((sum, p) => sum + p.orderCount, 0);
  const ticketHistorical = totalOrders28 > 0 ? revenue28 / totalOrders28 : 0;

  // Raw profit trend ratio
  let profitRatio = 1.0;
  if (profit28 > 0) {
    profitRatio = profit7 / profit28;
  } else if (profit7 > 0) {
    profitRatio = 1.15; // Moderate recovery from zero base
  }

  // Order volume ratio
  let orderRatio = 1.0;
  if (orders28 > 0) {
    orderRatio = orders7 / orders28;
  }

  // Confirming signal:
  // If profit grew by 80% but orders only by 2%, it's likely an isolated large ticket; dampen trend factor.
  let derivedTrend = profitRatio;
  if (profitRatio > 1.10 && orderRatio < 1.05) {
    // Dampen isolated ticket growth
    derivedTrend = 1.0 + (profitRatio - 1.0) * 0.40;
  } else if (profitRatio < 0.90 && orderRatio > 0.95) {
    // Orders remained healthy despite temporary cost/margin dip
    derivedTrend = 1.0 - (1.0 - profitRatio) * 0.50;
  }

  // Clamp trend factor within reasonable boundaries [0.80, 1.25]
  const clampedFactor = Math.min(
    FORECAST_CONFIG.MAX_TREND_FACTOR,
    Math.max(FORECAST_CONFIG.MIN_TREND_FACTOR, derivedTrend)
  );

  const trendPercent = Math.round((clampedFactor - 1.0) * 1000) / 10; // e.g. 8.4%

  return {
    trendPercent,
    trendFactor: Math.round(clampedFactor * 1000) / 1000,
    profitTrendRatio: Math.round(profitRatio * 1000) / 1000,
    orderTrendRatio: Math.round(orderRatio * 1000) / 1000,
    ticketRecent: Math.round(ticketRecent),
    ticketHistorical: Math.round(ticketHistorical),
  };
}
