"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Todos los campos son obligatorios" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerAction(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirm_password") as string;
  const plan = formData.get("plan") as string;
  const promoCode = formData.get("promo_code") as string;

  if (!name || !email || !password || !confirmPassword || !plan) {
    return { error: "Todos los campos obligatorios deben estar completos" };
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden" };
  }

  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres" };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        plan: plan,
        promo_code: promoCode || null,
        payment_status: "pending"
      },
    },
  });

  if (authError || !authData.user) {
    return { error: authError?.message || "Error al crear el usuario" };
  }

  let redirectUrl = null;

  if (plan === 'pro' || plan === 'ultra') {
    try {
      const { createSubscriptionPreference } = await import("@/integrations/mercadopago/client");
      const initPoint = await createSubscriptionPreference(
        authData.user.id, // Pasamos el user ID en lugar del tenant ID (el tenant no existe aun)
        plan as 'pro' | 'ultra', 
        email,
        'user'
      );
      if (initPoint) {
        redirectUrl = initPoint;
      } else {
        return { error: "Mercado Pago no devolvió un link de pago válido." };
      }
    } catch (error: any) {
      console.error("Error creating MP preference during register:", error);
      return { error: `Error Mercado Pago: ${error.message || "Desconocido"}` };
    }
  }

  revalidatePath("/", "layout");
  if (redirectUrl) {
    redirect(redirectUrl);
  } else {
    redirect("/onboarding");
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function retryPaymentAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No estás autenticado" };
  }

  const plan = user.user_metadata?.plan;
  const paymentStatus = user.user_metadata?.payment_status;

  if (paymentStatus === "paid" || plan === "starter") {
    redirect("/onboarding");
  }

  let redirectUrl = null;

  try {
    const { createSubscriptionPreference } = await import("@/integrations/mercadopago/client");
    const initPoint = await createSubscriptionPreference(
      user.id, 
      plan as "pro" | "ultra", 
      user.email || "user@klyvo.com",
      "user"
    );
    if (initPoint) {
      redirectUrl = initPoint;
    } else {
      return { error: "Mercado Pago no devolvió un link de pago válido." };
    }
  } catch (error: any) {
    console.error("Error creating MP preference during retry:", error);
    return { error: `Error Mercado Pago: ${error.message || "Desconocido"}` };
  }

  if (redirectUrl) {
    redirect(redirectUrl);
  } else {
    return { error: "No se pudo generar el enlace de pago." };
  }
}
