import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMonthlyProfitForecast,
  getDaysInMonth,
} from "@/services/analytics/forecast/calculateMonthlyProfitForecast";
import { analyzeAndWinsorizeProfitSeries, calculateMedian, calculateTrimmedMean } from "@/services/analytics/forecast/outliers";
import { calculateWeekdayBaselines } from "@/services/analytics/forecast/weekdayBaseline";
import { calculateRecentTrend } from "@/services/analytics/forecast/trend";
import { calculateForecastConfidence } from "@/services/analytics/forecast/confidence";
import { runMonthBacktest } from "@/services/analytics/forecast/backtest";
import { generateRuleBasedForecastExplanation } from "@/services/analytics/forecast/ai/explainForecast";
import type { DailyProfitPoint } from "@/services/analytics/forecast/types";

describe("Sprint 30: Robust Monthly Profit Forecast Engine", () => {
  // Helper to generate a baseline series of N days
  function generateSeries(days: number, baseProfit = 100000, startYear = 2026, startMonth = 6): DailyProfitPoint[] {
    const points: DailyProfitPoint[] = [];
    const date = new Date(Date.UTC(startYear, startMonth - 1, 1, 12, 0, 0));

    for (let i = 0; i < days; i++) {
      const d = new Date(date.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const weekday = d.getUTCDay();

      points.push({
        date: `${year}-${month}-${day}`,
        weekday,
        netProfit: baseProfit,
        orderCount: 10,
        revenue: baseProfit * 1.5,
      });
    }
    return points;
  }

  // 1. Días reales del mes (Febrero bisiesto, 30, 31)
  it("Test: getDaysInMonth calcula días exactos para febrero común, bisiesto, 30 y 31 días", () => {
    assert.equal(getDaysInMonth(2026, 2), 28); // 2026 no es bisiesto
    assert.equal(getDaysInMonth(2024, 2), 29); // 2024 bisiesto
    assert.equal(getDaysInMonth(2026, 9), 30); // Septiembre = 30
    assert.equal(getDaysInMonth(2026, 10), 31); // Octubre = 31
  });

  // 2. Demanda estable produce proyección exacta y alta confianza
  it("Test: Demanda perfectamente estable de 90 días proyecta exactamente el total esperado", () => {
    // 90 days with $100k daily profit
    const series = generateSeries(90, 100000, 2026, 6);
    // Simulating September 2026 (30 days) at day 10 with actual MTD $1.000.000
    const res = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 10,
      actualProfitMTD: 1000000,
    });

    assert.equal(res.daysInMonth, 30);
    assert.equal(res.daysElapsed, 10);
    assert.equal(res.daysRemaining, 20);
    assert.equal(res.expectedRemainingProfit, 20 * 100000); // 2.000.000
    assert.equal(res.forecastExpected, 3000000);
    assert.equal(res.confidence, "high");
    assert.ok(res.forecastLow <= 3000000);
    assert.ok(res.forecastHigh >= 3000000);
    assert.ok(res.forecastLow >= res.actualProfitMTD, "forecastLow must never be less than actual MTD");
  });

  // 3. Outlier positivo enorme no distorsiona los días restantes
  it("Test: Un día extraordinario ($1.5M vs $100k) no infla desproporcionadamente la proyección futura", () => {
    const series = generateSeries(60, 100000);
    // Insert huge spike on last historical day
    series[series.length - 1].netProfit = 1500000;

    const { winsorizedPoints, outlierCount } = analyzeAndWinsorizeProfitSeries(series);
    assert.ok(outlierCount >= 1, "Debe detectar al menos 1 outlier");
    // Winsorized value must be significantly lower than 1.5M
    assert.ok(winsorizedPoints[winsorizedPoints.length - 1].netProfit < 500000);

    const res = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 10,
      actualProfitMTD: 2400000, // already contains the 1.5M realized
    });

    // The remaining 20 days should still forecast around 100k-125k/day, not 1.5M/day
    assert.ok(
      res.expectedRemainingProfit < 20 * 200000,
      `Expected remaining profit should not be blown up, got: ${res.expectedRemainingProfit}`
    );
  });

  // 4. Outlier negativo (día con devolución/cancelación muy negativa)
  it("Test: Día de cancelación atípica no destruye el forecast de los días restantes", () => {
    const series = generateSeries(60, 100000);
    series[series.length - 1].netProfit = -800000; // heavy refund

    const { winsorizedPoints, outlierCount } = analyzeAndWinsorizeProfitSeries(series);
    assert.ok(outlierCount >= 1);
    assert.ok(winsorizedPoints[winsorizedPoints.length - 1].netProfit > -500000);

    const res = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 10,
      actualProfitMTD: 500000,
    });

    assert.ok(res.expectedRemainingProfit > 0);
    assert.ok(res.forecastExpected >= res.actualProfitMTD);
  });

  // 5. Estacionalidad por Día de Semana (Weekday Baseline)
  it("Test: Días con estacionalidad marcada (viernes altos, domingos bajos) reflejan el calendario restante", () => {
    const series: DailyProfitPoint[] = [];
    const date = new Date(Date.UTC(2026, 4, 1, 12, 0, 0)); // Mayo 2026

    for (let i = 0; i < 70; i++) {
      const d = new Date(date.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const weekday = d.getUTCDay();

      // Viernes (5) = $200k, Domingo (0) = $50k, resto = $100k
      const profit = weekday === 5 ? 200000 : weekday === 0 ? 50000 : 100000;

      series.push({
        date: `${year}-${month}-${day}`,
        weekday,
        netProfit: profit,
        orderCount: 10,
        revenue: profit * 1.5,
      });
    }

    const baselines = calculateWeekdayBaselines(series);
    assert.ok(baselines[5] > 180000, `Viernes baseline esperado > 180k, got ${baselines[5]}`);
    assert.ok(baselines[0] < 70000, `Domingo baseline esperado < 70k, got ${baselines[0]}`);
  });

  // 6. Días en cero no se eliminan del cómputo
  it("Test: Días con ganancia 0 se computan en la distribución y no se filtran artificialmente", () => {
    const series: DailyProfitPoint[] = [
      { date: "2026-06-01", weekday: 1, netProfit: 0, orderCount: 0, revenue: 0 },
      { date: "2026-06-02", weekday: 2, netProfit: 100000, orderCount: 10, revenue: 150000 },
      { date: "2026-06-03", weekday: 3, netProfit: 0, orderCount: 0, revenue: 0 },
      { date: "2026-06-04", weekday: 4, netProfit: 100000, orderCount: 10, revenue: 150000 },
      { date: "2026-06-05", weekday: 5, netProfit: 0, orderCount: 0, revenue: 0 },
      { date: "2026-06-06", weekday: 6, netProfit: 100000, orderCount: 10, revenue: 150000 },
      { date: "2026-06-07", weekday: 0, netProfit: 0, orderCount: 0, revenue: 0 },
    ];

    const median = calculateMedian(series.map((p) => p.netProfit));
    const trimmed = calculateTrimmedMean(series.map((p) => p.netProfit));

    // The median of [0, 0, 0, 0, 100k, 100k, 100k] is 0
    assert.equal(median, 0);
    assert.ok(trimmed < 100000);
  });

  // 7. Tendencia acotada (Clamp [0.80, 1.25])
  it("Test: Crecimiento y desaceleración extrema se acotan dentro del clamp de seguridad", () => {
    // Accelerating series
    const seriesAcc = generateSeries(35, 100000);
    // Last 7 days are 3x
    for (let i = seriesAcc.length - 7; i < seriesAcc.length; i++) {
      seriesAcc[i].netProfit = 300000;
      seriesAcc[i].orderCount = 30;
    }

    const trendAcc = calculateRecentTrend(seriesAcc);
    assert.equal(trendAcc.trendFactor, 1.25, "Trend factor debe estar acotado a 1.25 máximo");

    // Decelerating series
    const seriesDec = generateSeries(35, 100000);
    for (let i = seriesDec.length - 7; i < seriesDec.length; i++) {
      seriesDec[i].netProfit = 10000;
      seriesDec[i].orderCount = 2;
    }

    const trendDec = calculateRecentTrend(seriesDec);
    assert.equal(trendDec.trendFactor, 0.80, "Trend factor debe estar acotado a 0.80 mínimo");
  });

  // 8. Día 1 del mes no extrapola profitDay1 * 30
  it("Test: Día 1 con una venta atípica no distorsiona el pronóstico mensual completo", () => {
    const series = generateSeries(60, 100000); // stable 100k/day historically

    const res = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 1,
      actualProfitMTD: 500000, // Day 1 was 5x normal!
    });

    // Old formula would have projected 500k * 30 = $15.000.000!
    const oldProjection = 500000 * 30;
    assert.equal(oldProjection, 15000000);

    // Robust forecast: 500k actual + (29 days * ~100k) = ~3.400.000
    assert.ok(
      res.forecastExpected < 4500000,
      `Robust forecast should be guided by history (~3.4M), got: ${res.forecastExpected}`
    );
  });

  // 9. Invariante de rango inferior: forecastLow >= actualProfitMTD
  it("Test: forecastLow nunca es menor que la ganancia ya realizada MTD", () => {
    const series = generateSeries(30, 20000);
    const res = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 28,
      actualProfitMTD: 2500000,
    });

    assert.ok(res.forecastLow >= res.actualProfitMTD);
  });

  // 10. Explicación determinística basada en reglas (Fallback sin OpenAI)
  it("Test: Fallback de IA genera explicaciones coherentes sin depender de API key", () => {
    const series = generateSeries(60, 100000);
    const forecast = calculateMonthlyProfitForecast({
      historicalSeries: series,
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 15,
      actualProfitMTD: 1500000,
    });

    const explanation = generateRuleBasedForecastExplanation(forecast);
    assert.ok(explanation.summary.length > 0);
    assert.ok(explanation.mainDriver.length > 0);
    assert.ok(explanation.riskNote.length > 0);
  });

  // 11. BACKTEST OBLIGATORIO: Compara fórmula vieja vs nueva en checkpoints
  it("Test 60-62: Backtest demuestra que el nuevo forecast tiene menor error que la fórmula vieja", () => {
    // Generate 4 months of daily data (June, July, August, September 2026)
    // with weekday seasonality (Weekends 2x weekday) and occasional 1-day spikes
    const fullSeries: DailyProfitPoint[] = [];
    const startDate = new Date(Date.UTC(2026, 4, 1, 12, 0, 0)); // May 1 to Sept 30 (153 days)

    for (let i = 0; i < 153; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const weekday = d.getUTCDay();

      // Normal base
      let netProfit = weekday === 0 || weekday === 6 ? 180000 : 90000;

      // Add a couple of realistic anomalies (e.g. day 1 of August had a promo spike of 400k)
      if (month === "08" && day === "01") netProfit = 400000;
      if (month === "08" && day === "18") netProfit = 10000;

      fullSeries.push({
        date: `${year}-${month}-${day}`,
        weekday,
        netProfit,
        orderCount: 15,
        revenue: netProfit * 1.5,
      });
    }

    // Run backtest for August 2026 (targetMonth = 8)
    const backtestResult = runMonthBacktest(fullSeries, 2026, 8, [5, 10, 15, 20, 25]);

    assert.equal(backtestResult.month, "2026-08");
    assert.equal(backtestResult.checkpoints.length, 5);

    // The robust forecast MAPE should outperform the legacy formula MAPE
    assert.ok(
      backtestResult.robustMape <= backtestResult.legacyMape,
      `Robust MAPE (${backtestResult.robustMape}%) should be <= Legacy MAPE (${backtestResult.legacyMape}%)`
    );
    assert.ok(
      backtestResult.robustMae <= backtestResult.legacyMae,
      `Robust MAE (${backtestResult.robustMae}) should be <= Legacy MAE (${backtestResult.legacyMae})`
    );
  });
});
