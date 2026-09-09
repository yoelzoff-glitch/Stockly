// src/services/inventory/replenishment/types.ts

export type ReplenishmentPriority = "critical" | "high" | "medium" | "ok";
export type ReplenishmentConfidence = "high" | "medium" | "low";

export interface ReplenishmentSnapshot {
  productId: string;
  sku: string | null;
  title: string;
  thumbnailUrl?: string | null;

  fullStock: number;
  internalStock: number | null;

  sales7d: number;
  sales14d: number;
  sales30d: number;
  sales60d: number;

  revenue30d?: number | null;
  unitPrice?: number | null;
  unitCost?: number | null;
  marginPercent?: number | null;

  adsActive?: boolean;
  adsAttributedUnits30d?: number | null;

  accountOrdersLast7d?: number;
  accountOrdersPrev7d?: number;
  accountGrowth7d?: number | null;

  accountOrdersLast30d?: number;
  accountOrdersPrev30d?: number;
  accountGrowth30d?: number | null;

  publicationsCount?: number;
  meliItemIds?: string[];
}

export interface ReplenishmentExplanation {
  priorityExplanation: string;
  trendSummary: string;
  riskSummary: string;
  recommendationExplanation: string;
}

export interface FullReplenishmentRecommendation {
  productId: string;
  sku: string | null;
  title: string;
  thumbnailUrl: string | null;

  fullStock: number;
  internalStock: number | null;

  sales7d: number;
  sales14d: number;
  sales30d: number;
  sales60d: number;

  velocity7: number;
  velocity14: number;
  velocity30: number;

  weightedVelocity: number;
  forecastVelocity: number;

  coverageDays: number | null;

  targetCoverageDays: number;
  safetyDays: number;

  recommendedUnits: number;
  availableToSend: number | null;

  priority: ReplenishmentPriority;
  confidence: ReplenishmentConfidence;

  trendPercent: number | null;
  accountTrendPercent: number | null;

  unitCost: number | null;
  marginPercent: number | null;
  capitalRequired: number | null;

  adsActive: boolean;

  aiExplanation: ReplenishmentExplanation | null;
  calculatedAt: string;
}

export interface ReplenishmentSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  okCount: number;

  totalRecommendedUnits: number;
  totalAvailableToSendUnits: number;

  estimatedCapitalRequired: number;
  productsWithoutCostCount: number;
}
