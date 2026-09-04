// src/app/dashboard/accounting/client-page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, Download, Calendar, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { OperationalPanel } from "@/components/operational/panel";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import {
  createMonthlyExpense,
  updateMonthlyExpense,
  deleteMonthlyExpense,
  updateMonthlyExpenseWithHistory,
  MonthlyExpense
} from "./actions";

export function AccountingClient({
  initialExpenses,
  actualRevenue,
  actualOperatingProfit,
  currentMonthStr
}: {
  initialExpenses: MonthlyExpense[];
  actualRevenue: number;
  actualOperatingProfit: number;
  currentMonthStr: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [expenses, setExpenses] = useState<MonthlyExpense[]>(initialExpenses);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"fixed_recurring" | "fixed_one_off" | "percent_variable">("fixed_recurring");
  const [newAmount, setNewAmount] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newTargetMonth, setNewTargetMonth] = useState(currentMonthStr);
  const [newIsDaily, setNewIsDaily] = useState(false);
  const [newHasIva, setNewHasIva] = useState(false);

  // Edit Modal state
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"fixed_recurring" | "fixed_one_off" | "percent_variable">("fixed_recurring");
  const [editAmount, setEditAmount] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [editIsDaily, setEditIsDaily] = useState(false);
  const [editHasIva, setEditHasIva] = useState(false);
  const [editMode, setEditMode] = useState<"history" | "global">("history");

  useEffect(() => {
    setNewTargetMonth(currentMonthStr);
  }, [currentMonthStr]);

  const handleMonthChange = (newMonth: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", newMonth);
    router.push(`${pathname}?${params.toString()}`);
  };

  const getExpenseCalculatedInfo = (expense: MonthlyExpense, monthStr: string) => {
    if (expense.type === "percent_variable") {
      return { totalAmount: 0, elapsedDays: 0, daysInMonth: 0, isCurrentMonth: false };
    }
    const baseAmount = Number(expense.amount) || 0;
    if (!expense.is_daily) {
      const finalAmount = expense.has_iva ? baseAmount * 1.21 : baseAmount;
      return { totalAmount: finalAmount, elapsedDays: 0, daysInMonth: 0, isCurrentMonth: false };
    }

    const [year, month] = monthStr.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    const todayMonthStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}`;

    let elapsedDays = daysInMonth;
    let isCurrentMonth = false;

    if (monthStr === todayMonthStr) {
      elapsedDays = Math.min(todayDay, daysInMonth);
      isCurrentMonth = true;
    } else if (monthStr > todayMonthStr) {
      elapsedDays = 0;
    }

    const subtotal = baseAmount * elapsedDays;
    const finalAmount = expense.has_iva ? subtotal * 1.21 : subtotal;
    return { totalAmount: finalAmount, elapsedDays, daysInMonth, isCurrentMonth };
  };

  const activeExpenses = expenses.filter(e => {
    if (!e.is_active && !e.end_month) return false;

    if (e.type === "fixed_one_off") {
      return e.target_month && e.target_month.startsWith(currentMonthStr);
    } else {
      const startMonthStr = e.start_month ? e.start_month.substring(0, 7) : null;
      const endMonthStr = e.end_month ? e.end_month.substring(0, 7) : null;

      const fallbackStartMonth = startMonthStr || (e.created_at ? e.created_at.substring(0, 7) : "2000-01");

      const started = currentMonthStr >= fallbackStartMonth;
      const ended = endMonthStr ? currentMonthStr > endMonthStr : false;

      return started && !ended;
    }
  });

  const totalFixedRecurring = activeExpenses
    .filter(e => e.type === "fixed_recurring")
    .reduce((sum, e) => sum + getExpenseCalculatedInfo(e, currentMonthStr).totalAmount, 0);

  const totalPercentVariable = activeExpenses
    .filter(e => e.type === "percent_variable")
    .reduce((sum, e) => sum + Number(e.percentage), 0);

  const totalTemporalThisMonth = activeExpenses
    .filter(e => {
      if (e.type !== "fixed_one_off" || !e.target_month) return false;
      return e.target_month.startsWith(currentMonthStr);
    })
    .reduce((sum, e) => sum + getExpenseCalculatedInfo(e, currentMonthStr).totalAmount, 0);

  const actualVariableExpenses = (totalPercentVariable * actualRevenue) / 100;
  const cleanPocket = actualOperatingProfit - totalFixedRecurring - totalTemporalThisMonth - actualVariableExpenses;
  const pocketPercentage = actualRevenue > 0 ? (cleanPocket / actualRevenue) * 100 : 0;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const formattedMonth = newType === "fixed_one_off" ? `${newTargetMonth}-01` : null;
      const startMonth = newType !== "fixed_one_off" ? `${currentMonthStr}-01` : null;

      const res = await createMonthlyExpense({
        name: newName.trim(),
        type: newType,
        amount: newType === "percent_variable" ? 0 : parseFloat(newAmount) || 0,
        percentage: newType === "percent_variable" ? parseFloat(newPercentage) || 0 : 0,
        target_month: formattedMonth,
        start_month: startMonth,
        is_daily: newType !== "percent_variable" ? newIsDaily : false,
        has_iva: newType !== "percent_variable" ? newHasIva : false
      });

      if (res.success && res.data) {
        setExpenses(prev => [res.data as MonthlyExpense, ...prev]);
        setIsCreateOpen(false);
        setNewName("");
        setNewType("fixed_recurring");
        setNewAmount("");
        setNewPercentage("");
        setNewIsDaily(false);
        setNewHasIva(false);
        router.refresh();
      } else {
        alert("Error creando gasto: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEdit = (expense: MonthlyExpense) => {
    setEditingExpense(expense);
    setEditName(expense.name);
    setEditType(expense.type);
    setEditAmount((expense.amount || "").toString());
    setEditPercentage((expense.percentage || "").toString());
    setEditIsDaily(!!expense.is_daily);
    setEditHasIva(!!expense.has_iva);
    setEditMode("history");

    if (expense.target_month) {
      setEditTargetMonth(expense.target_month.substring(0, 7));
    } else {
      setEditTargetMonth(currentMonthStr);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editName.trim()) return;
    setIsProcessing(true);

    try {
      const formattedMonth = editType === "fixed_one_off" ? `${editTargetMonth}-01` : null;

      let res;
      if (editType !== "fixed_one_off" && editMode === "history") {
        res = await updateMonthlyExpenseWithHistory(
          editingExpense.id,
          {
            name: editName.trim(),
            type: editType,
            amount: editType === "percent_variable" ? 0 : parseFloat(editAmount) || 0,
            percentage: editType === "percent_variable" ? parseFloat(editPercentage) || 0 : 0,
            is_daily: editType !== "percent_variable" ? editIsDaily : false,
            has_iva: editType !== "percent_variable" ? editHasIva : false
          },
          currentMonthStr
        );
      } else {
        res = await updateMonthlyExpense(editingExpense.id, {
          name: editName.trim(),
          type: editType,
          amount: editType === "percent_variable" ? 0 : parseFloat(editAmount) || 0,
          percentage: editType === "percent_variable" ? parseFloat(editPercentage) || 0 : 0,
          target_month: formattedMonth,
          is_daily: editType !== "percent_variable" ? editIsDaily : false,
          has_iva: editType !== "percent_variable" ? editHasIva : false
        });
      }

      if (res.success) {
        setEditingExpense(null);
        router.refresh();
      } else {
        alert("Error actualizando gasto: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (expense: MonthlyExpense) => {
    setIsProcessing(true);
    try {
      const nextStatus = !expense.is_active;
      const res = await updateMonthlyExpense(expense.id, { is_active: nextStatus });
      if (res.success) {
        router.refresh();
      } else {
        alert("Error cambiando estado: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (expense: MonthlyExpense) => {
    if (expense.type === "fixed_one_off") {
      if (!confirm(`¿Estás seguro de que deseas eliminar el gasto "${expense.name}"?`)) return;
      setIsProcessing(true);
      try {
        const res = await deleteMonthlyExpense(expense.id);
        if (res.success) {
          setExpenses(prev => prev.filter(item => item.id !== expense.id));
          router.refresh();
        } else {
          alert("Error eliminando gasto: " + res.error);
        }
      } catch (err: any) {
        alert("Error: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    } else {
      const choice = confirm(
        `¿Cómo deseas eliminar el gasto recurrente "${expense.name}"?\n\n` +
        `Aceptar (OK): Finalizar a partir de este mes (${formatTargetMonth(currentMonthStr)}). Se mantendrá en el historial de meses pasados.\n\n` +
        `Cancelar: Eliminar por completo de todo el historial (afecta meses anteriores).`
      );

      setIsProcessing(true);
      try {
        if (choice) {
          const [year, month] = currentMonthStr.split('-').map(Number);
          const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
          const prevMonthStr = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}-01`;

          const res = await updateMonthlyExpense(expense.id, {
            end_month: prevMonthStr,
            is_active: false
          });
          if (res.success) {
            router.refresh();
          } else {
            alert("Error al finalizar el gasto: " + res.error);
          }
        } else {
          const doubleCheck = confirm(`¿Estás seguro de que deseas eliminar COMPLETAMENTE el gasto "${expense.name}" y todo su historial? Esta acción no se puede deshacer.`);
          if (!doubleCheck) {
            setIsProcessing(false);
            return;
          }
          const res = await deleteMonthlyExpense(expense.id);
          if (res.success) {
            setExpenses(prev => prev.filter(item => item.id !== expense.id));
            router.refresh();
          } else {
            alert("Error al eliminar gasto: " + res.error);
          }
        }
      } catch (err: any) {
        alert("Error: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const formatTargetMonth = (monthStr: string | null) => {
    if (!monthStr) return "-";
    try {
      const parts = monthStr.split("-");
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      return date.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nombre,Tipo,Valor,Acumulado Mes,Vigencia,Estado\n";
    activeExpenses.forEach(exp => {
      const info = getExpenseCalculatedInfo(exp, currentMonthStr);
      const val = exp.type === "percent_variable" ? `${exp.percentage}%` : exp.amount;
      const calc = exp.type === "percent_variable" ? "-" : info.totalAmount.toFixed(2);
      const vigencia = exp.type === "fixed_one_off" ? formatTargetMonth(exp.target_month) : "Recurrente";
      const estado = exp.is_active ? "Activo" : "Inactivo";
      csvContent += `"${exp.name.replace(/"/g, '""')}",${exp.type},${val},${calc},"${vigencia}",${estado}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `contabilidad_gastos_${currentMonthStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metricItems: MetricItem[] = [
    {
      label: "Gastos Fijos Recurrentes",
      value: `$${totalFixedRecurring.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtext: "Estructura operativa fija"
    },
    {
      label: "Impuestos / Variables",
      value: `${totalPercentVariable.toFixed(1)}%`,
      subtext: "Alícuotas sobre facturación (IIBB)"
    },
    {
      label: "Gastos Temporales",
      value: `$${totalTemporalThisMonth.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtext: "Imputados al mes en curso"
    },
    {
      label: "Ganancia Operativa",
      value: `$${actualOperatingProfit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: "Margen comercial previo"
    },
    {
      label: "Bolsillo Limpio Real",
      value: `${cleanPocket < 0 ? "-" : ""}$${Math.abs(cleanPocket).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
      subtext: `Margen de caja: ${pocketPercentage.toFixed(1)}%`
    }
  ];

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Contabilidad y Estructura de Gastos"
        description="Administración de costos fijos, impuestos provinciales y deducciones de caja del período."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-2.5 py-1 text-xs shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-[#5F6875]" />
              <span className="font-semibold text-[#5F6875]">Período:</span>
              <input
                type="month"
                value={currentMonthStr}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-transparent border-0 p-0 text-xs font-bold text-[#101828] outline-none cursor-pointer"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Agregar Gasto
            </Button>
          </div>
        }
      />

      {/* Top 5 Key Metrics */}
      <MetricStrip metrics={metricItems} columns={5} />

      {/* Main Grid: Dense Administrative Table (2 cols) & Financial Reconciliation (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dense Expenses Table (2 columns) */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#101828]">Registro de Gastos Imputados</h3>
              <p className="text-xs text-[#5F6875]">Gastos aplicados al ejercicio contable de {formatTargetMonth(currentMonthStr)} ({activeExpenses.length} registrados).</p>
            </div>
          </div>
          <DataTableShell
            isEmpty={activeExpenses.length === 0}
            emptyState={
              <OperationalEmptyState
                title="Sin gastos contables registrados"
                description="No hay gastos fijos, temporales ni variables cargados para este período mensual."
                actionLabel="Registrar primer gasto"
                onAction={() => setIsCreateOpen(true)}
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                    <th className="px-4 py-2.5">Concepto</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5 text-right">Valor Registrado</th>
                    <th className="px-3 py-2.5">Vigencia</th>
                    <th className="px-3 py-2.5 text-center">Estado</th>
                    <th className="px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                  {activeExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <OperationalEmptyState
                          title="Sin gastos contables registrados"
                          description="No hay gastos fijos, temporales ni variables cargados para este período mensual."
                          actionLabel="Registrar primer gasto"
                          onAction={() => setIsCreateOpen(true)}
                        />
                      </td>
                    </tr>
                  ) : (
                    activeExpenses.map((expense) => {
                      const info = getExpenseCalculatedInfo(expense, currentMonthStr);
                      return (
                        <tr key={expense.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-[#101828]">
                              {expense.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-[#5F6875]">
                              {expense.is_daily && (
                                <span className="text-[#102A56]">
                                  Diario (${Number(expense.amount).toLocaleString("es-AR")}/día)
                                </span>
                              )}
                              {expense.has_iva && (
                                <span>+21% IVA</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {expense.type === "fixed_recurring" && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F3EE] text-[#101828] border border-[#DCDAD4]">
                                Fijo Recurrente
                              </span>
                            )}
                            {expense.type === "fixed_one_off" && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
                                Fijo Temporal
                              </span>
                            )}
                            {expense.type === "percent_variable" && (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0F9FF] text-[#026AA2] border border-[#B9E6FE]">
                                Porcentual Variable
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {expense.type === "percent_variable" ? (
                              `${expense.percentage}% fact.`
                            ) : (
                              <div>
                                <span>${info.totalAmount.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                {expense.is_daily && (
                                  <div className="text-[10px] font-normal text-[#5F6875]">
                                    {info.isCurrentMonth ? `${info.elapsedDays} d. acumulados` : `${info.elapsedDays} días`}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[#5F6875] text-[11px]">
                            {expense.type === "fixed_one_off" ? (
                              formatTargetMonth(expense.target_month)
                            ) : (
                              <div>
                                {expense.start_month && (
                                  <div>Desde: {formatTargetMonth(expense.start_month)}</div>
                                )}
                                {expense.end_month ? (
                                  <div className="text-[#D92D20]">Hasta: {formatTargetMonth(expense.end_month)}</div>
                                ) : (
                                  <div className="text-[#5F6875]">Indefinido</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(expense)}
                              className="focus:outline-none"
                              title="Haz clic para alternar estado"
                            >
                              <StatusBadge variant={expense.is_active ? "success" : "neutral"}>
                                {expense.is_active ? "Activo" : "Pausado"}
                              </StatusBadge>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(expense)}
                              className="h-7 px-2 text-xs font-medium text-[#101828] hover:bg-[#F5F3EE]"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(expense)}
                              disabled={isProcessing}
                              className="h-7 px-2 text-xs font-medium text-[#D92D20] hover:bg-[#FEF3F2]"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Eliminar
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DataTableShell>
        </div>

        {/* Administrative Financial Reconciliation (1 column) */}
        <div>
          <OperationalPanel
            title="Liquidación Neta del Mes"
            description="Conciliación entre ganancia comercial bruta y resultado neto de caja."
          >
            <div className="space-y-4 text-xs">
              <div className="space-y-2 pb-3 border-b border-[#DCDAD4]">
                <div className="flex justify-between items-center text-[#5F6875]">
                  <span>Facturación Total Bruta</span>
                  <span className="font-mono font-semibold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${actualRevenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#198754]">
                  <span>Ganancia Operativa (ML)</span>
                  <span className="font-mono font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${actualOperatingProfit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pb-3 border-b border-[#DCDAD4]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5F6875] block">
                  Deducciones Imputadas
                </span>
                <div className="flex justify-between items-center text-[#101828]">
                  <span>Gastos Fijos Recurrentes</span>
                  <span className="font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${totalFixedRecurring.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#101828]">
                  <span>Gastos Temporales del Mes</span>
                  <span className="font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${totalTemporalThisMonth.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[#101828]">
                  <span>Variables ({totalPercentVariable.toFixed(1)}% facturación)</span>
                  <span className="font-mono text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    -${actualVariableExpenses.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-[#101828]">Resultado Neto de Caja</span>
                  <span
                    className={`text-xl font-bold font-mono ${
                      cleanPocket >= 0 ? "text-[#198754]" : "text-[#D92D20]"
                    }`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {cleanPocket < 0 ? "-" : ""}${Math.abs(cleanPocket).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="mt-2 flex justify-between items-center text-[11px] text-[#5F6875]">
                  <span>Margen de Caja Limpio:</span>
                  <span className="font-mono font-bold text-[#101828]">{pocketPercentage.toFixed(1)}%</span>
                </div>
              </div>

              <div className="rounded border border-[#DCDAD4] bg-[#FCFCFA] p-3 text-[11px] text-[#5F6875] leading-relaxed">
                El cálculo deduce del resultado operativo de tus ventas los costos estructurales fijos, temporales y las alícuotas impositivas variables declaradas.
              </div>
            </div>
          </OperationalPanel>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md border-[#DCDAD4] bg-[#FFFFFF]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#101828]">
              Registrar Gasto Estructural
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Carga un costo operativo fijo, temporal o alícuota porcentual impositiva.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#101828]">Concepto / Denominación</Label>
              <Input
                placeholder="Ej. Alquiler depósito, Monotributo, IIBB, Marketing"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="h-8 border-[#DCDAD4] text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#101828]">Tipo de Imputación</Label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full h-8 rounded-md border border-[#DCDAD4] px-2.5 bg-[#FFFFFF] text-xs text-[#101828]"
              >
                <option value="fixed_recurring">Fijo Recurrente (Alquiler, sueldos, servicios continuos)</option>
                <option value="fixed_one_off">Fijo Temporal (Gasto único o imputable a un solo mes)</option>
                <option value="percent_variable">Porcentual Variable (Alícuotas IIBB o impuestos sobre facturación)</option>
              </select>
            </div>

            {newType !== "percent_variable" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">
                    {newIsDaily ? "Monto Diario ($)" : "Monto Mensual ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={newIsDaily ? "Ej. 25000" : "Ej. 150000"}
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    required
                    className="h-8 border-[#DCDAD4] text-xs"
                  />
                </div>

                <div className="space-y-2 p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded-md">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-[#101828]">
                    <input
                      type="checkbox"
                      checked={newIsDaily}
                      onChange={(e) => setNewIsDaily(e.target.checked)}
                      className="rounded border-[#DCDAD4] text-[#102A56] focus:ring-[#102A56]"
                    />
                    <span>Gasto con acumulación diaria (se suma proporcionalmente por día transcurrido)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-[#101828]">
                    <input
                      type="checkbox"
                      checked={newHasIva}
                      onChange={(e) => setNewHasIva(e.target.checked)}
                      className="rounded border-[#DCDAD4] text-[#102A56] focus:ring-[#102A56]"
                    />
                    <span>Adicionar 21% de IVA sobre el valor base</span>
                  </label>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Porcentaje sobre Facturación Bruta (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 3.0"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  required
                  className="h-8 border-[#DCDAD4] text-xs"
                />
              </div>
            )}

            {newType === "fixed_one_off" && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Mes Imputado</Label>
                <Input
                  type="month"
                  value={newTargetMonth}
                  onChange={(e) => setNewTargetMonth(e.target.value)}
                  required
                  className="h-8 border-[#DCDAD4] text-xs"
                />
              </div>
            )}

            <DialogFooter className="pt-2 border-t border-[#DCDAD4]">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isProcessing} className="bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold">
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : "Guardar Gasto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {editingExpense && (
        <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
          <DialogContent className="max-w-md border-[#DCDAD4] bg-[#FFFFFF]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-[#101828]">
                Editar Gasto
              </DialogTitle>
              <DialogDescription className="text-xs text-[#5F6875]">
                Modifica los parámetros del gasto seleccionado.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Concepto / Denominación</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="h-8 border-[#DCDAD4] text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Tipo de Imputación</Label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full h-8 rounded-md border border-[#DCDAD4] px-2.5 bg-[#FFFFFF] text-xs text-[#101828]"
                >
                  <option value="fixed_recurring">Fijo Recurrente</option>
                  <option value="fixed_one_off">Fijo Temporal</option>
                  <option value="percent_variable">Porcentual Variable</option>
                </select>
              </div>

              {editType !== "percent_variable" ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-[#101828]">
                      {editIsDaily ? "Monto Diario ($)" : "Monto Mensual ($)"}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      required
                      className="h-8 border-[#DCDAD4] text-xs"
                    />
                  </div>

                  <div className="space-y-2 p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded-md">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#101828]">
                      <input
                        type="checkbox"
                        checked={editIsDaily}
                        onChange={(e) => setEditIsDaily(e.target.checked)}
                        className="rounded border-[#DCDAD4] text-[#102A56] focus:ring-[#102A56]"
                      />
                      <span>Acumulación diaria</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-medium text-[#101828]">
                      <input
                        type="checkbox"
                        checked={editHasIva}
                        onChange={(e) => setEditHasIva(e.target.checked)}
                        className="rounded border-[#DCDAD4] text-[#102A56] focus:ring-[#102A56]"
                      />
                      <span>+21% de IVA</span>
                    </label>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Porcentaje (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    required
                    className="h-8 border-[#DCDAD4] text-xs"
                  />
                </div>
              )}

              {editType === "fixed_one_off" && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Mes Imputado</Label>
                  <Input
                    type="month"
                    value={editTargetMonth}
                    onChange={(e) => setEditTargetMonth(e.target.value)}
                    required
                    className="h-8 border-[#DCDAD4] text-xs"
                  />
                </div>
              )}

              {editType !== "fixed_one_off" && (
                <div className="p-3 bg-[#FCFCFA] border border-[#DCDAD4] rounded-md space-y-2">
                  <span className="text-[11px] font-semibold text-[#101828] block">Alcance del cambio:</span>
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#101828]">
                    <input
                      type="radio"
                      name="editMode"
                      value="history"
                      checked={editMode === "history"}
                      onChange={() => setEditMode("history")}
                      className="mt-0.5"
                    />
                    <span>A partir de este mes ({formatTargetMonth(currentMonthStr)}), preservando historial anterior.</span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-[#101828]">
                    <input
                      type="radio"
                      name="editMode"
                      value="global"
                      checked={editMode === "global"}
                      onChange={() => setEditMode("global")}
                      className="mt-0.5"
                    />
                    <span>Modificar globalmente en todo el historial.</span>
                  </label>
                </div>
              )}

              <DialogFooter className="pt-2 border-t border-[#DCDAD4]">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingExpense(null)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isProcessing} className="bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold">
                  {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : "Actualizar Gasto"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
