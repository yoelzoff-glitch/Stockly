"use client";

import { useState, useActionState, useEffect } from "react";
import { updateAccountAction, updateBusinessAction, updatePreferencesAction, updateOperationalCostsAction } from "@/actions/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Store, MessageCircle, BrainCircuit, Bell, Shield, CheckCircle2, AlertCircle, Calculator } from "lucide-react";

export default function SettingsClientPage({ profile, tenant, meliAccount }: { profile: any, tenant: any, meliAccount: any }) {
  const [activeTab, setActiveTab] = useState("account");

  // Actions
  const [accState, accAction, isAccPending] = useActionState(updateAccountAction, null);
  const [busState, busAction, isBusPending] = useActionState(updateBusinessAction, null);
  const [prefState, prefAction, isPrefPending] = useActionState(updatePreferencesAction, null);
  const [opState, opAction, isOpPending] = useActionState(updateOperationalCostsAction, null);

  const tabs = [
    { id: "account", label: "Cuenta", icon: User },
    { id: "business", label: "Negocio", icon: Building2 },
    { id: "operational", label: "Costos Operativos", icon: Calculator },
    { id: "meli", label: "Mercado Libre", icon: Store },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "ai", label: "IA", icon: BrainCircuit },
    { id: "notifications", label: "Notificaciones", icon: Bell },
    { id: "security", label: "Seguridad", icon: Shield },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 flex flex-col space-y-1 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        
        {/* Tab: Cuenta */}
        {activeTab === "account" && (
          <Card>
            <CardHeader>
              <CardTitle>Perfil de Usuario</CardTitle>
              <CardDescription>Actualiza tu información personal.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={accAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile?.email || ""} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">Tu email no puede ser modificado por ahora.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nombre Completo</Label>
                  <Input id="fullName" name="fullName" defaultValue={profile?.full_name || ""} disabled={isAccPending} />
                </div>
                {accState?.error && <p className="text-sm text-red-500">{accState.error}</p>}
                {accState?.success && <p className="text-sm text-green-500">{accState.success}</p>}
                <Button type="submit" disabled={isAccPending}>
                  {isAccPending ? "Guardando..." : "Guardar cambios"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tab: Negocio */}
        {activeTab === "business" && (
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Negocio</CardTitle>
              <CardDescription>Administra la información general de tu empresa.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={busAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Negocio</Label>
                  <Input id="name" name="name" defaultValue={tenant?.name || ""} disabled={isBusPending} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Moneda Base</Label>
                  <select 
                    id="currency" 
                    name="currency" 
                    defaultValue={tenant?.currency || "ARS"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                    disabled={isBusPending}
                  >
                    <option value="ARS">ARS - Peso Argentino</option>
                    <option value="MXN">MXN - Peso Mexicano</option>
                    <option value="COP">COP - Peso Colombiano</option>
                    <option value="USD">USD - Dólar</option>
                  </select>
                </div>
                {busState?.error && <p className="text-sm text-red-500">{busState.error}</p>}
                {busState?.success && <p className="text-sm text-green-500">{busState.success}</p>}
                <Button type="submit" disabled={isBusPending}>
                  {isBusPending ? "Guardando..." : "Guardar negocio"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tab: Costos Operativos */}
        {activeTab === "operational" && (
          <Card>
            <CardHeader>
              <CardTitle>Costos Operativos (Fijos por Orden)</CardTitle>
              <CardDescription>
                Define los costos que aplican a cada venta para tener una rentabilidad 100% exacta. 
                Estos costos se restan a nivel de la orden completa, y no del SKU, por lo que son perfectos para calcular el empaque de carritos o logística Flex.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={opAction} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="packagingCost">Costo Fijo de Empaque por Orden ($)</Label>
                  <Input 
                    id="packagingCost" 
                    name="packagingCost" 
                    type="number" 
                    min="0"
                    defaultValue={tenant?.metadata?.packaging_cost || 0} 
                    disabled={isOpPending} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Costo promedio de caja, cinta, etiquetas y mano de obra para armar un paquete. Se descontará 1 vez por orden despachada.
                  </p>
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-1">
                    <Label className="text-base">Logística Flex (4 Cordones)</Label>
                    <p className="text-xs text-muted-foreground">
                      Mercado Libre te paga una bonificación fija según el cordón. Define cuánto te paga ML y cuánto te cobra tu moto en cada zona para que Klyvo deduzca automáticamente la rentabilidad exacta de cada venta Flex.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                    <div>Zona</div>
                    <div>ML te bonifica ($)</div>
                    <div>Tu Moto te cobra ($)</div>
                  </div>

                  {[1, 2, 3, 4].map((zoneIndex) => (
                    <div key={zoneIndex} className="grid grid-cols-3 gap-2 items-center">
                      <div className="font-medium text-sm">
                        {zoneIndex === 1 ? "CABA" : `Cordón ${zoneIndex - 1}`}
                      </div>
                      <div>
                        <Input 
                          name={`flex_ml_${zoneIndex}`} 
                          type="number" 
                          placeholder="Ej. 3200" 
                          defaultValue={tenant?.metadata?.flex_zones?.[zoneIndex - 1]?.ml_pays || ""}
                          disabled={isOpPending}
                        />
                      </div>
                      <div>
                        <Input 
                          name={`flex_moto_${zoneIndex}`} 
                          type="number" 
                          placeholder="Ej. 4500" 
                          defaultValue={tenant?.metadata?.flex_zones?.[zoneIndex - 1]?.moto_costs || ""}
                          disabled={isOpPending}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {opState?.error && <p className="text-sm text-red-500">{opState.error}</p>}
                {opState?.success && <p className="text-sm text-green-500">{opState.success}</p>}
                
                <Button type="submit" disabled={isOpPending}>
                  {isOpPending ? "Guardando..." : "Guardar Costos Operativos"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tab: Mercado Libre */}
        {activeTab === "meli" && (
          <Card>
            <CardHeader>
              <CardTitle>Integración con Mercado Libre</CardTitle>
              <CardDescription>Estado de tu conexión con tu cuenta de vendedor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {meliAccount ? (
                <div className="p-4 border rounded-md bg-muted/20">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-md">
                        <Store className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">Cuenta conectada</h4>
                        <p className="text-xs text-muted-foreground">Nickname: {meliAccount.nickname || "N/A"}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Activa
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Última sincronización: {meliAccount.last_sync_at ? new Date(meliAccount.last_sync_at).toLocaleString('es-AR') : 'Nunca'}</p>
                    <p>ID Vendedor: {meliAccount.seller_id}</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-dashed rounded-md">
                  <Store className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium text-lg mb-2">No has conectado Mercado Libre</h3>
                  <p className="text-sm text-muted-foreground mb-4">Conecta tu cuenta para sincronizar productos y ventas.</p>
                  <Button asChild>
                    <a href="/api/auth/mercadolibre">Conectar ahora</a>
                  </Button>
                </div>
              )}
            </CardContent>
            {meliAccount && (
              <CardFooter className="border-t pt-4 flex justify-end gap-2">
                <Button variant="outline">Sincronizar ahora</Button>
                <Button variant="destructive">Desconectar</Button>
              </CardFooter>
            )}
          </Card>
        )}

        {/* Tab: IA */}
        {activeTab === "ai" && (
          <Card>
            <CardHeader>
              <CardTitle>Preferencias de Inteligencia Artificial</CardTitle>
              <CardDescription>Configura cómo quieres que el Agente IA maneje tu negocio.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={prefAction} className="space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="strategy">Estrategia de Precios</Label>
                  <select 
                    id="strategy" 
                    name="strategy" 
                    defaultValue={tenant?.metadata?.ai_pricing_strategy || "balanced"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm md:text-sm"
                    disabled={isPrefPending}
                  >
                    <option value="conservative">Conservadora (Prioriza margen, menos ventas)</option>
                    <option value="balanced">Equilibrada (Balance margen/volumen)</option>
                    <option value="aggressive">Agresiva (Prioriza volumen, ignora márgenes altos)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minMargin">Margen Neto Mínimo Permitido (%)</Label>
                  <Input 
                    id="minMargin" 
                    name="minMargin" 
                    type="number" 
                    min="0" max="100" 
                    defaultValue={tenant?.metadata?.ai_min_margin_percent || 15} 
                    disabled={isPrefPending} 
                  />
                  <p className="text-xs text-muted-foreground">El agente no sugerirá precios que dejen un margen menor a este.</p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">Sugerencias Automáticas</Label>
                    <p className="text-sm text-muted-foreground">Permite que el IA proponga cambios proactivamente.</p>
                  </div>
                  <div>
                    <input 
                      type="checkbox" 
                      name="autoSuggestions" 
                      id="autoSuggestions" 
                      className="w-5 h-5 accent-primary" 
                      defaultChecked={tenant?.metadata?.auto_suggestions_enabled ?? true}
                    />
                  </div>
                </div>

                {prefState?.error && <p className="text-sm text-red-500">{prefState.error}</p>}
                {prefState?.success && <p className="text-sm text-green-500">{prefState.success}</p>}
                
                <Button type="submit" disabled={isPrefPending}>
                  {isPrefPending ? "Guardando..." : "Guardar preferencias IA"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Tab: Mocked tabs */}
        {(activeTab === "whatsapp" || activeTab === "notifications" || activeTab === "security") && (
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "whatsapp" ? "Integración WhatsApp" : 
                 activeTab === "notifications" ? "Preferencias de Notificaciones" : "Seguridad"}
              </CardTitle>
              <CardDescription>Esta funcionalidad estará disponible muy pronto.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center bg-muted/20 border border-dashed rounded-md">
                <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg mb-2">Próximamente</h3>
                <p className="text-sm text-muted-foreground">Estamos construyendo este módulo para mejorar tu experiencia.</p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
