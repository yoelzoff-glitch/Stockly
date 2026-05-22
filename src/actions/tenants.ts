"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitOnboardingAction(prevState: any, formData: FormData) {
  const companyName = formData.get("companyName") as string;
  const category = formData.get("category") as string;
  const country = formData.get("country") as string;
  const currency = formData.get("currency") as string;
  const businessSize = formData.get("businessSize") as string;

  if (!companyName || !category || !country || !currency || !businessSize) {
    return { error: "Todos los campos son obligatorios" };
  }

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "No estás autenticado" };
  }

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  // Crear Tenant
  const { data: tenantData, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .insert([
      {
        name: companyName,
        slug: slug,
        plan: "free",
        status: "active",
        currency: currency,
        metadata: {
          category,
          country,
          businessSize,
          onboarded: true,
        }
      },
    ])
    .select()
    .single();

  if (tenantError || !tenantData) {
    console.error("Tenant creation error:", tenantError);
    return { error: "Error al configurar el entorno del negocio" };
  }

  // Update or Create Profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (profile) {
    // Update existing profile with tenant_id
    await supabaseAdmin
      .from("profiles")
      .update({ tenant_id: tenantData.id })
      .eq("id", user.id);
  } else {
    // Create new profile if it doesn't exist (from signup)
    await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: user.id,
          tenant_id: tenantData.id,
          email: user.email,
          role: "owner",
        },
      ]);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
