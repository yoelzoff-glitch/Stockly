// src/app/dashboard/accounting/page.tsx
import { getMonthlyExpenses, MonthlyExpense } from "./actions";
import { AccountingClient } from "./client-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contabilidad - Klyvo",
  description: "Administra tus gastos fijos, temporales y variables para calcular tu rentabilidad real limpia."
};

export default async function AccountingPage() {
  let initialExpenses: MonthlyExpense[] = [];
  try {
    initialExpenses = await getMonthlyExpenses();
  } catch (e) {
    console.error("Failed to load monthly expenses:", e);
  }

  return (
    <AccountingClient initialExpenses={initialExpenses} />
  );
}
