"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, RefreshCw, Tag, Ticket, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalPageHeader } from "@/components/operational/page-header";
import { MetricStrip, MetricItem } from "@/components/operational/metric-strip";
import { DataTableShell } from "@/components/operational/data-table-shell";
import { OperationalEmptyState } from "@/components/operational/empty-state";
import {
  createManualCouponAction,
  getCouponsAction,
  getManualPromotionProductsAction,
  searchProductsBySkuAction,
  createManualPromotionAction,
  getPromotionsAction
} from "./actions";

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
  type?: string;
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

  function toggleProduct(id: string) {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedProductIds(newSet);
  }

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

      setPromoTitle(""); setPromoDesc(""); setPromoValue(""); setPromoStarts(""); setPromoEnds("");
      setProducts([]); setSelectedProductIds(new Set()); setSearchSku("");

      const data = await getPromotionsAction();
      setPromotions(data);
    } catch (err: any) {
      setPromoActionError(err.message || "Error al crear la promoción");
    } finally {
      setIsSubmittingPromo(false);
    }
  }

  const activePromosCount = promotions.filter(p => p.status === "active" || p.status === "started").length;
  const totalItemsInPromo = promotions.reduce((acc, p) => acc + (p.promotion_items?.length || 0), 0);
  const activeCouponsCount = coupons.filter(c => c.status === "active").length;

  const metricItems: MetricItem[] = [
    {
      label: "Promociones Activas",
      value: activePromosCount.toString(),
      subtext: "Campañas en curso en Mercado Libre"
    },
    {
      label: "Publicaciones con Descuento",
      value: totalItemsInPromo.toString(),
      subtext: "Ítems con precio rebajado"
    },
    {
      label: "Cupones Vigentes",
      value: activeCouponsCount.toString(),
      subtext: "Descuentos habilitados para compradores"
    }
  ];

  return (
    <div className="flex-1 p-6 md:p-8 space-y-6">
      <OperationalPageHeader
        title="Promociones y Cupones"
        description="Gestión de ofertas comerciales, cofinanciación con Mercado Libre y cupones de descuento."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoadingPromos(true);
                try {
                  const data = await getPromotionsAction();
                  setPromotions(data);
                } catch (e) {} finally {
                  setIsLoadingPromos(false);
                }
              }}
              disabled={isLoadingPromos}
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingPromos ? "animate-spin" : ""}`} />
              Sincronizar con ML
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCouponModalOpen(true)}
              className="h-8 border-[#DCDAD4] bg-[#FFFFFF] text-xs font-semibold text-[#101828] hover:bg-[#F5F3EE]"
            >
              <Ticket className="w-3.5 h-3.5 mr-1.5" />
              Nuevo Cupón
            </Button>
            <Button
              size="sm"
              onClick={() => setIsPromoModalOpen(true)}
              className="h-8 bg-[#102A56] hover:bg-[#102A56]/90 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nueva Promoción
            </Button>
          </div>
        }
      />

      <MetricStrip metrics={metricItems} columns={3} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#FFFFFF] border border-[#DCDAD4] p-1 rounded-lg">
          <TabsTrigger value="promotions" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Promociones y Ofertas ({promotions.length})
          </TabsTrigger>
          <TabsTrigger value="coupons" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Cupones ({coupons.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-semibold data-[state=active]:bg-[#102A56] data-[state=active]:text-white">
            Historial
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROMOCIONES */}
        <TabsContent value="promotions" className="space-y-4 outline-none">
          {isLoadingPromos ? (
            <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-8 text-center text-xs text-[#5F6875]">
              Sincronizando promociones con Mercado Libre...
            </div>
          ) : promotions.length === 0 ? (
            <OperationalEmptyState
              title="No hay promociones activas en este momento."
              description="Crea una promoción manual para aplicar descuentos a tus productos o espera a que Mercado Libre active ofertas cofinanciadas."
              actionLabel="Crear Promoción Manual"
              onAction={() => setIsPromoModalOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {promotions.map(promo => {
                const isActive = promo.status === "active" || promo.status === "started";
                const isPending = promo.status === "pending";

                return (
                  <details key={promo.id} className="border border-[#DCDAD4] rounded-lg bg-[#FFFFFF] overflow-hidden group">
                    <summary className="p-3.5 cursor-pointer hover:bg-[#FCFCFA] flex items-center justify-between list-none">
                      <div className="flex flex-col gap-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-xs text-[#101828]">{promo.title}</h4>
                          <StatusBadge variant={isActive ? "success" : isPending ? "warning" : "neutral"}>
                            {isActive ? "Activa" : isPending ? "Programada" : promo.status}
                          </StatusBadge>
                          {promo.type && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F5F3EE] text-[#101828] border border-[#DCDAD4] uppercase">
                              {promo.type}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#5F6875]">
                          Vigencia: {new Date(promo.starts_at).toLocaleDateString("es-AR")} al {new Date(promo.ends_at).toLocaleDateString("es-AR")} · {promo.promotion_items?.length || 0} publicaciones vinculadas
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[#5F6875] group-open:rotate-180 transition-transform shrink-0" />
                    </summary>

                    <div className="p-3 bg-[#FCFCFA] border-t border-[#DCDAD4]">
                      {promo.promotion_items && promo.promotion_items.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#DCDAD4] text-[10px] uppercase text-[#5F6875] font-semibold">
                                <th className="py-2 px-3">Item ML</th>
                                <th className="py-2 px-3 text-right">Precio Original</th>
                                <th className="py-2 px-3 text-right">Descuento</th>
                                <th className="py-2 px-3 text-right">Costo Asumido (Vendedor / ML)</th>
                                <th className="py-2 px-3 text-right">Precio Oferta</th>
                                <th className="py-2 px-3 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                              {promo.promotion_items.map(item => {
                                const raw = item.raw_response || {};
                                const sellerPct = raw.seller_percentage || 0;
                                const meliPct = raw.meli_percentage || 0;

                                return (
                                  <tr key={item.id} className="hover:bg-[#F5F3EE]/50">
                                    <td className="py-2 px-3 font-mono font-medium text-[#101828]">
                                      #{item.meli_item_id || item.product_id}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-[#5F6875] line-through" style={{ fontVariantNumeric: "tabular-nums" }}>
                                      ${item.current_price?.toLocaleString("es-AR")}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-[#D92D20]" style={{ fontVariantNumeric: "tabular-nums" }}>
                                      -{item.discount_percent}% OFF
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-xs">
                                      {sellerPct > 0 || meliPct > 0 ? (
                                        <span>
                                          <span className="text-[#B42318] font-semibold">{sellerPct}% vendedor</span> / <span className="text-[#198754] font-semibold">{meliPct}% ML</span>
                                        </span>
                                      ) : (
                                        <span className="text-[#5F6875]">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                                      ${item.discount_price?.toLocaleString("es-AR")}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <StatusBadge variant={item.status === "active" || item.status === "started" ? "success" : "neutral"}>
                                        {item.status === "started" || item.status === "active" ? "Participando" : item.status}
                                      </StatusBadge>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-3 text-center text-xs text-[#5F6875]">
                          Oferta general de Mercado Libre aplicable según elegibilidad de catálogo.
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: CUPONES */}
        <TabsContent value="coupons" className="space-y-4 outline-none">
          {isLoadingCoupons ? (
            <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-8 text-center text-xs text-[#5F6875]">
              Cargando cupones de descuento...
            </div>
          ) : coupons.length === 0 ? (
            <OperationalEmptyState
              title="No hay cupones creados"
              description="Configura cupones de monto fijo o porcentaje para fidelizar compradores o impulsar campañas."
              actionLabel="Crear Cupón Manual"
              onAction={() => setIsCouponModalOpen(true)}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#101828]">Cupones de Descuento</h3>
                  <p className="text-xs text-[#5F6875]">Listado de cupones emitidos con límites de uso y audiencias objetivo.</p>
                </div>
                <span className="text-xs font-mono text-[#5F6875]">{coupons.length} cupones</span>
              </div>
              <DataTableShell>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#DCDAD4] bg-[#FCFCFA] text-[11px] font-semibold text-[#5F6875] uppercase tracking-wider">
                        <th className="px-4 py-2.5">Título / Denominación</th>
                        <th className="px-3 py-2.5">Descuento</th>
                        <th className="px-3 py-2.5">Audiencia</th>
                        <th className="px-3 py-2.5 text-right">Mín. Compra</th>
                        <th className="px-3 py-2.5 text-center">Límite Usos</th>
                        <th className="px-3 py-2.5 text-center">Estado</th>
                        <th className="px-4 py-2.5">Vigencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DCDAD4] bg-[#FFFFFF]">
                      {coupons.map(coupon => (
                        <tr key={coupon.id} className="hover:bg-[#F5F3EE]/50 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-[#101828]">
                            {coupon.title}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-[#101828]">
                            {coupon.discount_type === "percent" ? `${coupon.discount_value}% OFF` : `$${coupon.discount_value} OFF`}
                          </td>
                          <td className="px-3 py-2.5 text-[#5F6875] capitalize">
                            {coupon.target_audience === "general" || !coupon.target_audience ? "General" : coupon.target_audience.replace("_", " ")}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[#101828]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {coupon.min_purchase_amount ? `$${coupon.min_purchase_amount.toLocaleString("es-AR")}` : "Sin mínimo"}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[#5F6875]">
                            {coupon.max_uses ? coupon.max_uses : "Ilimitado"}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge variant={coupon.status === "active" ? "success" : "neutral"}>
                              {coupon.status === "active" ? "Activo" : coupon.status}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] font-mono text-[#5F6875]">
                            {new Date(coupon.starts_at).toLocaleDateString("es-AR")} - {new Date(coupon.ends_at).toLocaleDateString("es-AR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTableShell>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: HISTORIAL */}
        <TabsContent value="history" className="outline-none">
          <OperationalEmptyState
            title="Historial de promociones finalizadas"
            description="Aquí se registrarán automáticamente las ofertas concluidas y su resultado de conversión."
          />
        </TabsContent>
      </Tabs>

      {/* CREATE PROMO DIALOG */}
      <Dialog open={isPromoModalOpen} onOpenChange={setIsPromoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-[#DCDAD4] bg-[#FFFFFF]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#101828]">Crear Promoción Manual</DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Aplica descuentos a publicaciones específicas, a un SKU completo o por filtro masivo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePromoSubmit} className="space-y-4 py-1 text-xs">
            {promoActionError && (
              <div className="p-3 bg-[#FEF3F2] text-[#B42318] rounded-md border border-[#FECDCA]">
                {promoActionError}
              </div>
            )}

            <div className="border border-[#DCDAD4] rounded-lg p-3.5 bg-[#FCFCFA] space-y-3">
              <span className="font-semibold text-xs text-[#101828] block">1. Parámetros de la Oferta</span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs font-semibold text-[#101828]">Nombre de la promoción</Label>
                  <Input required value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Ej: Oferta de Invierno SKU Líder" className="h-8 border-[#DCDAD4] text-xs" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Modalidad de Descuento</Label>
                  <select required value={promoType} onChange={e => setPromoType(e.target.value)} className="w-full h-8 rounded-md border border-[#DCDAD4] px-2.5 bg-white text-xs text-[#101828]">
                    <option value="percentage_discount">Porcentaje (%)</option>
                    <option value="fixed_amount_discount">Monto Fijo ($)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Valor del Descuento</Label>
                  <Input type="number" required value={promoValue} onChange={e => setPromoValue(e.target.value ? Number(e.target.value) : "")} placeholder="Ej: 15" min="1" step="0.01" className="h-8 border-[#DCDAD4] text-xs" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Fecha de Inicio</Label>
                  <Input type="datetime-local" required value={promoStarts} onChange={e => setPromoStarts(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-[#101828]">Fecha de Fin</Label>
                  <Input type="datetime-local" required value={promoEnds} onChange={e => setPromoEnds(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                </div>
              </div>
            </div>

            <div className="border border-[#DCDAD4] rounded-lg p-3.5 bg-[#FCFCFA] space-y-3">
              <span className="font-semibold text-xs text-[#101828] block">2. Selección de Publicaciones</span>

              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#101828]">
                  <input type="radio" checked={promoSelectionMode === "sku"} onChange={() => {setPromoSelectionMode("sku"); setProducts([]);}} />
                  Buscar por SKU
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#101828]">
                  <input type="radio" checked={promoSelectionMode === "manual"} onChange={() => {setPromoSelectionMode("manual"); setProducts([]);}} />
                  Selección manual
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#101828]">
                  <input type="radio" checked={promoSelectionMode === "mass"} onChange={() => {setPromoSelectionMode("mass"); setProducts([]);}} />
                  Filtro masivo
                </label>
              </div>

              <div className="flex items-end gap-2 bg-white p-3 rounded-md border border-[#DCDAD4]">
                {promoSelectionMode === "sku" && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] font-semibold text-[#101828]">SKU base (Ej: C144)</Label>
                    <Input placeholder="Ingresa SKU exacto" value={searchSku} onChange={e => setSearchSku(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                  </div>
                )}
                {promoSelectionMode === "manual" && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-[11px] font-semibold text-[#101828]">Buscar publicación</Label>
                    <Input placeholder="Título, SKU o MLA" value={massFilterSearch} onChange={e => setMassFilterSearch(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                  </div>
                )}
                {promoSelectionMode === "mass" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-[#101828]">Estado</Label>
                      <select value={massFilterStatus} onChange={e => setMassFilterStatus(e.target.value)} className="h-8 rounded-md border border-[#DCDAD4] px-2 text-xs">
                        <option value="all">Todos</option>
                        <option value="active">Activas</option>
                        <option value="paused">Pausadas</option>
                      </select>
                    </div>
                    <div className="space-y-1 w-24">
                      <Label className="text-[11px] font-semibold text-[#101828]">Precio Mín</Label>
                      <Input type="number" placeholder="$0" value={massFilterMin} onChange={e => setMassFilterMin(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                    </div>
                    <div className="space-y-1 w-24">
                      <Label className="text-[11px] font-semibold text-[#101828]">Precio Máx</Label>
                      <Input type="number" placeholder="$∞" value={massFilterMax} onChange={e => setMassFilterMax(e.target.value)} className="h-8 border-[#DCDAD4] text-xs" />
                    </div>
                  </>
                )}
                <Button type="button" variant="outline" size="sm" onClick={handleSearchProducts} disabled={isSearchingProducts} className="h-8 border-[#DCDAD4] text-xs">
                  {isSearchingProducts ? "Buscando..." : "Buscar"}
                </Button>
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-[#5F6875]">
                    <span>Encontradas: {products.length} · Seleccionadas: {selectedProductIds.size}</span>
                    <div className="space-x-2">
                      <button type="button" onClick={() => setSelectedProductIds(new Set(products.map(p => p.id)))} className="underline font-semibold text-[#102A56]">Todas</button>
                      <button type="button" onClick={() => setSelectedProductIds(new Set())} className="underline font-semibold text-[#102A56]">Ninguna</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-[#DCDAD4] rounded bg-white divide-y divide-[#DCDAD4]">
                    {products.map(p => (
                      <div key={p.id} className="p-2 flex items-center justify-between text-xs hover:bg-[#F5F3EE] cursor-pointer" onClick={() => toggleProduct(p.id)}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedProductIds.has(p.id)} readOnly className="rounded border-[#DCDAD4] text-[#102A56]" />
                          <div className="truncate max-w-[340px]">
                            <span className="font-semibold text-[#101828] block truncate">{p.title}</span>
                            <span className="text-[10px] font-mono text-[#5F6875]">SKU: {p.sku || "N/D"}</span>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-[#101828]">${p.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t border-[#DCDAD4]">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsPromoModalOpen(false)} disabled={isSubmittingPromo}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingPromo || selectedProductIds.size === 0} className="bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold">
                {isSubmittingPromo ? "Creando..." : `Crear Promoción (${selectedProductIds.size} items)`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE COUPON DIALOG */}
      <Dialog open={isCouponModalOpen} onOpenChange={setIsCouponModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-[#DCDAD4] bg-[#FFFFFF]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#101828]">Crear Cupón de Descuento</DialogTitle>
            <DialogDescription className="text-xs text-[#5F6875]">
              Genera un cupón promocional aplicable a tu catálogo en Mercado Libre.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCouponSubmit} className="space-y-3.5 py-1 text-xs">
            {couponActionError && (
              <div className="p-3 bg-[#FEF3F2] text-[#B42318] rounded-md border border-[#FECDCA]">
                {couponActionError}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#101828]">Título del cupón</Label>
              <Input name="title" type="text" required placeholder="Ej. Especial Clientes Frecuentes" className="h-8 border-[#DCDAD4] text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#101828]">Código (Opcional)</Label>
              <Input name="code" type="text" placeholder="Ej. CLIENTE2026" className="h-8 border-[#DCDAD4] text-xs" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Tipo de Descuento</Label>
                <select name="discountType" required className="w-full h-8 rounded-md border border-[#DCDAD4] px-2.5 bg-white text-xs">
                  <option value="percent">Porcentaje (%)</option>
                  <option value="amount">Monto Fijo ($)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Valor</Label>
                <Input name="discountValue" type="number" required placeholder="Ej. 15" min="1" step="0.01" className="h-8 border-[#DCDAD4] text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Fecha de Inicio</Label>
                <Input name="startsAt" type="datetime-local" required className="h-8 border-[#DCDAD4] text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Fecha de Fin</Label>
                <Input name="endsAt" type="datetime-local" required className="h-8 border-[#DCDAD4] text-xs" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#101828]">Audiencia Objetivo</Label>
              <select name="targetAudience" required className="w-full h-8 rounded-md border border-[#DCDAD4] px-2.5 bg-white text-xs">
                <option value="general">Todo el público (General)</option>
                <option value="new_buyers">Nuevos compradores</option>
                <option value="followers">Seguidores de la tienda</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Compra mínima ($)</Label>
                <Input name="minPurchaseAmount" type="number" placeholder="Ej. 15000" min="0" step="0.01" className="h-8 border-[#DCDAD4] text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#101828]">Límite de usos</Label>
                <Input name="maxUses" type="number" placeholder="Ej. 50" min="1" step="1" className="h-8 border-[#DCDAD4] text-xs" />
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-[#DCDAD4]">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCouponModalOpen(false)} disabled={isSubmittingCoupon}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSubmittingCoupon} className="bg-[#102A56] hover:bg-[#102A56]/90 text-white font-semibold">
                {isSubmittingCoupon ? "Enviando..." : "Crear Cupón ML"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
