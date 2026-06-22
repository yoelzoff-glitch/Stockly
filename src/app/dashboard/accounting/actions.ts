// src/app/dashboard/accounting/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface MonthlyExpense {
  id: string;
  tenant_id: string;
  name: string;
  type: "fixed_recurring" | "fixed_one_off" | "percent_variable";
  amount: number;
  percentage: number;
  target_month: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Obtiene el tenant_id del usuario autenticado.
 */
async function getTenantId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (error || !profile?.tenant_id) {
    throw new Error("No se pudo obtener el tenant");
  }

  return profile.tenant_id;
}

/**
 * Obtiene todos los gastos del tenant.
 */
export async function getMonthlyExpenses(): Promise<MonthlyExpense[]> {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    const { data: expenses, error } = await supabase
      .from("monthly_expenses")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (expenses || []) as MonthlyExpense[];
  } catch (err: any) {
    console.error("Error fetching expenses:", err.message);
    return [];
  }
}

/**
 * Crea un nuevo gasto mensual.
 */
export async function createMonthlyExpense(expense: {
  name: string;
  type: "fixed_recurring" | "fixed_one_off" | "percent_variable";
  amount?: number;
  percentage?: number;
  target_month?: string | null;
}) {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    const payload = {
      tenant_id: tenantId,
      name: expense.name,
      type: expense.type,
      amount: expense.type === "percent_variable" ? 0 : (expense.amount || 0),
      percentage: expense.type === "percent_variable" ? (expense.percentage || 0) : 0,
      target_month: expense.type === "fixed_one_off" ? expense.target_month : null,
      is_active: true
    };

    const { data, error } = await supabase
      .from("monthly_expenses")
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/finance");
    return { success: true, data };
  } catch (err: any) {
    console.error("Error creating expense:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Actualiza un gasto mensual existente.
 */
export async function updateMonthlyExpense(
  id: string,
  updates: {
    name?: string;
    type?: "fixed_recurring" | "fixed_one_off" | "percent_variable";
    amount?: number;
    percentage?: number;
    target_month?: string | null;
    is_active?: boolean;
  }
) {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.amount !== undefined) payload.amount = updates.amount;
    if (updates.percentage !== undefined) payload.percentage = updates.percentage;
    if (updates.target_month !== undefined) payload.target_month = updates.target_month;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;

    // Ajustes de limpieza por tipo si cambia el tipo
    if (updates.type) {
      if (updates.type === "percent_variable") {
        payload.amount = 0;
        payload.target_month = null;
      } else if (updates.type === "fixed_recurring") {
        payload.percentage = 0;
        payload.target_month = null;
      } else if (updates.type === "fixed_one_off") {
        payload.percentage = 0;
      }
    }

    const { data, error } = await supabase
      .from("monthly_expenses")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/finance");
    return { success: true, data };
  } catch (err: any) {
    console.error("Error updating expense:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Elimina un gasto mensual.
 */
export async function deleteMonthlyExpense(id: string) {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    const { error } = await supabase
      .from("monthly_expenses")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting expense:", err.message);
    return { success: false, error: err.message };
  }
}
