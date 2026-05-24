import { meliFetch } from "../client";
import { MELI_PROMOTION_ENDPOINTS } from "./endpoints";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors/AppError";

export async function cancelCoupon(tenantId: string, couponId: string) {
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
      endpoint: MELI_PROMOTION_ENDPOINTS.CANCEL_COUPON(account.meli_user_id, couponId),
      method: "DELETE" // O POST dependiendo de cómo Meli maneja la cancelación
    });
    return response;
  } catch (error: any) {
    if (error.statusCode === 403 || error.statusCode === 404) {
      throw new AppError("VALIDATION_ERROR", "Mercado Libre no permite cancelar este cupón para tu cuenta.", error.statusCode);
    }
    throw error;
  }
}
