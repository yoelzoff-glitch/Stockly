import { meliAdsFetch } from "./client";
import { AdvertiserInfo } from "./types";
import { logger } from "@/lib/errors/logger";
import { AppError } from "@/lib/errors/AppError";

export class AdsAdvertiserError extends AppError {
  public reason: "auth_error" | "advertising_permission_missing" | "product_ads_not_enabled" | "advertiser_not_available";

  constructor(
    reason: "auth_error" | "advertising_permission_missing" | "product_ads_not_enabled" | "advertiser_not_available",
    message: string,
    statusCode: number = 400
  ) {
    const code =
      reason === "auth_error"
        ? "UNAUTHORIZED"
        : reason === "advertising_permission_missing"
        ? "FORBIDDEN"
        : reason === "product_ads_not_enabled"
        ? "NOT_FOUND"
        : "MELI_API_ERROR";

    super(code, message, statusCode);
    this.name = "AdsAdvertiserError";
    this.reason = reason;
  }
}

export async function getProductAdsAdvertiser(tenantId: string): Promise<AdvertiserInfo> {
  const startTime = Date.now();
  logger.info({
    event: "MELI_ADS_ADVERTISER_FETCH_STARTED",
    tenantId,
  });

  try {
    const response = await meliAdsFetch({
      tenantId,
      endpoint: "/advertising/advertisers?product_id=PADS",
      apiVersion: "1",
    });

    const advertisers = response?.advertisers || response?.results || (Array.isArray(response) ? response : []);
    const primary = Array.isArray(advertisers) && advertisers.length > 0 ? advertisers[0] : null;

    if (!primary || !primary.advertiser_id || !primary.site_id) {
      const durationMs = Date.now() - startTime;
      logger.warn({
        event: "MELI_ADS_ADVERTISER_FETCH_FAILED",
        tenantId,
        status: "404",
        durationMs,
        message: "No advertiser or site_id returned by Mercado Libre Advertising API",
      });
      throw new AdsAdvertiserError(
        "product_ads_not_enabled",
        "Esta cuenta de Mercado Libre todavía no tiene Product Ads habilitado",
        404
      );
    }

    const advertiserId = Number(primary.advertiser_id);
    const siteId = String(primary.site_id).toUpperCase();

    const durationMs = Date.now() - startTime;
    logger.info({
      event: "MELI_ADS_ADVERTISER_FETCH_SUCCESS",
      tenantId,
      advertiserId,
      siteId,
      status: "200",
      durationMs,
    });

    return {
      advertiserId,
      siteId,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const statusCode = error?.statusCode || error?.status || 500;

    logger.error({
      event: "MELI_ADS_ADVERTISER_FETCH_FAILED",
      tenantId,
      status: String(statusCode),
      durationMs,
      errorMessage: error?.message,
    });

    if (error instanceof AdsAdvertiserError) {
      throw error;
    }

    if (statusCode === 401) {
      throw new AdsAdvertiserError(
        "auth_error",
        "Error de autenticación con Mercado Libre. Reconectá la cuenta de Mercado Libre.",
        401
      );
    }

    if (statusCode === 403) {
      throw new AdsAdvertiserError(
        "advertising_permission_missing",
        "Mercado Libre no autorizó acceso a Publicidad para esta aplicación.",
        403
      );
    }

    if (statusCode === 404) {
      throw new AdsAdvertiserError(
        "product_ads_not_enabled",
        "Esta cuenta de Mercado Libre todavía no tiene Product Ads habilitado.",
        404
      );
    }

    throw new AdsAdvertiserError(
      "advertiser_not_available",
      `No se pudo obtener el anunciante de Product Ads: ${error?.message || "Error desconocido"}`,
      statusCode
    );
  }
}
