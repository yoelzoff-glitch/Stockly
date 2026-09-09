// src/services/analytics/forecast/config.ts

export const FORECAST_CONFIG = {
  // Methodology Version
  METHODOLOGY_VERSION: "v1",

  // Historic windows (days)
  TARGET_HISTORICAL_DAYS: 90,
  MEDIUM_CONFIDENCE_DAYS: 30,
  MIN_HISTORICAL_DAYS: 14,

  // Recent trend windows
  RECENT_WINDOW_SHORT_DAYS: 7,
  RECENT_WINDOW_LONG_DAYS: 28,

  // Trend factor bounds (Clamping)
  MIN_TREND_FACTOR: 0.80,
  MAX_TREND_FACTOR: 1.25,

  // Recency weights
  WEIGHT_LAST_14D: 0.50,
  WEIGHT_15_TO_30D: 0.30,
  WEIGHT_31_TO_90D: 0.20,

  // Weekday baseline blend
  BASELINE_MEDIAN_WEIGHT: 0.60,
  BASELINE_TRIMMED_WEIGHT: 0.40,
  TRIM_PERCENTILE: 0.10, // trim top and bottom 10%

  // Outlier detection
  MAD_MULTIPLIER: 2.5, // values exceeding median +- 2.5 * MAD are marked/winsorized

  // Uncertainty interval defaults
  HIGH_CONFIDENCE_DISPERSION: 0.10, // +- 10%
  MEDIUM_CONFIDENCE_DISPERSION: 0.18, // +- 18%
  LOW_CONFIDENCE_DISPERSION: 0.25, // +- 25%
} as const;
