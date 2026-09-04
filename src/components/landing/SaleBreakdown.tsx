import React from "react";

export function SaleBreakdown() {
  const lineItems = [
    { label: "Precio de venta", amount: "$ 34.500,00", type: "positive", detail: "Cobrado al comprador" },
    { label: "Comisión Mercado Libre (14%)", amount: "- $ 4.830,00", type: "negative", detail: "Categoría Clásica" },
    { label: "Envío (Mercado Envíos / Flex)", amount: "- $ 3.120,00", type: "negative", detail: "Tarifa neta de flete" },
    { label: "Promoción co-financiada", amount: "- $ 1.500,00", type: "negative", detail: "Descuento en campaña" },
    { label: "Publicidad (MeLi Ads atribuida)", amount: "- $ 1.380,00", type: "negative", detail: "ACOS objetivo 4%" },
    { label: "Costo del producto (reposición)", amount: "- $ 13.200,00", type: "negative", detail: "Insumo / Stock interno" },
  ];

  return (
    <div className="w-full bg-white rounded-xl border border-[#DCDAD4] shadow-xs p-6 md:p-7">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[#DCDAD4] pb-4 mb-5">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875] block">
            Visualización de margen unitario
          </span>
          <h3 className="text-lg font-bold text-[#101828]">
            Anatomía de una venta
          </h3>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-[#F5F3EE] text-[#102A56] border border-[#DCDAD4]">
          Orden auditada
        </span>
      </div>

      {/* Financial Table Rows */}
      <div className="space-y-2.5">
        {lineItems.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#F5F3EE]/60 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-[#101828] block">
                {item.label}
              </span>
              <span className="text-xs text-[#5F6875]">
                {item.detail}
              </span>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                item.type === "positive" ? "text-[#101828]" : "text-[#5F6875]"
              }`}
            >
              {item.amount}
            </span>
          </div>
        ))}
      </div>

      {/* Net Result Bar */}
      <div className="mt-5 pt-4 border-t-2 border-[#101828] bg-[#F5F3EE]/50 -mx-6 -mb-6 p-6 rounded-b-xl">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A56] block">
              Ganancia final neta
            </span>
            <span className="text-xs text-[#5F6875]">
              Margen limpio sobre venta: <strong className="text-[#198754]">30,3%</strong>
            </span>
          </div>
          <span className="text-2xl font-bold tabular-nums text-[#198754]">
            + $ 10.470,00
          </span>
        </div>

        {/* Mandatory Disclaimer */}
        <p className="mt-4 text-[11px] text-[#5F6875] leading-normal border-t border-[#DCDAD4] pt-3">
          Ejemplo ilustrativo. Cada cuenta utiliza sus propios costos y condiciones.
        </p>
      </div>
    </div>
  );
}
