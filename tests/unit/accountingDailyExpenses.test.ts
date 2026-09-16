import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Accounting Daily Expenses & Budget Split Calculations", () => {
  // Función idéntica a la implementada en client-page.tsx y getFinancialData.ts
  function calculateDailyExpense(
    expense: {
      amount: number;
      is_daily: boolean;
      has_iva?: boolean;
      start_month?: string | null;
      end_month?: string | null;
    },
    monthStr: string,
    currentDay: number,
    isCurrentMonth: boolean
  ) {
    const [year, month] = monthStr.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    let expenseStartDay = 1;
    let expenseEndDay = daysInMonth;

    if (expense.start_month) {
      const sMonth = expense.start_month.substring(0, 7);
      if (sMonth === monthStr) {
        expenseStartDay = parseInt(expense.start_month.substring(8, 10), 10) || 1;
      } else if (sMonth > monthStr) {
        expenseStartDay = daysInMonth + 1;
      }
    }
    if (expense.end_month) {
      const eMonth = expense.end_month.substring(0, 7);
      if (eMonth === monthStr) {
        expenseEndDay = parseInt(expense.end_month.substring(8, 10), 10) || daysInMonth;
      } else if (eMonth < monthStr) {
        expenseEndDay = 0;
      }
    }

    const maxDayToCount = isCurrentMonth
      ? Math.min(currentDay, daysInMonth)
      : daysInMonth;

    const actualStart = Math.max(1, expenseStartDay);
    const actualEnd = Math.min(maxDayToCount, expenseEndDay);
    const elapsedDays = actualEnd >= actualStart ? (actualEnd - actualStart + 1) : 0;

    const subtotal = expense.amount * elapsedDays;
    const totalAmount = expense.has_iva ? subtotal * 1.21 : subtotal;

    return { totalAmount, elapsedDays, daysInMonth };
  }

  it("calcula exactamente 14 días a $40.000 + 21% IVA para el gasto finalizado el día 14", () => {
    const expense = {
      amount: 40000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-01",
      end_month: "2026-09-14"
    };

    // Hoy es 15 de septiembre
    const res = calculateDailyExpense(expense, "2026-09", 15, true);
    assert.equal(res.elapsedDays, 14);
    // 14 * 40.000 = 560.000 * 1.21 = 677.600
    assert.equal(res.totalAmount, 677600);

    // Mañana día 16 sigue quedando fijado en 14 días
    const resTomorrow = calculateDailyExpense(expense, "2026-09", 16, true);
    assert.equal(resTomorrow.elapsedDays, 14);
    assert.equal(resTomorrow.totalAmount, 677600);
  });

  it("calcula exactamente 1 día a $60.000 + 21% IVA en el día 15 para el nuevo gasto que arranca el 15", () => {
    const expense = {
      amount: 60000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-15",
      end_month: null
    };

    // Hoy es 15 de septiembre
    const res = calculateDailyExpense(expense, "2026-09", 15, true);
    assert.equal(res.elapsedDays, 1);
    // 1 * 60.000 = 60.000 * 1.21 = 72.600
    assert.equal(res.totalAmount, 72600);

    // Mañana día 16 sumará 2 días (120.000 * 1.21 = 145.200)
    const resTomorrow = calculateDailyExpense(expense, "2026-09", 16, true);
    assert.equal(resTomorrow.elapsedDays, 2);
    assert.equal(resTomorrow.totalAmount, 145200);
  });

  it("la suma combinada al día 15 es exactamente $750.200 (15 días acumulados)", () => {
    const expenseOld = {
      amount: 40000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-01",
      end_month: "2026-09-14"
    };

    const expenseNew = {
      amount: 60000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-15",
      end_month: null
    };

    const resOld = calculateDailyExpense(expenseOld, "2026-09", 15, true);
    const resNew = calculateDailyExpense(expenseNew, "2026-09", 15, true);

    const totalDays = resOld.elapsedDays + resNew.elapsedDays;
    const totalCost = resOld.totalAmount + resNew.totalAmount;

    assert.equal(totalDays, 15);
    assert.equal(totalCost, 750200);
  });

  it("al finalizar el mes de 30 días, la suma da exactamente 14 días a 40k y 16 días a 60k", () => {
    const expenseOld = {
      amount: 40000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-01",
      end_month: "2026-09-14"
    };

    const expenseNew = {
      amount: 60000,
      is_daily: true,
      has_iva: true,
      start_month: "2026-09-15",
      end_month: null
    };

    const resOld = calculateDailyExpense(expenseOld, "2026-09", 30, false);
    const resNew = calculateDailyExpense(expenseNew, "2026-09", 30, false);

    assert.equal(resOld.elapsedDays, 14);
    assert.equal(resNew.elapsedDays, 16);
    assert.equal(resOld.elapsedDays + resNew.elapsedDays, 30);

    // 14 * 40.000 = 560.000; 16 * 60.000 = 960.000; total base = 1.520.000; + 21% IVA = 1.839.200
    assert.equal(resOld.totalAmount + resNew.totalAmount, 1839200);
  });
});
