import { meliFetch } from "../client";
import { MELI_PROMOTION_ENDPOINTS } from "./endpoints";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors/AppError";

export async function getAvailablePromotionTypes(tenantId: string) {
  const supabase = createAdminClient();
  const { data: account } = await supabase
    .from("meli_accounts")
    .select("meli_user_id")
    .eq("tenant_id", tenantId)
    .single();

  if (!account?.meli_user_id) {
    throw new AppError("VALIDATION_ERROR", "No se encontró el ID de usuario de Mercado Libre", 400);
  }

  try {
    const response = await meliFetch({
      tenantId,
      endpoint: MELI_PROMOTION_ENDPOINTS.GET_AVAILABLE_PROMOTIONS(account.meli_user_id),
      method: "GET"
    });
    return response;
  } catch (error: any) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      throw new AppError("VALIDATION_ERROR", "Tu cuenta no tiene habilitada esta promoción desde API o Mercado Libre no permite crearla para esta publicación.", error.statusCode);
    }
    throw error;
  }
}
