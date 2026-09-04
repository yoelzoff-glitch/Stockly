import React from "react";

interface OperationalMetricsStripProps {
  salesToday: number;
  revenuePeriod: number;
  days: number;
  totalProductsCount: number;
  lowStockCount: number;
  topProduct?: {
    title?: string;
    sku?: string;
    sold_quantity?: number;
  } | null;
}

export function OperationalMetricsStrip({
  salesToday,
  revenuePeriod,
  days,
  totalProductsCount,
  lowStockCount,
  topProduct,
}: OperationalMetricsStripProps) {
  const topProductSold = topProduct?.sold_quantity || 0;
  const hasTopProduct = Boolean(topProduct && topProductSold > 0);

  const topProductTitle = topProduct
    ? topProduct.sku
      ? `[${topProduct.sku}] ${topProduct.title}`
      : topProduct.title || "Producto"
    : "";

  return (
    <div className="w-full bg-white rounded-xl border border-[#DCDAD4] shadow-xs overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#DCDAD4]">
        
        {/* 1. Ventas de hoy */}
        <div className="p-5 md:p-6 flex flex-col justify-between space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
            Ventas de hoy
          </span>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#101828] tabular-nums tracking-tight block">
              $ {salesToday.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-[#5F6875] block mt-1">
              Facturado desde las 00:00 hs
            </span>
          </div>
        </div>

        {/* 2. Ingresos del período */}
        <div className="p-5 md:p-6 flex flex-col justify-between space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
            Ingresos ({days} días)
          </span>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#101828] tabular-nums tracking-tight block">
              $ {revenuePeriod.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-[#5F6875] block mt-1">
              Total acumulado en el período
            </span>
          </div>
        </div>

        {/* 3. Productos activos */}
        <div className="p-5 md:p-6 flex flex-col justify-between space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
            Productos activos
          </span>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#101828] tabular-nums tracking-tight block">
              {totalProductsCount.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-[#5F6875] block mt-1">
              Publicaciones sincronizadas
            </span>
          </div>
        </div>

        {/* 4. Stock crítico */}
        <div className="p-5 md:p-6 flex flex-col justify-between space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
            Stock crítico
          </span>
          <div>
            <span
              className={`text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight block ${
                lowStockCount > 0 ? "text-[#D92D20]" : "text-[#101828]"
              }`}
            >
              {lowStockCount.toLocaleString("es-AR")}
            </span>
            <span className="text-xs text-[#5F6875] block mt-1">
              {lowStockCount > 0
                ? `${lowStockCount === 1 ? "1 publicación con" : `${lowStockCount} publicaciones con`} ≤ 5 unidades`
                : "Sin publicaciones en quiebre"}
            </span>
          </div>
        </div>

        {/* 5. Producto más vendido */}
        <div className="p-5 md:p-6 flex flex-col justify-between space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6875]">
            Producto más vendido
          </span>
          <div>
            {hasTopProduct ? (
              <>
                <span className="text-2xl sm:text-3xl font-extrabold text-[#101828] tabular-nums tracking-tight block">
                  {topProductSold} {topProductSold === 1 ? "unidad" : "unidades"}
                </span>
                <span
                  className="text-xs text-[#5F6875] block mt-1 truncate"
                  title={topProductTitle}
                >
                  {topProductTitle}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl sm:text-3xl font-bold text-[#5F6875] tracking-tight block">
                  Sin ventas
                </span>
                <span className="text-xs text-[#5F6875] block mt-1">
                  Todavía no hay ventas en este período
                </span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
