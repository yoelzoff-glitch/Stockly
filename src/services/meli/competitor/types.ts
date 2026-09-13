import { AppError } from "@/lib/errors/AppError";

export interface CompetitorSnapshot {
  sourceId: string;
  sourceType: "item" | "catalog";

  title: string | null;
  price: number | null;
  originalPrice: number | null;
  currencyId: string | null;

  permalink: string | null;
  thumbnail: string | null;

  listingTypeId: string | null;

  shipping: {
    freeShipping: boolean | null;
    logisticType: string | null;
  };

  seller: {
    id: number | null;
    nickname: string | null;
    reputationLevel: string | null;
    powerSellerStatus: string | null;
  };

  availableQuantity: number | null;
  soldQuantity: number | null;

  attributes: Array<{
    id?: string;
    name: string;
    value: string | null;
  }>;

  description: string | null;

  catalogProductId: string | null;

  resolution: {
    source: string;
    partial: boolean;
    unavailableFields: string[];
  };
}

export interface ParsedCompetitorUrl {
  originalUrl: string;
  itemId: string | null;
  catalogProductId: string | null;
  hasWid: boolean;
  siteId: string | null;
  probableType: "item" | "catalog";
}

export interface PublicFetchResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export type CompetitorErrorCode =
  | "INVALID_COMPETITOR_URL"
  | "COMPETITOR_NOT_FOUND"
  | "COMPETITOR_SOURCE_FORBIDDEN"
  | "COMPETITOR_SOURCE_RATE_LIMITED"
  | "COMPETITOR_SOURCE_UNAVAILABLE"
  | "COMPETITOR_INSUFFICIENT_DATA";

export class CompetitorAnalysisError extends AppError {
  public readonly competitorCode: CompetitorErrorCode;

  constructor(
    code: CompetitorErrorCode,
    message: string,
    statusCode: number = 400,
    details?: any
  ) {
    super("VALIDATION_ERROR", message, statusCode, details, true);
    this.name = "CompetitorAnalysisError";
    this.competitorCode = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ResolveCompetitorOptions {
  url: string;
  tenantId?: string;
  correlationId?: string;
  clientData?: {
    itemData?: any;
    productData?: any;
    sellerData?: any;
    description?: string;
    resolvedId?: string;
  };
}

export interface CompetitorAnalysisData {
  title: string;
  price: number;
  listingType: string;
  shipping: string;
  estimatedSales: string;
  reputation: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
  };
  pricingStrategy: string;
  actionPlan: string[];
  permalink?: string | null;
  thumbnail?: string | null;
  snapshot?: CompetitorSnapshot;
  partial?: boolean;
}
