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
  start_month?: string | null;
  end_month?: string | null;
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
  start_month?: string | null;
}) {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    const payload: any = {
      tenant_id: tenantId,
      name: expense.name,
      type: expense.type,
      amount: expense.type === "percent_variable" ? 0 : (expense.amount || 0),
      percentage: expense.type === "percent_variable" ? (expense.percentage || 0) : 0,
      target_month: expense.type === "fixed_one_off" ? expense.target_month : null,
      is_active: true
    };

    if (expense.type !== "fixed_one_off") {
      payload.start_month = expense.start_month || `${new Date().toISOString().substring(0, 7)}-01`;
    }

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
    start_month?: string | null;
    end_month?: string | null;
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
    if (updates.start_month !== undefined) payload.start_month = updates.start_month;
    if (updates.end_month !== undefined) payload.end_month = updates.end_month;
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
        payload.start_month = null;
        payload.end_month = null;
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
 * Actualiza un gasto mensual creando una nueva versión y finalizando la anterior en el mes especificado.
 */
export async function updateMonthlyExpenseWithHistory(
  id: string,
  updates: {
    name?: string;
    type: "fixed_recurring" | "fixed_one_off" | "percent_variable";
    amount?: number;
    percentage?: number;
  },
  effectiveMonth: string // YYYY-MM
) {
  const supabase = await createClient();
  try {
    const tenantId = await getTenantId(supabase);

    // 1. Obtener el gasto original
    const { data: original, error: fetchErr } = await supabase
      .from("monthly_expenses")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !original) {
      throw new Error("No se encontró el gasto original");
    }

    // Calcular el mes anterior para finalizar el gasto original (ej: si effectiveMonth es 2026-07, el anterior es 2026-06)
    const [year, month] = effectiveMonth.split('-').map(Number);
    const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
    const prevMonthStr = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // 2. Finalizar el gasto original en el mes anterior
    const { error: updateErr } = await supabase
      .from("monthly_expenses")
      .update({
        end_month: prevMonthStr,
        is_active: false // Se marca inactivo pero queda en historial
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      throw new Error("Error al finalizar el gasto anterior: " + updateErr.message);
    }

    // 3. Crear el nuevo gasto a partir del mes de vigencia
    const newPayload = {
      tenant_id: tenantId,
      name: updates.name !== undefined ? updates.name : original.name,
      type: original.type,
      amount: original.type === "percent_variable" ? 0 : (updates.amount !== undefined ? updates.amount : original.amount),
      percentage: original.type === "percent_variable" ? (updates.percentage !== undefined ? updates.percentage : original.percentage) : 0,
      target_month: null,
      start_month: `${effectiveMonth}-01`,
      end_month: null,
      is_active: true
    };

    const { data: newExpense, error: insertErr } = await supabase
      .from("monthly_expenses")
      .insert([newPayload])
      .select()
      .single();

    if (insertErr) {
      throw new Error("Error al crear el nuevo gasto: " + insertErr.message);
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/finance");
    return { success: true, data: newExpense };
  } catch (err: any) {
    console.error("Error updating expense with history:", err.message);
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
