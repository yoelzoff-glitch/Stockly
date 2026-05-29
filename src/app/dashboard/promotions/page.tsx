"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createManualCouponAction, getCouponsAction, getManualPromotionProductsAction, searchProductsBySkuAction, createManualPromotionAction, getPromotionsAction } from "./actions";

type Coupon = {
  id: string;
  title: string;
  discount_type: string;
  discount_value: number;
  min_purchase_amount: number | null;
  max_uses: number | null;
  target_audience: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
};

type Promotion = {
  id: string;
  title: string;
  status: string;
  discount_type: string;
  discount_value: number;
  starts_at: string;
  ends_at: string;
  promotion_items: any[];
};

type Product = {
  id: string;
  meli_item_id: string;
  title: string;
  sku: string;
  price: number;
  status: string;
  thumbnail_url: string;
  permalink: string;
};

export default function PromotionsPage() {
  const [activeTab, setActiveTab] = useState("promotions");
  
  // Coupon modal state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [isSubmittingCoupon, setIsSubmittingCoupon] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(true);
  const [couponActionError, setCouponActionError] = useState<string | null>(null);

  // Promotion modal state
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isSubmittingPromo, setIsSubmittingPromo] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoadingPromos, setIsLoadingPromos] = useState(true);
  const [promoActionError, setPromoActionError] = useState<string | null>(null);
  
  // Promo Form Data
  const [promoSelectionMode, setPromoSelectionMode] = useState<"manual" | "sku" | "mass">("sku");
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [promoType, setPromoType] = useState("percentage_discount");
  const [promoValue, setPromoValue] = useState<number | "">("");
  const [promoStarts, setPromoStarts] = useState("");
  const [promoEnds, setPromoEnds] = useState("");

  // Product Selection State
  const [searchSku, setSearchSku] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Filters for mass mode
  const [massFilterStatus, setMassFilterStatus] = useState("all");
  const [massFilterMin, setMassFilterMin] = useState("");
  const [massFilterMax, setMassFilterMax] = useState("");
  const [massFilterSearch, setMassFilterSearch] = useState("");

  useEffect(() => {
    async function loadData() {
      if (activeTab === "coupons") {
        setIsLoadingCoupons(true);
        try {
          const data = await getCouponsAction();
          setCoupons(data);
        } catch (err) {} finally {
          setIsLoadingCoupons(false);
        }
      } else if (activeTab === "promotions") {
        setIsLoadingPromos(true);
        try {
          const data = await getPromotionsAction();
          setPromotions(data);
        } catch (err) {} finally {
          setIsLoadingPromos(false);
        }
      }
    }
    loadData();
  }, [activeTab]);

  // COUPON SUBMIT
  async function handleCouponSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmittingCoupon(true);
    setCouponActionError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      await createManualCouponAction(formData);
      setIsCouponModalOpen(false);
      form.reset();
      const data = await getCouponsAction();
      setCoupons(data);
    } catch (err: any) {
      setCouponActionError(err.message || "Error al crear el cupón");
    } finally {
      setIsSubmittingCoupon(false);
    }
  }

  // PROMO SEARCH
  async function handleSearchProducts() {
    setIsSearchingProducts(true);
    setPromoActionError(null);
    try {
      let data: Product[] = [];
      if (promoSelectionMode === "sku") {
        if (!searchSku.trim()) {
          setProducts([]);
          return;
        }
        data = await searchProductsBySkuAction(searchSku);
      } else {
        data = await getManualPromotionProductsAction({
          status: massFilterStatus,
          minPrice: massFilterMin,
          maxPrice: massFilterMax,
          search: promoSelectionMode === "manual" ? massFilterSearch : undefined
        });
      }
      setProducts(data);
      // Preseleccionar si es SKU o Mass
      if (promoSelectionMode === "sku" || promoSelectionMode === "mass") {
        setSelectedProductIds(new Set(data.map(p => p.id)));
      } else {
        setSelectedProductIds(new Set());
      }
    } catch (e: any) {
      setPromoActionError("Error buscando publicaciones: " + e.message);
    } finally {
      setIsSearchingProducts(false);
    }
  }

  // PROMO TOGGLE SELECTION
  function toggleProduct(id: string) {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedProductIds(newSet);
  }

  // PROMO SUBMIT
  async function handlePromoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedProductIds.size === 0) {
      setPromoActionError("No seleccionaste publicaciones para promocionar.");
      return;
    }

    setIsSubmittingPromo(true);
    setPromoActionError(null);

    const selectedItems = products.filter(p => selectedProductIds.has(p.id));

    try {
      await createManualPromotionAction({
        title: promoTitle,
        description: promoDesc,
        discountType: promoType,
        discountValue: Number(promoValue),
        startsAt: promoStarts,
        endsAt: promoEnds,
        items: selectedItems.map(p => ({
          id: p.id,
          meli_item_id: p.meli_item_id,
          price: p.price
        }))
      });
      setIsPromoModalOpen(false);
      
      // Reset Form
      setPromoTitle(""); setPromoDesc(""); setPromoValue(""); setPromoStarts(""); setPromoEnds("");
      setProducts([]); setSelectedProductIds(new Set()); setSearchSku("");
      
      // Reload promos
      const data = await getPromotionsAction();
      setPromotions(data);
    } catch (err: any) {
      setPromoActionError(err.message || "Error al crear la promoción");
    } finally {
      setIsSubmittingPromo(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Promociones y Cupones</h1>
          <p className="text-slate-500 mt-2">Gestiona las ofertas, descuentos y cupones de tu tienda.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPromoModalOpen(true)}>
            Nueva Promoción Manual
          </Button>
          <Button onClick={() => alert('Para crear promociones, puedes pedirle a Klyvo en el chat: "Crear una oferta para..."')}>
            Nueva Promoción con IA
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border-slate-200">
          <TabsTrigger value="promotions" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Promociones Activas
          </TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Cupones
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          {isLoadingPromos ? (
            <div className="text-center py-12">
              <p className="text-slate-500 animate-pulse">Cargando promociones...</p>
            </div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-slate-900">No hay promociones activas</h3>
              <p className="mt-2 text-slate-500">Creá una promoción manual o usá el chat de IA para generar una oferta.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {promotions.map(promo => (
                <details key={promo.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden group">
                  <summary className="p-4 cursor-pointer hover:bg-slate-50 flex items-center justify-between list-none">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">{promo.title}</h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          promo.status === 'active' ? 'bg-green-100 text-green-800' : 
                          promo.status === 'creating' ? 'bg-yellow-100 text-yellow-800' :
                          promo.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {promo.status}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : `$${promo.discount_value} OFF`}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(promo.starts_at).toLocaleDateString('es-AR')} al {new Date(promo.ends_at).toLocaleDateString('es-AR')} • {promo.promotion_items?.length || 0} publicaciones
                      </span>
                    </div>
                    <span className="text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <table className="w-full text-sm text-left text-slate-600">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                          <th className="py-2">Publicación</th>
                          <th className="py-2 text-right">Precio Orginal</th>
                          <th className="py-2 text-right">Descuento</th>
                          <th className="py-2 text-right">Precio Final</th>
                          <th className="py-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(promo.promotion_items || []).map(item => (
                          <tr key={item.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 font-medium text-slate-900">{item.product_id.split('-')[0]}...</td>
                            <td className="py-2 text-right">${item.current_price}</td>
                            <td className="py-2 text-right text-red-600">-{item.discount_percent}%</td>
                            <td className="py-2 text-right font-medium">${item.discount_price}</td>
                            <td className="py-2 text-center">
                              <span className={`text-[10px] px-2 py-1 rounded-full ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ... CUPOES TAB CONTENIDO MANTENIDO IGUAL ... */}
        <TabsContent value="coupons" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={() => setIsCouponModalOpen(true)}>
              Crear Cupón Manual
            </Button>
          </div>
          
          {isLoadingCoupons ? (
            <div className="text-center py-12">
              <p className="text-slate-500 animate-pulse">Cargando cupones...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-slate-900">No hay cupones creados</h3>
              <p className="mt-2 text-slate-500">Puedes crear un cupón manual o pedirle a Klyvo: "Generame un cupón de $5000 off para nuevos compradores".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 border-collapse">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Descuento</th>
                    <th className="px-4 py-3">Audiencia</th>
                    <th className="px-4 py-3">Mín. Compra</th>
                    <th className="px-4 py-3">Límite Usos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Vigencia</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(coupon => (
                    <tr key={coupon.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{coupon.title}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {coupon.discount_type === 'percent' ? `${coupon.discount_value}% OFF` : `$${coupon.discount_value} OFF`}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize">{coupon.target_audience === 'general' || !coupon.target_audience ? 'General' : coupon.target_audience.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{coupon.min_purchase_amount ? `$${coupon.min_purchase_amount}` : '-'}</td>
                      <td className="px-4 py-3">{coupon.max_uses ? coupon.max_uses : 'Sin límite'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          coupon.status === 'active' ? 'bg-green-100 text-green-800' : 
                          coupon.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          coupon.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {coupon.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(coupon.starts_at).toLocaleDateString('es-AR')} - {new Date(coupon.ends_at).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-slate-900">Historial vacío</h3>
            <p className="mt-2 text-slate-500">Aquí aparecerán las promociones finalizadas y fallidas.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* ========================================================= */}
      {/* MANUAL PROMOTION DIALOG */}
      {/* ========================================================= */}
      <Dialog open={isPromoModalOpen} onOpenChange={setIsPromoModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Promoción Manual</DialogTitle>
            <DialogDescription>
              Aplica ofertas a publicaciones específicas, a SKU completos, o masivamente a tu catálogo.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePromoSubmit} className="space-y-6 py-2">
            {promoActionError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                {promoActionError}
              </div>
            )}

            {/* PASO 1: DATOS GENERALES */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="font-semibold text-slate-900 mb-4">1. Detalles de la Promoción</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="promoTitle">Título de la promoción</Label>
                  <Input id="promoTitle" required value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ej: Especial Día de la Madre" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="promoType">Tipo de Descuento</Label>
                  <select id="promoType" required value={promoType} onChange={e => setPromoType(e.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="percentage_discount">Porcentaje (%)</option>
                    <option value="fixed_amount_discount">Monto Fijo ($)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promoValue">Valor</Label>
                  <Input id="promoValue" type="number" required value={promoValue} onChange={e => setPromoValue(e.target.value ? Number(e.target.value) : "")} placeholder="Ej: 15" min="1" step="0.01" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promoStarts">Fecha de Inicio</Label>
                  <Input id="promoStarts" type="datetime-local" required value={promoStarts} onChange={e => setPromoStarts(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promoEnds">Fecha de Fin</Label>
                  <Input id="promoEnds" type="datetime-local" required value={promoEnds} onChange={e => setPromoEnds(e.target.value)} />
                </div>
              </div>
            </div>

            {/* PASO 2: SELECCION DE PUBLICACIONES */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <h3 className="font-semibold text-slate-900 mb-4">2. Selección de Publicaciones</h3>
              
              <div className="flex gap-4 mb-4">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={promoSelectionMode === 'sku'} onChange={() => {setPromoSelectionMode('sku'); setProducts([]);}} />
                  Buscar por SKU
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={promoSelectionMode === 'manual'} onChange={() => {setPromoSelectionMode('manual'); setProducts([]);}} />
                  Selección manual
                </Label>
                <Label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={promoSelectionMode === 'mass'} onChange={() => {setPromoSelectionMode('mass'); setProducts([]);}} />
                  Filtros Masivos
                </Label>
              </div>

              {/* BUSCADORES Y FILTROS */}
              <div className="flex items-end gap-2 mb-4 bg-white p-4 rounded-md border border-slate-200">
                {promoSelectionMode === 'sku' && (
                  <div className="flex-1 space-y-2">
                    <Label>SKU a promocionar (Ej: C144)</Label>
                    <Input placeholder="Ingresa SKU base" value={searchSku} onChange={e => setSearchSku(e.target.value)} />
                  </div>
                )}
                {promoSelectionMode === 'manual' && (
                  <div className="flex-1 space-y-2">
                    <Label>Buscar publicación</Label>
                    <Input placeholder="Título, SKU o Meli ID" value={massFilterSearch} onChange={e => setMassFilterSearch(e.target.value)} />
                  </div>
                )}
                {promoSelectionMode === 'mass' && (
                  <>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <select value={massFilterStatus} onChange={e => setMassFilterStatus(e.target.value)} className="flex h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                        <option value="all">Todos</option>
                        <option value="active">Activas</option>
                        <option value="paused">Pausadas</option>
                      </select>
                    </div>
                    <div className="space-y-2 w-24">
                      <Label>Precio Min</Label>
                      <Input type="number" placeholder="$0" value={massFilterMin} onChange={e => setMassFilterMin(e.target.value)} />
                    </div>
                    <div className="space-y-2 w-24">
                      <Label>Precio Max</Label>
                      <Input type="number" placeholder="$∞" value={massFilterMax} onChange={e => setMassFilterMax(e.target.value)} />
                    </div>
                  </>
                )}
                <Button type="button" variant="secondary" onClick={handleSearchProducts} disabled={isSearchingProducts}>
                  {isSearchingProducts ? "Buscando..." : "Buscar"}
                </Button>
              </div>

              {/* TABLA DE RESULTADOS */}
              {products.length > 0 ? (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-600">
                      Se encontraron {products.length} publicaciones. Seleccionadas: {selectedProductIds.size}
                    </span>
                    <div className="space-x-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProductIds(new Set(products.map(p => p.id)))}>Todas</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedProductIds(new Set())}>Ninguna</Button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-md bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="w-10 px-4 py-2"></th>
                          <th className="px-4 py-2">Producto</th>
                          <th className="px-4 py-2 text-right">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggleProduct(p.id)}>
                            <td className="px-4 py-2">
                              <input type="checkbox" checked={selectedProductIds.has(p.id)} readOnly className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            </td>
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-900">{p.title}</div>
                              <div className="text-xs text-slate-500">SKU: {p.sku || 'N/A'} | Estado: {p.status}</div>
                            </td>
                            <td className="px-4 py-2 text-right font-medium">${p.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-white border border-slate-200 rounded-md">
                  <span className="text-slate-500 text-sm">
                    {promoSelectionMode === 'sku' ? "No encontramos publicaciones con ese SKU. Revisá que esté cargado." : "Utiliza el buscador para encontrar publicaciones."}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPromoModalOpen(false)} disabled={isSubmittingPromo}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingPromo || selectedProductIds.size === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmittingPromo ? "Creando..." : `Crear Promoción (${selectedProductIds.size} items)`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* MANUAL COUPON DIALOG (MANTENIDO) */}
      <Dialog open={isCouponModalOpen} onOpenChange={setIsCouponModalOpen}>
        {/* ... (Oculto en este snippet para brevedad, pero mantenido intacto de la iteración anterior) ... */}
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Cupón Manual</DialogTitle>
            <DialogDescription>
              Crea un cupón de descuento válido para todos tus productos de Mercado Libre.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCouponSubmit} className="space-y-4 py-4">
            
            {couponActionError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                {couponActionError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Título del cupón</Label>
              <Input name="title" id="title" type="text" required placeholder="Ej: Especial Día de la Madre" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código del cupón (Opcional)</Label>
              <Input name="code" id="code" type="text" placeholder="Ej: MADRE2026" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Tipo de Descuento</Label>
                <select name="discountType" id="discountType" required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="percent">Porcentaje (%)</option>
                  <option value="amount">Monto Fijo ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Valor</Label>
                <Input name="discountValue" id="discountValue" type="number" required placeholder="Ej: 15" min="1" step="0.01" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Fecha de Inicio</Label>
                <Input name="startsAt" id="startsAt" type="datetime-local" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Fecha de Fin</Label>
                <Input name="endsAt" id="endsAt" type="datetime-local" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAudience">Audiencia Objetivo</Label>
              <select name="targetAudience" id="targetAudience" required className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="general">Todo el público (General)</option>
                <option value="new_buyers">Nuevos compradores</option>
                <option value="followers">Seguidores de la tienda</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minPurchaseAmount">Compra mínima (Opcional)</Label>
                <Input name="minPurchaseAmount" id="minPurchaseAmount" type="number" placeholder="Ej: 10000" min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Límite de usos (Opcional)</Label>
                <Input name="maxUses" id="maxUses" type="number" placeholder="Ej: 50" min="1" step="1" />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCouponModalOpen(false)} disabled={isSubmittingCoupon}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingCoupon} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmittingCoupon ? "Enviando..." : "Crear Cupón ML"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
