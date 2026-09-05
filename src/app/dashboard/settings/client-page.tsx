"use client";

import { useState, useActionState } from "react";
import { updateAccountAction, updateBusinessAction, updatePreferencesAction, updateOperationalCostsAction } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { User, Building2, Store, Bell, Shield, Calculator, CreditCard, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function SettingsClientPage({ profile, tenant, meliAccount }: { profile: any, tenant: any, meliAccount: any }) {
  const [activeTab, setActiveTab] = useState("business");

  // Actions
  const [accState, accAction, isAccPending] = useActionState(updateAccountAction, null);
  const [busState, busAction, isBusPending] = useActionState(updateBusinessAction, null);
  const [prefState, prefAction, isPrefPending] = useActionState(updatePreferencesAction, null);
  const [opState, opAction, isOpPending] = useActionState(updateOperationalCostsAction, null);

  const domains = [
    { id: "business", label: "Negocio", icon: Building2, desc: "Identificación comercial y moneda" },
    { id: "account", label: "Cuenta", icon: User, desc: "Datos de usuario y perfil" },
    { id: "costs", label: "Costos", icon: Calculator, desc: "Empaque, flex y recargos fijos" },
    { id: "integrations", label: "Integraciones", icon: Store, desc: "Mercado Libre, canales y API" },
    { id: "notifications", label: "Notificaciones", icon: Bell, desc: "Preferencias de alertas operativas" },
    { id: "security", label: "Seguridad", icon: Shield, desc: "Sesión y credenciales" },
    { id: "plan", label: "Plan", icon: CreditCard, desc: "Suscripción y límites de uso" },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Sidebar Navigation */}
      <div className="w-full lg:w-64 rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-2 shrink-0 space-y-1">
        <div className="px-3 py-2 text-[10px] uppercase font-bold text-[#5F6875] tracking-wider border-b border-[#DCDAD4] mb-1">
          Dominios de Configuración
        </div>
        {domains.map(dom => (
          <button
            key={dom.id}
            type="button"
            onClick={() => setActiveTab(dom.id)}
            className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-md text-left transition-colors ${
              activeTab === dom.id
                ? "bg-[#102A56] text-white"
                : "text-[#101828] hover:bg-[#F5F3EE]"
            }`}
          >
            <dom.icon className={`w-4 h-4 mt-0.5 shrink-0 ${activeTab === dom.id ? "text-white" : "text-[#5F6875]"}`} />
            <div>
              <div className={`text-xs font-semibold ${activeTab === dom.id ? "text-white" : "text-[#101828]"}`}>
                {dom.label}
              </div>
              <div className={`text-[10px] ${activeTab === dom.id ? "text-white/80" : "text-[#5F6875]"}`}>
                {dom.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full min-w-0">
        {/* DOMAIN 1: NEGOCIO */}
        {activeTab === "business" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
            <div className="border-b border-[#DCDAD4] pb-4">
              <h3 className="text-base font-semibold text-[#101828]">Configuración del Negocio</h3>
              <p className="text-xs text-[#5F6875] mt-0.5">Administra los parámetros de tu empresa, razón social y moneda operativa.</p>
            </div>

            <form action={busAction} className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-[#101828]">Nombre del Negocio / Empresa</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={tenant?.name || ""}
                  disabled={isBusPending}
                  className="h-9 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-xs font-semibold text-[#101828]">Moneda Base para Cálculos</Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={tenant?.currency || "ARS"}
                  className="flex h-9 w-full rounded-md border border-[#DCDAD4] bg-[#FFFFFF] px-3 py-1 text-xs text-[#101828] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#102A56]"
                  disabled={isBusPending}
                >
                  <option value="ARS">ARS - Peso Argentino</option>
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="COP">COP - Peso Colombiano</option>
                  <option value="USD">USD - Dólar Estadounidense</option>
                </select>
                <p className="text-[11px] text-[#5F6875]">Todas las métricas de rentabilidad, comisiones y costos se consolidarán en esta moneda.</p>
              </div>

              {busState?.error && <p className="text-xs text-[#D92D20] font-mono">{busState.error}</p>}
              {busState?.success && <p className="text-xs text-[#198754] font-mono">{busState.success}</p>}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isBusPending}
                  className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold px-4"
                >
                  {isBusPending ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* DOMAIN 2: CUENTA */}
        {activeTab === "account" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
            <div className="border-b border-[#DCDAD4] pb-4">
              <h3 className="text-base font-semibold text-[#101828]">Perfil de Cuenta y Usuario</h3>
              <p className="text-xs text-[#5F6875] mt-0.5">Información del operador autenticado y rol asignado.</p>
            </div>

            <form action={accAction} className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#101828]">Correo Electrónico</Label>
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="h-9 text-xs border-[#DCDAD4] bg-[#F5F3EE] text-[#5F6875]"
                />
                <p className="text-[11px] text-[#5F6875]">Identificador único de acceso y autenticación.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-[#101828]">Nombre y Apellido</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  defaultValue={profile?.full_name || ""}
                  disabled={isAccPending}
                  className="h-9 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#101828]">Rol Operativo</Label>
                <div>
                  <StatusBadge variant="neutral">
                    {profile?.role ? profile.role.toUpperCase() : "ADMIN"}
                  </StatusBadge>
                </div>
              </div>

              {accState?.error && <p className="text-xs text-[#D92D20] font-mono">{accState.error}</p>}
              {accState?.success && <p className="text-xs text-[#198754] font-mono">{accState.success}</p>}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isAccPending}
                  className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold px-4"
                >
                  {isAccPending ? "Guardando..." : "Guardar Perfil"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* DOMAIN 3: COSTOS */}
        {activeTab === "costs" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCDAD4] pb-4">
                <div>
                  <h3 className="text-base font-semibold text-[#101828]">Costos Operativos Fijos por Orden</h3>
                  <p className="text-xs text-[#5F6875] mt-0.5">
                    Gastos que se deducen a nivel de pedido (empaque, mano de obra, logística Flex).
                  </p>
                </div>
                <Link
                  href="/dashboard/settings/costs"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#102A56] hover:underline"
                >
                  Gestionar Costos Extra por SKU <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <form action={opAction} className="space-y-6">
                <div className="space-y-1.5 max-w-sm">
                  <Label htmlFor="packagingCost" className="text-xs font-semibold text-[#101828]">
                    Costo Fijo de Empaque por Orden ($)
                  </Label>
                  <Input 
                    id="packagingCost" 
                    name="packagingCost" 
                    type="number" 
                    min="0"
                    defaultValue={tenant?.metadata?.packaging_cost || 0} 
                    disabled={isOpPending} 
                    className="h-9 text-xs border-[#DCDAD4] bg-[#FFFFFF]"
                  />
                  <p className="text-[11px] text-[#5F6875]">
                    Costo promedio de caja, film, etiquetas y mano de obra. Se descontará 1 vez por orden despachada.
                  </p>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-[#DCDAD4]">
                  <div>
                    <h4 className="text-xs font-semibold text-[#101828]">Logística Mercado Envíos Flex (Cordones)</h4>
                    <p className="text-[11px] text-[#5F6875] mt-0.5">
                      Define la bonificación que abona Mercado Libre versus lo que cobra tu mensajería en cada cordón.
                    </p>
                  </div>
                  
                  <div className="border border-[#DCDAD4] rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase">
                          <th className="px-4 py-2">Zona / Cordón</th>
                          <th className="px-3 py-2">ML Bonifica ($)</th>
                          <th className="px-3 py-2">Mensajería Cobra ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DCDAD4]">
                        {[1, 2, 3, 4].map((zoneIndex) => (
                          <tr key={zoneIndex} className="hover:bg-[#F5F3EE]/50">
                            <td className="px-4 py-2 font-medium text-[#101828]">
                              {zoneIndex === 1 ? "CABA" : `Cordón ${zoneIndex - 1}`}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                name={`flex_ml_${zoneIndex}`}
                                type="number"
                                placeholder="3200"
                                defaultValue={tenant?.metadata?.flex_zones?.[zoneIndex - 1]?.ml_pays || ""}
                                disabled={isOpPending}
                                className="h-8 text-xs border-[#DCDAD4] bg-[#FFFFFF] max-w-xs"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                name={`flex_moto_${zoneIndex}`}
                                type="number"
                                placeholder="4500"
                                defaultValue={tenant?.metadata?.flex_zones?.[zoneIndex - 1]?.moto_costs || ""}
                                disabled={isOpPending}
                                className="h-8 text-xs border-[#DCDAD4] bg-[#FFFFFF] max-w-xs"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {opState?.error && <p className="text-xs text-[#D92D20] font-mono">{opState.error}</p>}
                {opState?.success && <p className="text-xs text-[#198754] font-mono">{opState.success}</p>}
                
                <Button
                  type="submit"
                  disabled={isOpPending}
                  className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold px-4"
                >
                  {isOpPending ? "Guardando..." : "Guardar Costos Operativos"}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* DOMAIN 4: INTEGRACIONES */}
        {activeTab === "integrations" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-4">
            <div className="border-b border-[#DCDAD4] pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#101828]">Integraciones Conectadas</h3>
                <p className="text-xs text-[#5F6875] mt-0.5">Resumen de conexiones con canales externos.</p>
              </div>
              <Link
                href="/dashboard/integrations"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#102A56] hover:underline"
              >
                Abrir Centro de Integraciones <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#DCDAD4] border border-[#DCDAD4] rounded-lg">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">Mercado Libre</h4>
                  <p className="text-[11px] text-[#5F6875]">
                    {meliAccount?.nickname ? `Conectado como: ${meliAccount.nickname}` : "Sin cuenta vinculada"}
                  </p>
                </div>
                <StatusBadge variant={meliAccount?.status === "connected" ? "success" : "neutral"}>
                  {meliAccount?.status === "connected" ? "Conectado" : "Desconectado"}
                </StatusBadge>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">WhatsApp Cloud API</h4>
                  <p className="text-[11px] text-[#5F6875]">Notificaciones automáticas y servicio a compradores</p>
                </div>
                <StatusBadge variant="neutral">Configurado</StatusBadge>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">Motor LLM / OpenAI</h4>
                  <p className="text-[11px] text-[#5F6875]">Asistencia operativa y clasificación</p>
                </div>
                <StatusBadge variant="neutral">Activo</StatusBadge>
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 5: NOTIFICACIONES */}
        {activeTab === "notifications" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
            <div className="border-b border-[#DCDAD4] pb-4">
              <h3 className="text-base font-semibold text-[#101828]">Preferencias de Notificaciones</h3>
              <p className="text-xs text-[#5F6875] mt-0.5">Controla qué alertas operativas se despachan.</p>
            </div>

            <div className="space-y-3 max-w-xl">
              <div className="flex items-center justify-between p-3.5 border border-[#DCDAD4] rounded-lg">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">Alertas de Stock Crítico</h4>
                  <p className="text-[11px] text-[#5F6875]">Avisar cuando un producto caiga por debajo de su punto de reposición.</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#102A56]" />
              </div>

              <div className="flex items-center justify-between p-3.5 border border-[#DCDAD4] rounded-lg">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">Ventas con Margen Negativo</h4>
                  <p className="text-[11px] text-[#5F6875]">Notificar inmediatamente cuando una venta arroje resultado en pérdida.</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#102A56]" />
              </div>

              <div className="flex items-center justify-between p-3.5 border border-[#DCDAD4] rounded-lg">
                <div>
                  <h4 className="text-xs font-semibold text-[#101828]">Productos sin Costo Asignado</h4>
                  <p className="text-[11px] text-[#5F6875]">Recordatorio semanal de publicaciones vendidas sin costo de reposición.</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#102A56]" />
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 6: SEGURIDAD */}
        {activeTab === "security" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
            <div className="border-b border-[#DCDAD4] pb-4">
              <h3 className="text-base font-semibold text-[#101828]">Seguridad y Sesión</h3>
              <p className="text-xs text-[#5F6875] mt-0.5">Acciones de cuenta y exportación de datos sensibles.</p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div className="p-4 border border-[#DCDAD4] rounded-lg bg-[#FCFCFA] space-y-2">
                <h4 className="text-xs font-semibold text-[#101828]">Exportación Completa de Operaciones</h4>
                <p className="text-xs text-[#5F6875] leading-relaxed">
                  Descarga una copia íntegra de tu catálogo, órdenes de venta, costos y movimientos en formato Excel (.xlsx).
                </p>
                <div className="pt-1">
                  <a href="/api/export" download="klyvo_backup.xlsx">
                    <Button variant="outline" size="sm" className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]">
                      Exportar Datos (.xlsx)
                    </Button>
                  </a>
                </div>
              </div>

              <div className="p-4 border border-[#DCDAD4] rounded-lg bg-[#FCFCFA] space-y-2">
                <h4 className="text-xs font-semibold text-[#101828]">Autenticación de Dos Factores</h4>
                <p className="text-xs text-[#5F6875]">Protege tu cuenta mediante verificación de seguridad adicional.</p>
                <StatusBadge variant="neutral">Próximamente</StatusBadge>
              </div>
            </div>
          </div>
        )}

        {/* DOMAIN 7: PLAN */}
        {activeTab === "plan" && (
          <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-6 space-y-6">
            <div className="border-b border-[#DCDAD4] pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#101828]">Plan y Suscripción</h3>
                <p className="text-xs text-[#5F6875] mt-0.5">Detalles del plan contratado y estado de facturación.</p>
              </div>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#102A56] hover:underline"
              >
                Administrar Facturación <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 border border-[#DCDAD4] rounded-lg bg-[#FCFCFA] max-w-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#5F6875]">Plan actual:</span>
                  <div className="text-sm font-bold text-[#101828] uppercase">{tenant?.plan || "Starter"}</div>
                </div>
                <StatusBadge variant="success">Activo</StatusBadge>
              </div>
              <p className="text-xs text-[#5F6875]">
                Para cambiar de plan, revisar límites de publicaciones o ver facturas pasadas, accede al módulo de facturación.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
