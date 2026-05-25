"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, ShieldCheck, PauseCircle, PlayCircle, Copy, BarChart2, History, Tag, Zap } from "lucide-react";
import { ProductHistoryTab } from "./product-history-tab";
import { ProductChat } from "./product-chat";
import { 
  preparePriceChangeAction, 
  prepareStockChangeAction, 
  prepareStatusChangeAction,
  confirmCommandCenterAction, 
  cancelCommandCenterAction 
} from "@/actions/product-command-actions";
import { updateProductCost } from "@/app/dashboard/products/actions";
import { Card, CardContent } from "@/components/ui/card";

interface ProductCommandCenterProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductCommandCenter({ product, isOpen, onClose, onSuccess }: ProductCommandCenterProps) {
  const [activeTab, setActiveTab] = useState("general");
  
  // States for actions
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<any | null>(null);
  

  // Price states
  const [newPrice, setNewPrice] = useState<string>(product?.price?.toString() || "");
  
  // Stock states
  const [newStock, setNewStock] = useState<string>(product?.available_quantity?.toString() || "");

  // Cost states
  const [newCost, setNewCost] = useState<string>(product?.cost?.toString() || "");

  useEffect(() => {
    if (product) {
      setNewPrice(product.price?.toString() || "");
      setNewStock(product.available_quantity?.toString() || "");
      setNewCost(product.cost?.toString() || "");
      setPendingAction(null);
    }
  }, [product]);


  const handlePreparePrice = async (priceVal: number) => {
    setIsProcessing(true);
    const res = await preparePriceChangeAction(product.id, product.sku, product.title, priceVal);
    if (res.error) {
      alert(res.error);
    } else {
      setPendingAction(res);
    }
    setIsProcessing(false);
  };

  const handlePrepareStock = async (stockVal: number, op: 'set' | 'add' | 'subtract' = 'set') => {
    setIsProcessing(true);
    const res = await prepareStockChangeAction(product.id, product.sku, product.title, stockVal, op);
    if (res.error) {
      alert(res.error);
    } else {
      setPendingAction(res);
    }
    setIsProcessing(false);
  };

  const handlePrepareStatus = async (status: 'paused' | 'active') => {
    setIsProcessing(true);
    const res = await prepareStatusChangeAction(product.id, product.sku, product.title, status);
    if (res.error) {
      alert(res.error);
    } else {
      setPendingAction(res);
    }
    setIsProcessing(false);
  };

  const handleUpdateCost = async () => {
    setIsProcessing(true);
    try {
      const res = await updateProductCost(product.id, parseFloat(newCost));
      if (res.success) {
        alert("Costo actualizado");
        onSuccess();
      } else {
        alert("Error al actualizar costo");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction?.action_id) return;
    setIsProcessing(true);
    const res = await confirmCommandCenterAction(pendingAction.action_id);
    if (res.success) {
      alert("Acción ejecutada correctamente en Mercado Libre");
      setPendingAction(null);
      onSuccess();
    } else {
      alert(res.error || "Error al confirmar");
    }
    setIsProcessing(false);
  };

  const handleCancelAction = async () => {
    if (!pendingAction?.action_id) return;
    setIsProcessing(true);
    await cancelCommandCenterAction(pendingAction.action_id);
    setPendingAction(null);
    setIsProcessing(false);
  };

  const handleForceSync = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/meli/sync-products", { method: "POST" });
      if (!res.ok) throw new Error("Error sincronizando");
      onSuccess();
    } catch (e: any) {
      alert("Error forzando sincronización: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderSecurityPreview = () => {
    if (!pendingAction) return null;

    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900 mt-4 mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <h4 className="font-medium text-amber-900 dark:text-amber-400">Previsualización de Seguridad</h4>
              <p className="text-sm text-amber-800 dark:text-amber-500 whitespace-pre-wrap">
                {pendingAction.message.replace('**PREVISUALIZACIÓN DE CAMBIOS:**', '').replace('**IMPORTANTE:** Para ejecutar esto, por favor responde únicamente con la palabra: **CONFIRMO**', '')}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleCancelAction} disabled={isProcessing}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleConfirmAction} disabled={isProcessing} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {isProcessing ? "Ejecutando..." : "Confirmar y Ejecutar"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!product) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:w-[600px] sm:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-4 md:p-6 pb-2">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-xl md:text-2xl flex items-center gap-2 flex-wrap">
                Gestión de Producto
                <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="shrink-0">
                  {product.status === 'active' ? 'Activo' : 'Pausado'}
                </Badge>
              </SheetTitle>
              <SheetDescription className="line-clamp-2 mt-1 text-xs md:text-sm">
                {product.title}
              </SheetDescription>
            </div>
            {product.thumbnail_url && (
              <img src={product.thumbnail_url} alt="" className="w-12 h-12 md:w-16 md:h-16 rounded-md object-cover border shrink-0" />
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 md:px-6 border-b overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent h-12 w-max justify-start space-x-2 px-2 md:px-0">
                <TabsTrigger value="general" className="data-[state=active]:bg-muted text-xs md:text-sm">General</TabsTrigger>
                <TabsTrigger value="price" className="data-[state=active]:bg-muted text-xs md:text-sm">Precio</TabsTrigger>
                <TabsTrigger value="stock" className="data-[state=active]:bg-muted text-xs md:text-sm">Stock</TabsTrigger>
                <TabsTrigger value="profit" className="data-[state=active]:bg-muted text-xs md:text-sm">Rentabilidad</TabsTrigger>
                <TabsTrigger value="promotions" className="data-[state=active]:bg-muted text-xs md:text-sm">Promos</TabsTrigger>
                <TabsTrigger value="insights" className="data-[state=active]:bg-muted text-xs md:text-sm">Insights</TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-muted text-xs md:text-sm">Historial</TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-muted text-xs md:text-sm">IA</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
              
              <TabsContent value="general" className="mt-0 space-y-6">
                {renderSecurityPreview()}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">SKU</Label>
                    <p className="font-medium mt-1">{product.sku || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">ML Item ID</Label>
                    <p className="font-medium mt-1">{product.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Última Sincronización</Label>
                    <p className="font-medium mt-1">{new Date(product.last_synced_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Enlace</Label>
                    <div className="mt-1">
                      <a href={product.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm font-medium">
                        Ver publicación <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Acciones Rápidas</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.status === 'active' ? (
                      <Button variant="outline" size="sm" onClick={() => handlePrepareStatus('paused')} disabled={isProcessing || pendingAction !== null}>
                        <PauseCircle className="w-4 h-4 mr-2" /> Pausar
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handlePrepareStatus('active')} disabled={isProcessing || pendingAction !== null}>
                        <PlayCircle className="w-4 h-4 mr-2" /> Reactivar
                      </Button>
                    )}
                      <Button variant="outline" size="sm" onClick={handleForceSync} disabled={isProcessing || pendingAction !== null}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} /> Forzar Sincronización
                      </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Copy className="w-4 h-4 mr-2" /> Duplicar (Próximamente)
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="price" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Precio Actual</Label>
                    <p className="text-2xl font-bold mt-1">${product.price?.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Margen Actual</Label>
                    <p className={`text-2xl font-bold mt-1 ${product.margin_percent <= 10 ? 'text-red-500' : 'text-green-600'}`}>
                      {product.margin_percent !== null ? `${product.margin_percent.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {renderSecurityPreview()}

                <div className="space-y-4">
                  <Label>Actualizar Precio</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreparePrice(product.price * 1.05)} disabled={isProcessing || pendingAction !== null}>
                      <TrendingUp className="w-4 h-4 mr-1 text-green-600" /> +5%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePreparePrice(product.price * 1.10)} disabled={isProcessing || pendingAction !== null}>
                      <TrendingUp className="w-4 h-4 mr-1 text-green-600" /> +10%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePreparePrice(product.price * 0.95)} disabled={isProcessing || pendingAction !== null}>
                      <TrendingDown className="w-4 h-4 mr-1 text-red-600" /> -5%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePreparePrice(product.price * 0.90)} disabled={isProcessing || pendingAction !== null}>
                      <TrendingDown className="w-4 h-4 mr-1 text-red-600" /> -10%
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1 max-w-[200px]">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        className="pl-7" 
                        value={newPrice} 
                        onChange={(e) => setNewPrice(e.target.value)}
                        disabled={isProcessing || pendingAction !== null}
                      />
                    </div>
                    <Button onClick={() => handlePreparePrice(parseFloat(newPrice))} disabled={isProcessing || pendingAction !== null || !newPrice || parseFloat(newPrice) === product.price}>
                      Preparar Cambio
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stock" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Stock Actual</Label>
                    <p className="text-2xl font-bold mt-1">{product.available_quantity}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ventas Históricas</Label>
                    <p className="text-2xl font-bold mt-1">{product.sold_quantity}</p>
                  </div>
                </div>

                {renderSecurityPreview()}

                <div className="space-y-4">
                  <Label>Modificar Stock Rápidamente</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePrepareStock(5, 'add')} disabled={isProcessing || pendingAction !== null}>+5</Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrepareStock(10, 'add')} disabled={isProcessing || pendingAction !== null}>+10</Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrepareStock(20, 'add')} disabled={isProcessing || pendingAction !== null}>+20</Button>
                    <Button variant="outline" size="sm" onClick={() => handlePrepareStock(5, 'subtract')} disabled={isProcessing || pendingAction !== null || product.available_quantity < 5}>-5</Button>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    <div className="flex-1 max-w-[200px]">
                      <Input 
                        type="number" 
                        value={newStock} 
                        onChange={(e) => setNewStock(e.target.value)}
                        disabled={isProcessing || pendingAction !== null}
                      />
                    </div>
                    <Button onClick={() => handlePrepareStock(parseInt(newStock), 'set')} disabled={isProcessing || pendingAction !== null || !newStock || parseInt(newStock) === product.available_quantity}>
                      Preparar Cambio
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="profit" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label>Costo del Producto</Label>
                    {product.profitability_status === 'missing_cost' && (
                      <Badge variant="destructive" className="ml-auto text-xs">Falta costo</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[200px]">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        className="pl-7" 
                        value={newCost} 
                        onChange={(e) => setNewCost(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <Button onClick={handleUpdateCost} disabled={isProcessing || !newCost || parseFloat(newCost) === product.cost}>
                      {isProcessing ? "Guardando..." : "Guardar Costo"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <Label>Impacto Comercial (Rentabilidad Real)</Label>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio de Venta</span>
                        <span className="font-medium">${product.price?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Costo de Producto</span>
                        <span className="text-red-500 font-medium">-${product.cost?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Comisión ML (est.)</span>
                        <span className="text-red-500 font-medium">-${product.estimated_fee?.toLocaleString() || 0}</span>
                      </div>
                      
                      {product.extra_fee_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Costo Cuotas (Campañas)</span>
                          <span className="text-red-500 font-medium">-${product.extra_fee_amount?.toLocaleString() || 0}</span>
                        </div>
                      )}
                      
                      {product.promotion_discount_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Descuentos Promocionales</span>
                          <span className="text-red-500 font-medium">-${product.promotion_discount_amount?.toLocaleString() || 0}</span>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Envío (est.)</span>
                        <span className="text-red-500 font-medium">-${product.estimated_shipping_cost?.toLocaleString() || 0}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center text-base font-bold">
                        <span>Ganancia Neta</span>
                        <span className={product.profit_real_estimated && product.profit_real_estimated > 0 ? "text-green-600" : "text-red-500"}>
                          ${product.profit_real_estimated?.toLocaleString() || product.margin_amount?.toLocaleString() || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">Margen Real</span>
                        <span className={product.profit_real_margin && product.profit_real_margin > 10 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {product.profit_real_margin?.toFixed(1) || product.margin_percent?.toFixed(1) || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
              </TabsContent>

              <TabsContent value="promotions" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2"><Tag className="w-4 h-4" /> Promociones Activas</h4>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-lg text-center border border-dashed">
                    <p className="text-sm text-muted-foreground">No hay promociones activas para este producto.</p>
                  </div>
                  
                  <Separator />

                  <h4 className="font-medium flex items-center gap-2 mt-4"><Zap className="w-4 h-4 text-amber-500" /> Crear Oferta Rápida</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="justify-start" onClick={() => alert('ProntoStockly preparará la oferta al integrarlo al agente.')}>
                      Oferta 5% OFF
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => alert('ProntoStockly preparará la oferta al integrarlo al agente.')}>
                      Oferta 10% OFF
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => alert('ProntoStockly preparará la oferta al integrarlo al agente.')}>
                      Oferta Relámpago (24h)
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => setActiveTab("ai")}>
                      Personalizada (IA)
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="insights" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Market Insights (Interno)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <Label className="text-muted-foreground text-xs">Ventas Históricas</Label>
                      <p className="font-bold text-xl mt-1">{product.sold_quantity}</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <Label className="text-muted-foreground text-xs">Margen Real Actual</Label>
                      <p className={`font-bold text-xl mt-1 ${product.profit_real_margin && product.profit_real_margin > 10 ? 'text-green-600' : 'text-orange-500'}`}>
                        {product.profit_real_margin?.toFixed(1) || product.margin_percent?.toFixed(1) || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    <Label>Alertas y Recomendaciones IA</Label>
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                      {product.available_quantity === 0 ? (
                        <div className="flex gap-2 items-start text-sm text-red-600">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>Producto sin stock. Renueva el inventario para no perder posicionamiento.</p>
                        </div>
                      ) : product.available_quantity <= 5 ? (
                        <div className="flex gap-2 items-start text-sm text-orange-600">
                          <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>Stock crítico ({product.available_quantity} unidades). Reabastecimiento urgente sugerido.</p>
                        </div>
                      ) : null}
                      
                      {product.sold_quantity === 0 ? (
                        <div className="flex gap-2 items-start text-sm text-orange-600">
                          <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>Producto sin ventas históricas. Considera bajar el precio o mejorar las imágenes.</p>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-start text-sm text-emerald-600">
                          <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />
                          <p>Este producto tiene tracción de ventas probada en tu catálogo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-6">
                <ProductHistoryTab productId={product.id} />
              </TabsContent>

              <TabsContent value="ai" className="mt-0 space-y-6">
                <ProductChat 
                  product={product} 
                  onActionPending={(action) => {
                    setPendingAction(action);
                    setActiveTab("general");
                  }} 
                />
              </TabsContent>

            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
