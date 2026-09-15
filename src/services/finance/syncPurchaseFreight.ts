import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sincroniza el flete/costos extra de una orden de compra en el módulo de Finanzas/Contabilidad.
 * Crea un gasto "Fijo Temporal" (fixed_one_off) con vigencia únicamente para el mes en curso.
 * Si ya existe uno para el mes, acumula el monto.
 */
export async function accumulateFreightExpense(
  supabase: SupabaseClient<any, any, any>,
  tenantId: string,
  amount: number,
  dateInput?: string | Date
) {
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return;

  const dateObj = dateInput ? new Date(dateInput) : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const monthKey = `${year}-${month}`; // e.g. "2026-09"
  const targetMonthDate = `${monthKey}-01`;

  // Buscar si ya existe un gasto Fijo Temporal de Flete para este mes
  const { data: existingExpenses, error: fetchErr } = await supabase
    .from("monthly_expenses")
    .select("id, amount, target_month")
    .eq("tenant_id", tenantId)
    .eq("type", "fixed_one_off")
    .eq("is_active", true)
    .ilike("name", "flete%");

  if (fetchErr) {
    console.error("Error fetching existing freight expense:", fetchErr.message);
    throw new Error(`Error fetching freight expense: ${fetchErr.message}`);
  }

  // Filtrar el que coincida con el mes en curso
  const matchingExpense = existingExpenses?.find(
    (exp: any) => exp.target_month && exp.target_month.substring(0, 7) === monthKey
  );

  if (matchingExpense) {
    const currentAmount = Number(matchingExpense.amount || 0);
    const newAmount = currentAmount + numAmount;

    const { error: updateErr } = await supabase
      .from("monthly_expenses")
      .update({
        amount: newAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", matchingExpense.id)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      console.error("Error updating freight expense:", updateErr.message);
      throw new Error(`Error updating freight expense: ${updateErr.message}`);
    }
  } else {
    // Crear nuevo gasto Fijo Temporal para el mes corriente
    const { error: insertErr } = await supabase
      .from("monthly_expenses")
      .insert({
        tenant_id: tenantId,
        name: "Flete",
        type: "fixed_one_off",
        amount: numAmount,
        percentage: 0,
        target_month: targetMonthDate,
        is_active: true,
        is_daily: false,
        has_iva: false
      });

    if (insertErr) {
      console.error("Error inserting freight expense:", insertErr.message);
      throw new Error(`Error creating freight expense: ${insertErr.message}`);
    }
  }
}

/**
 * Reinvierte/descuenta el flete cuando se anula una orden de compra.
 */
export async function revertFreightExpense(
  supabase: SupabaseClient<any, any, any>,
  tenantId: string,
  amount: number,
  dateInput?: string | Date
) {
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) return;

  const dateObj = dateInput ? new Date(dateInput) : new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const monthKey = `${year}-${month}`;

  const { data: existingExpenses, error: fetchErr } = await supabase
    .from("monthly_expenses")
    .select("id, amount, target_month")
    .eq("tenant_id", tenantId)
    .eq("type", "fixed_one_off")
    .eq("is_active", true)
    .ilike("name", "flete%");

  if (fetchErr) {
    console.error("Error fetching freight expense to revert:", fetchErr.message);
    return;
  }

  const matchingExpense = existingExpenses?.find(
    (exp: any) => exp.target_month && exp.target_month.substring(0, 7) === monthKey
  );

  if (matchingExpense) {
    const currentAmount = Number(matchingExpense.amount || 0);
    const newAmount = Math.max(0, currentAmount - numAmount);

    const { error: updateErr } = await supabase
      .from("monthly_expenses")
      .update({
        amount: newAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", matchingExpense.id)
      .eq("tenant_id", tenantId);

    if (updateErr) {
      console.error("Error reverting freight expense:", updateErr.message);
    }
  }
}
