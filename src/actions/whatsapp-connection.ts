"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/security/tenantAuth";
import { revalidatePath } from "next/cache";

export async function connectWhatsAppNumberAction(prevState: any, formData: FormData) {
  try {
    const context = await requireTenantContext();
    const adminSupabase = createAdminClient();

    const rawPhoneNumber = formData.get("phone_number") as string;
    if (!rawPhoneNumber) {
      return { error: "El número de teléfono es obligatorio" };
    }

    // Sanitizar el número de teléfono: solo dígitos
    const sanitizedPhoneNumber = rawPhoneNumber.replace(/\D/g, "");
    if (sanitizedPhoneNumber.length < 8 || sanitizedPhoneNumber.length > 15) {
      return { error: "El número de teléfono debe tener entre 8 y 15 dígitos y contener el código de país (ej. 54...)" };
    }

    // Guardar o actualizar en whatsapp_numbers de forma aislada
    const { data: existingNumber } = await adminSupabase
      .from("whatsapp_numbers")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .maybeSingle();

    let dbError;
    if (existingNumber) {
      const { error } = await adminSupabase
        .from("whatsapp_numbers")
        .update({
          phone_number: sanitizedPhoneNumber,
          provider: "meta",
          status: "connected",
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || "",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", context.tenantId);
      dbError = error;
    } else {
      const { error } = await adminSupabase
        .from("whatsapp_numbers")
        .insert({
          tenant_id: context.tenantId,
          phone_number: sanitizedPhoneNumber,
          provider: "meta",
          status: "connected",
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || "",
          updated_at: new Date().toISOString(),
        });
      dbError = error;
    }

    if (dbError) {
      console.error("Error connecting WhatsApp number:", dbError);
      return { error: `Error al guardar en base de datos: ${dbError.message}` };
    }

    revalidatePath("/dashboard/integrations");
    return { success: "WhatsApp vinculado correctamente" };
  } catch (error: any) {
    console.error("Catch error in connectWhatsAppNumberAction:", error);
    return { error: error.message || "Ocurrió un error inesperado" };
  }
}

export async function disconnectWhatsAppNumberAction() {
  try {
    const context = await requireTenantContext();
    const adminSupabase = createAdminClient();

    // Eliminar la vinculación del tenant autenticado
    const { error } = await adminSupabase
      .from("whatsapp_numbers")
      .delete()
      .eq("tenant_id", context.tenantId);

    if (error) {
      console.error("Error disconnecting WhatsApp number:", error);
      return { error: `Error al desvincular: ${error.message}` };
    }

    revalidatePath("/dashboard/integrations");
    return { success: "WhatsApp desvinculado correctamente" };
  } catch (error: any) {
    console.error("Catch error in disconnectWhatsAppNumberAction:", error);
    return { error: error.message || "Ocurrió un error inesperado" };
  }
}
