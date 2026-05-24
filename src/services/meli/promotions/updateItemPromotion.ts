import { meliFetch } from "../client";
import { MELI_PROMOTION_ENDPOINTS } from "./endpoints";
import { AppError } from "@/lib/errors/AppError";

export async function updateItemPromotion(tenantId: string, promotionId: string, itemId: string, payload: any) {
  try {
    const response = await meliFetch({
      tenantId,
      endpoint: MELI_PROMOTION_ENDPOINTS.UPDATE_ITEM_PROMOTION(promotionId, itemId),
      method: "PUT",
      body: {
        deal_price: payload.deal_price,
        original_price: payload.original_price,
      }
    });
    return response;
  } catch (error: any) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      throw new AppError("VALIDATION_ERROR", "Tu cuenta no tiene habilitada esta promoción desde API o Mercado Libre no permite crearla para esta publicación.", error.statusCode);
    }
    throw error;
  }
}
