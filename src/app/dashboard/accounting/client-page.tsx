// src/app/dashboard/accounting/client-page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Calculator, 
  Plus, 
  Edit3, 
  Trash2, 
  PiggyBank, 
  Percent, 
  Calendar, 
  DollarSign, 
  HelpCircle, 
  Power, 
  BadgeInfo, 
  TrendingUp,
  RefreshCw
} from "lucide-react";
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

  // Sync state with props when initialExpenses changes
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

  // Edit Modal state
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"fixed_recurring" | "fixed_one_off" | "percent_variable">("fixed_recurring");
  const [editAmount, setEditAmount] = useState("");
  const [editPercentage, setEditPercentage] = useState("");
  const [editTargetMonth, setEditTargetMonth] = useState("");
  const [editMode, setEditMode] = useState<"history" | "global">("history");

  // Sync Create Modal month when currentMonthStr changes
  useEffect(() => {
    setNewTargetMonth(currentMonthStr);
  }, [currentMonthStr]);

  const handleMonthChange = (newMonth: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("month", newMonth);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Filter expenses valid for the selected month (currentMonthStr)
  const activeExpenses = expenses.filter(e => {
    // If it's globally inactive and does NOT have an end_month (meaning it was globally disabled, not chronologically closed)
    if (!e.is_active && !e.end_month) return false;

    if (e.type === "fixed_one_off") {
      return e.target_month && e.target_month.startsWith(currentMonthStr);
    } else {
      const startMonthStr = e.start_month ? e.start_month.substring(0, 7) : null;
      const endMonthStr = e.end_month ? e.end_month.substring(0, 7) : null;

      // Fallback for start_month: if not present, use creation month
      const fallbackStartMonth = startMonthStr || (e.created_at ? e.created_at.substring(0, 7) : "2000-01");

      const started = currentMonthStr >= fallbackStartMonth;
      const ended = endMonthStr ? currentMonthStr > endMonthStr : false;

      // It is active if it started and has not ended
      return started && !ended;
    }
  });

  const totalFixedRecurring = activeExpenses
    .filter(e => e.type === "fixed_recurring")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPercentVariable = activeExpenses
    .filter(e => e.type === "percent_variable")
    .reduce((sum, e) => sum + Number(e.percentage), 0);

  const totalTemporalThisMonth = activeExpenses
    .filter(e => {
      if (e.type !== "fixed_one_off" || !e.target_month) return false;
      return e.target_month.startsWith(currentMonthStr);
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Actual month calculation logic
  const actualVariableExpenses = (totalPercentVariable * actualRevenue) / 100;
  const cleanPocket = actualOperatingProfit - totalFixedRecurring - totalTemporalThisMonth - actualVariableExpenses;
  const pocketPercentage = actualRevenue > 0 ? (cleanPocket / actualRevenue) * 100 : 0;

  // Handlers
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
        start_month: startMonth
      });

      if (res.success && res.data) {
        setExpenses(prev => [res.data as MonthlyExpense, ...prev]);
        setIsCreateOpen(false);
        // Reset
        setNewName("");
        setNewType("fixed_recurring");
        setNewAmount("");
        setNewPercentage("");
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
    setEditMode("history"); // Default edit mode is preserving history
    
    if (expense.target_month) {
      setEditTargetMonth(expense.target_month.substring(0, 7)); // YYYY-MM
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
        // Chronological update (closes current expense last month, creates new one starting this month)
        res = await updateMonthlyExpenseWithHistory(
          editingExpense.id,
          {
            name: editName.trim(),
            type: editType,
            amount: editType === "percent_variable" ? 0 : parseFloat(editAmount) || 0,
            percentage: editType === "percent_variable" ? parseFloat(editPercentage) || 0 : 0
          },
          currentMonthStr
        );
      } else {
        // Global / Historical update
        res = await updateMonthlyExpense(editingExpense.id, {
          name: editName.trim(),
          type: editType,
          amount: editType === "percent_variable" ? 0 : parseFloat(editAmount) || 0,
          percentage: editType === "percent_variable" ? parseFloat(editPercentage) || 0 : 0,
          target_month: formattedMonth
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
      // For recurring or variable expenses, offer history-preserving finalization vs complete deletion
      const choice = confirm(
        `¿Cómo deseas eliminar el gasto recurrente "${expense.name}"?\n\n` +
        `Aceptar (OK): Finalizar a partir de este mes (${formatTargetMonth(currentMonthStr)}). Se mantendrá en el historial de meses pasados.\n\n` +
        `Cancelar: Eliminar por completo de todo el historial (afecta meses anteriores).`
      );

      setIsProcessing(true);
      try {
        if (choice) {
          // Finalize: set end_month to previous month
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
          // Confirm global deletion
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
      return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Contabilidad</h2>
          <p className="text-sm text-muted-foreground">
            Administra tus costos de estructura mensuales, impuestos locales (IIBB, Monotributo) y presupuestos de marketing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Mes:
            </span>
            <input
              type="month"
              value={currentMonthStr}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-0 outline-none focus:ring-0 cursor-pointer"
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Gasto
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Fijos Recurrentes</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalFixedRecurring.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Estructura fija mensual constante</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impuestos / Variables</CardTitle>
            <Percent className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPercentVariable.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Suma de alícuotas (ej: IIBB 3.0%)</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Temporales (Mes)</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalTemporalThisMonth.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Vencen al finalizar el mes en curso</p>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Simulation Dashboard & Expenses List Layout */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 columns: Expenses List */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Listado de Gastos Registrados</CardTitle>
              <CardDescription>Visualiza, edita o desactiva los gastos cargados en el sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeExpenses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center justify-center space-y-3">
                  <BadgeInfo className="w-8 h-8 text-slate-350" />
                  <p>No tienes ningún gasto activo para este mes. Comienza agregando uno arriba.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b bg-slate-50 font-medium text-slate-600">
                      <tr>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Tipo de Gasto</th>
                        <th className="p-3 text-right">Valor</th>
                        <th className="p-3">Vigencia / Vence</th>
                        <th className="p-3 text-center">Estado</th>
                        <th className="p-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeExpenses.map((expense) => {
                        return (
                          <tr key={expense.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-semibold text-slate-800">{expense.name}</td>
                            <td className="p-3 font-medium text-slate-650">
                              {expense.type === "fixed_recurring" && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Fijo Recurrente</Badge>
                              )}
                              {expense.type === "fixed_one_off" && (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-50">Fijo Temporal</Badge>
                              )}
                              {expense.type === "percent_variable" && (
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">Porcentual Variable</Badge>
                              )}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              {expense.type === "percent_variable" 
                                ? `${expense.percentage}%` 
                                : `$${Number(expense.amount).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              }
                            </td>
                            <td className="p-3 text-muted-foreground capitalize">
                              {expense.type === "fixed_one_off" 
                                ? formatTargetMonth(expense.target_month) 
                                : (
                                  <div className="flex flex-col text-[10px] leading-tight normal-case">
                                    {expense.start_month && (
                                      <span>Desde: {formatTargetMonth(expense.start_month)}</span>
                                    )}
                                    {expense.end_month ? (
                                      <span className="text-amber-600 font-medium">Hasta: {formatTargetMonth(expense.end_month)}</span>
                                    ) : (
                                      <span className="text-slate-400">Siempre activo</span>
                                    )}
                                  </div>
                                )
                              }
                            </td>
                            <td className="p-3 text-center">
                              <Badge 
                                onClick={() => handleToggleActive(expense)}
                                className={`cursor-pointer transition-all ${
                                  expense.is_active 
                                    ? "bg-green-100 text-green-800 hover:bg-green-200" 
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {expense.is_active ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <Button variant="outline" size="sm" className="text-[10px] px-2 py-0.5 h-7" onClick={() => handleOpenEdit(expense)}>
                                <Edit3 className="w-3.5 h-3.5 mr-1 inline" /> Editar
                              </Button>
                              <Button variant="ghost" size="sm" className="text-[10px] px-2 py-0.5 h-7 text-red-650 hover:text-red-800 hover:bg-red-50" onClick={() => handleDelete(expense)} disabled={isProcessing}>
                                <Trash2 className="w-3.5 h-3.5 mr-1 inline" /> Eliminar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 column: Simulation Widget */}
        <div className="space-y-6">
          <Card className="shadow-sm border-indigo-100 bg-gradient-to-br from-white to-slate-50/50">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-1.5 text-indigo-850">
                <Calculator className="w-5 h-5 text-indigo-600" /> Rentabilidad del Mes
              </CardTitle>
              <CardDescription>Resumen de ganancia neta real de bolsillo del mes actual.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Facturación Real</span>
                  <span className="font-semibold text-slate-800">${actualRevenue.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-650 font-medium">
                  <span>Ganancia Operativa</span>
                  <span className="font-bold">${actualOperatingProfit.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <h4 className="font-semibold text-slate-650 text-[11px] uppercase tracking-wider">Deducciones del Mes</h4>
                
                <div className="flex justify-between items-center text-slate-700">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Gastos Fijos</span>
                  <span className="font-medium">-${totalFixedRecurring.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Gastos Temporales</span>
                  <span className="font-medium">-${totalTemporalThisMonth.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Variables ({totalPercentVariable.toFixed(1)}% fact.)</span>
                  <span className="font-medium">-${actualVariableExpenses.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-slate-500 font-medium">Bolsillo Limpio Real</span>
                  <span className={`text-xl font-bold ${cleanPocket >= 0 ? "text-emerald-600" : "text-red-650"}`}>
                    {cleanPocket < 0 ? "-" : ""}${Math.abs(cleanPocket).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Progress bar showing remaining % */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mt-1">
                  <div 
                    className={`${cleanPocket >= 0 ? "bg-emerald-500" : "bg-red-500"} h-full rounded-full transition-all duration-500`} 
                    style={{ width: `${Math.max(0, Math.min(100, pocketPercentage))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Margen de Caja Neto</span>
                  <span className="font-bold text-slate-700">{pocketPercentage.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-[11px] text-indigo-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <BadgeInfo className="w-3.5 h-3.5" /> ¿Cómo se calcula?
                </p>
                <p className="text-indigo-900/80 leading-relaxed">
                  Calculamos la Ganancia Operativa de tus ventas, restamos los gastos fijos/temporales y deducimos los gastos porcentuales (como IIBB) calculados sobre la facturación bruta real del mes actual.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-indigo-600" /> Registrar Nuevo Gasto
            </DialogTitle>
            <DialogDescription>
              Carga un costo mensual permanente, de marketing o impositivo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label>Concepto / Nombre del Gasto</Label>
              <Input
                placeholder="Ej. Alquiler de Depósito, IIBB, Monotributo, Google Ads"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Tipo de Gasto</Label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
                className="w-full h-9 rounded-md border border-slate-200 px-3 bg-white text-xs"
              >
                <option value="fixed_recurring">Fijo Recurrente (Ej. Sueldos, Alquiler)</option>
                <option value="fixed_one_off">Fijo Temporal (Ej. Publicidad del mes, Roturas)</option>
                <option value="percent_variable">Porcentual Variable (Ej. IIBB % facturación)</option>
              </select>
            </div>

            {newType !== "percent_variable" ? (
              <div className="space-y-1">
                <Label>Monto Mensual ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 120000"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Porcentaje sobre Facturación Bruta (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej. 3.0"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  required
                />
              </div>
            )}

            {newType === "fixed_one_off" && (
              <div className="space-y-1">
                <Label>Mes de Aplicación</Label>
                <Input
                  type="month"
                  value={newTargetMonth}
                  onChange={(e) => setNewTargetMonth(e.target.value)}
                  required
                />
                <p className="text-[10px] text-muted-foreground">Este gasto vencerá automáticamente al terminar este mes.</p>
              </div>
            )}

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : "Guardar Gasto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      {editingExpense && (
        <Dialog open={editingExpense !== null} onOpenChange={(open) => !open && setEditingExpense(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-indigo-600" /> Editar Gasto
              </DialogTitle>
              <DialogDescription>
                Modifica los atributos del gasto "{editingExpense.name}".
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>Concepto / Nombre del Gasto</Label>
                <Input
                  placeholder="Ej. Alquiler de Depósito"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Tipo de Gasto</Label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-slate-200 px-3 bg-white text-xs"
                >
                  <option value="fixed_recurring">Fijo Recurrente (Ej. Sueldos, Alquiler)</option>
                  <option value="fixed_one_off">Fijo Temporal (Ej. Publicidad del mes)</option>
                  <option value="percent_variable">Porcentual Variable (Ej. IIBB % facturación)</option>
                </select>
              </div>

              {editType !== "percent_variable" ? (
                <div className="space-y-1">
                  <Label>Monto Mensual ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ej. 120000"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Porcentaje sobre Facturación Bruta (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ej. 3.0"
                    value={editPercentage}
                    onChange={(e) => setEditPercentage(e.target.value)}
                    required
                  />
                </div>
              )}

              {editType === "fixed_one_off" && (
                <div className="space-y-1">
                  <Label>Mes de Aplicación</Label>
                  <Input
                    type="month"
                    value={editTargetMonth}
                    onChange={(e) => setEditTargetMonth(e.target.value)}
                    required
                  />
                </div>
              )}

              {editType !== "fixed_one_off" && (
                <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                  <Label className="font-semibold text-slate-700 block mb-2">Aplicación del Cambio</Label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name="editMode"
                        checked={editMode === "history"}
                        onChange={() => setEditMode("history")}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-slate-800">A partir de este mes ({formatTargetMonth(currentMonthStr)})</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          El valor anterior se conservará en los meses pasados (como el mes anterior).
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name="editMode"
                        checked={editMode === "global"}
                        onChange={() => setEditMode("global")}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold text-slate-800">Actualizar de forma global</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          Modifica este gasto en todo el historial (afectando meses anteriores).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setEditingExpense(null)} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
