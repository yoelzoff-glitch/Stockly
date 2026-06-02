"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function connectWhatsAppNumberAction(prevState: any, formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "No autenticado" };
    }

    // Get tenant ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return { error: "Tenant no encontrado" };
    }

    const rawPhoneNumber = formData.get("phone_number") as string;
    if (!rawPhoneNumber) {
      return { error: "El número de teléfono es obligatorio" };
    }

    // Sanitizar el número de teléfono: solo dígitos
    const sanitizedPhoneNumber = rawPhoneNumber.replace(/\D/g, "");
    if (sanitizedPhoneNumber.length < 8 || sanitizedPhoneNumber.length > 15) {
      return { error: "El número de teléfono debe tener entre 8 y 15 dígitos y contener el código de país (ej. 54...)" };
    }

    // Guardar o actualizar en whatsapp_numbers
    // Primero verificamos si ya existe una vinculación para este tenant para evitar el error de ON CONFLICT sin constraint único
    const { data: existingNumber } = await supabase
      .from("whatsapp_numbers")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();

    let dbError;
    if (existingNumber) {
      const { error } = await supabase
        .from("whatsapp_numbers")
        .update({
          phone_number: sanitizedPhoneNumber,
          provider: "meta",
          status: "connected",
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || "",
          updated_at: new Date().toISOString()
        })
        .eq("tenant_id", profile.tenant_id);
      dbError = error;
    } else {
      const { error } = await supabase
        .from("whatsapp_numbers")
        .insert({
          tenant_id: profile.tenant_id,
          phone_number: sanitizedPhoneNumber,
          provider: "meta",
          status: "connected",
          access_token: process.env.WHATSAPP_ACCESS_TOKEN || "",
          updated_at: new Date().toISOString()
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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: "No autenticado" };
    }

    // Get tenant ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return { error: "Tenant no encontrado" };
    }

    // Eliminar la vinculación
    const { error } = await supabase
      .from("whatsapp_numbers")
      .delete()
      .eq("tenant_id", profile.tenant_id);

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
