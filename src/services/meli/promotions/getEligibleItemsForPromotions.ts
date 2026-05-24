import { meliFetch } from "../client";
import { MELI_PROMOTION_ENDPOINTS } from "./endpoints";
import { AppError } from "@/lib/errors/AppError";

export async function getEligibleItemsForPromotions(tenantId: string, promotionId: string) {
  try {
    const response = await meliFetch({
      tenantId,
      endpoint: MELI_PROMOTION_ENDPOINTS.GET_ELIGIBLE_ITEMS(promotionId),
      method: "GET"
    });
    return response;
  } catch (error: any) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      throw new AppError("VALIDATION_ERROR", "Tu cuenta no tiene habilitada esta promoción desde API o Mercado Libre no permite consultarla.", error.statusCode);
    }
    throw error;
  }
}
