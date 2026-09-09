"use client";

import React, { useState } from "react";
import { CheckCircle2, TrendingUp, Sparkles, Layers } from "lucide-react";

interface LineItem {
  label: string;
  amount: string;
  type: "positive" | "negative";
  detail: string;
  badge?: string;
}

const scenarioData: Record<
  "standard" | "promo",
  {
    title: string;
    badge: string;
    salePrice: string;
    items: LineItem[];
    netProfit: string;
    netMargin: string;
    roi: string;
  }
> = {
  standard: {
    title: "Venta Clásica con Envío",
    badge: "Orden #2000008491",
    salePrice: "$ 34.500,00",
    items: [
      { label: "Precio cobrado al comprador", amount: "$ 34.500,00", type: "positive", detail: "Publicación activa en Clásica", badge: "Ingreso" },
      { label: "Comisión Mercado Libre (14%)", amount: "- $ 4.830,00", type: "negative", detail: "Tarifa por categoría y medio de pago" },
      { label: "Costo de envío (Mercado Envíos)", amount: "- $ 3.120,00", type: "negative", detail: "Flete bonificado por reputación verde" },
      { label: "Promoción co-financiada (5%)", amount: "- $ 1.500,00", type: "negative", detail: "Descuento en campaña comercial" },
      { label: "Publicidad atribuida (MeLi Ads)", amount: "- $ 1.380,00", type: "negative", detail: "ACOS objetivo 4,0% medido al clic" },
      { label: "Costo de reposición (insumo)", amount: "- $ 13.200,00", type: "negative", detail: "Stock interno registrado en depósito" },
    ],
    netProfit: "+ $ 10.470,00",
    netMargin: "30,3%",
    roi: "+79,3%",
  },
  promo: {
    title: "Venta Combo en Campaña Ads",
    badge: "Orden #2000009142",
    salePrice: "$ 58.900,00",
    items: [
      { label: "Precio cobrado al comprador", amount: "$ 58.900,00", type: "positive", detail: "Pack x2 unidades con descuento", badge: "Ingreso" },
      { label: "Comisión Mercado Libre (13%)", amount: "- $ 7.657,00", type: "negative", detail: "Categoría Hogar & Bazar" },
      { label: "Costo de envío (Logística Flex)", amount: "- $ 4.250,00", type: "negative", detail: "Tarifa neta entrega en el día" },
      { label: "Cupón de descuento aplicado", amount: "- $ 3.000,00", type: "negative", detail: "Absorción compartida 50/50" },
      { label: "Publicidad atribuida (MeLi Ads)", amount: "- $ 2.945,00", type: "negative", detail: "ACOS 5,0% en término patrocinado" },
      { label: "Costo de reposición (2 unidades)", amount: "- $ 21.800,00", type: "negative", detail: "Descuento automático de stock x2" },
    ],
    netProfit: "+ $ 19.248,00",
    netMargin: "32,7%",
    roi: "+88,3%",
  },
};

export function SaleBreakdown() {
  const [activeTab, setActiveTab] = useState<"standard" | "promo">("standard");
  const data = scenarioData[activeTab];

  return (
    <div className="w-full bg-white rounded-2xl border border-[#DCDAD4] shadow-md shadow-[#102A56]/5 overflow-hidden transition-all duration-300 hover:border-[#102A56]/30">
      {/* Top Bar / Interactive Selector */}
      <div className="bg-[#F5F3EE] px-5 sm:px-6 py-4 border-b border-[#DCDAD4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#5B2FE4]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#102A56]">
            Desglose de Margen Unitario
          </span>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center bg-white p-1 rounded-lg border border-[#DCDAD4] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("standard")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "standard"
                ? "bg-[#102A56] text-white shadow-xs"
                : "text-[#5F6875] hover:text-[#101828]"
            }`}
          >
            Orden Estándar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("promo")}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === "promo"
                ? "bg-[#102A56] text-white shadow-xs"
                : "text-[#5F6875] hover:text-[#101828]"
            }`}
          >
            Combo + Ads
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 sm:p-6 md:p-7 space-y-4">
        {/* Order Meta Header */}
        <div className="flex items-center justify-between border-b border-[#DCDAD4]/80 pb-3.5">
          <div>
            <span className="text-xs font-mono text-[#5F6875] block">
              {data.badge}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#101828]">
              {data.title}
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF7EE] text-[#198754] border border-[#198754]/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auditada
          </span>
        </div>

        {/* Financial Line Items */}
        <div className="space-y-2">
          {data.items.map((item, idx) => {
            const isRevenue = item.type === "positive";
            return (
              <div
                key={`${activeTab}-${idx}`}
                className={`flex items-center justify-between py-2 px-2.5 rounded-lg transition-colors ${
                  isRevenue
                    ? "bg-[#F5F3EE]/80 border border-[#DCDAD4]/70"
                    : "hover:bg-[#F5F3EE]/50"
                }`}
              >
                <div className="pr-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-[#101828] truncate block">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#5F6875] truncate block">
                    {item.detail}
                  </span>
                </div>
                <span
                  className={`text-xs sm:text-sm font-bold tabular-nums shrink-0 ${
                    isRevenue ? "text-[#101828]" : "text-[#717680]"
                  }`}
                >
                  {item.amount}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Net Result Footer (Signature Ledger Highlight) */}
      <div className="border-t-2 border-[#102A56] bg-gradient-to-br from-[#F5F3EE] to-[#EAE7DF] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5B2FE4]" />
              Ganancia final neta de bolsillo
            </span>
            <div className="text-xs text-[#5F6875] mt-0.5 flex items-center gap-2">
              <span>
                Margen limpio: <strong className="text-[#198754] font-bold">{data.netMargin}</strong>
              </span>
              <span>•</span>
              <span>
                Retorno: <strong className="text-[#102A56] font-bold">{data.roi}</strong>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-[#198754] block">
              {data.netProfit}
            </span>
          </div>
        </div>

        <p className="mt-3.5 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875] leading-normal flex items-center justify-between">
          <span>Cálculo automático descontando comisiones, fletes, ads e insumos.</span>
          <span className="font-mono text-[10px] text-[#5B2FE4] hidden sm:inline">LibretaX Ledger</span>
        </p>
      </div>
    </div>
  );
}
