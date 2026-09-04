"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { MapPin, CreditCard, Layers } from "lucide-react";
import { OperationalPanel } from "@/components/operational/panel";
import { OperationalEmptyState } from "@/components/operational/empty-state";

interface ProvinceSale {
  province: string;
  count: number;
  revenue: number;
}

interface PaymentType {
  name: string;
  count: number;
  revenue: number;
  color: string;
}

interface InstallmentDetail {
  installments: number;
  name: string;
  count: number;
  revenue: number;
}

export default function SalesAnalytics({
  provinceSales,
  paymentTypeData,
  installmentDetails
}: {
  provinceSales: ProvinceSale[];
  paymentTypeData: PaymentType[];
  installmentDetails: InstallmentDetail[];
}) {
  const topProvinces = provinceSales.slice(0, 8);

  const totalSalesCount = provinceSales.reduce((acc, curr) => acc + curr.count, 0);
  const totalRevenue = provinceSales.reduce((acc, curr) => acc + curr.revenue, 0);

  const leadingProvince = provinceSales[0]?.province || "Sin datos";
  const leadingProvinceCount = provinceSales[0]?.count || 0;
  const leadingProvincePercent = totalSalesCount > 0 ? ((leadingProvinceCount / totalSalesCount) * 100).toFixed(1) : "0.0";

  const installmentSalesCount = paymentTypeData.find(p => p.name === "En cuotas")?.count || 0;
  const installmentPercent = totalSalesCount > 0 ? ((installmentSalesCount / totalSalesCount) * 100) : 0;

  const operationalPaymentData = paymentTypeData.map(p => ({
    ...p,
    color: p.name === "Un solo pago" ? "#102A56" : "#198754"
  }));

  return (
    <div className="space-y-6">
      {/* 3 Micro Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875]">Zona de Mayor Demanda</span>
            <MapPin className="h-4 w-4 text-[#5F6875]" />
          </div>
          <div className="text-xl font-bold text-[#101828] truncate mt-2" title={leadingProvince}>
            {leadingProvince}
          </div>
          <div className="mt-2 text-xs font-mono text-[#5F6875] border-t border-[#DCDAD4] pt-2">
            {leadingProvinceCount} órdenes ({leadingProvincePercent}% del total regional)
          </div>
        </div>

        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875]">Financiación Elegida</span>
            <CreditCard className="h-4 w-4 text-[#5F6875]" />
          </div>
          <div className="text-xl font-bold text-[#101828] mt-2">
            {installmentPercent > 50 ? "En Cuotas" : "Un Solo Pago"}
          </div>
          <div className="mt-2 text-xs font-mono text-[#5F6875] border-t border-[#DCDAD4] pt-2">
            {installmentPercent.toFixed(1)}% de las ventas cobradas con tarjeta financiada
          </div>
        </div>

        <div className="rounded-lg border border-[#DCDAD4] bg-[#FFFFFF] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6875]">Estrategia Sugerida</span>
            <Layers className="h-4 w-4 text-[#5F6875]" />
          </div>
          <div className="text-sm font-semibold text-[#101828] mt-2 leading-snug">
            {installmentPercent > 40 ? "Reforzar publicaciones Premium con cuotas" : "Optimizar tiempos y costos de entrega"}
          </div>
          <div className="mt-2 text-xs text-[#5F6875] border-t border-[#DCDAD4] pt-2">
            {installmentPercent > 40
              ? "Tus compradores priorizan financiamiento sobre descuento de contado."
              : "La mayor parte abona de contado; la velocidad de despacho es el factor decisivo."}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Province Sales Chart */}
        <div className="lg:col-span-7">
          <OperationalPanel
            title="Distribución Geográfica por Provincia"
            description="Ventas confirmadas y concentración logística según destino del comprador."
            action={<span className="text-[11px] font-mono text-[#5F6875]">Unidad: Ventas</span>}
          >
            <div className="h-[360px] w-full pt-2">
              {topProvinces.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProvinces}
                    layout="vertical"
                    margin={{ top: 5, right: 25, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#E5E3DC" strokeDasharray="2 2" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#5F6875" }} />
                    <YAxis
                      dataKey="province"
                      type="category"
                      tick={{ fontSize: 10, fill: "#5F6875" }}
                      width={110}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => {
                        if (name === "Facturación") return [`$${value.toLocaleString("es-AR")}`, name];
                        return [`${value} ventas`, name];
                      }}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: "6px",
                        border: "1px solid #DCDAD4",
                        fontSize: "12px",
                        fontFamily: "monospace"
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", color: "#5F6875" }} />
                    <Bar dataKey="count" fill="#102A56" name="Órdenes (cant.)" barSize={14} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <OperationalEmptyState
                  title="Sin datos geográficos en este período"
                  description="No se registraron envíos con provincia informada en las órdenes del período."
                />
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875]">
              Fuente: Datos de destinatarios extraídos de envíos Mercado Envíos.
            </div>
          </OperationalPanel>
        </div>

        {/* Payment Financing Pie Chart */}
        <div className="lg:col-span-5">
          <OperationalPanel
            title="Modalidad de Pago y Financiación"
            description="Proporción de transacciones de un pago vs. compras diferidas en cuotas."
            action={<span className="text-[11px] font-mono text-[#5F6875]">Unidad: % órdenes</span>}
          >
            <div className="h-[360px] flex flex-col justify-between pt-2">
              {totalSalesCount > 0 ? (
                <>
                  <div className="h-[230px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={operationalPaymentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="count"
                        >
                          {operationalPaymentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any) => [`${value} órdenes (${((value / totalSalesCount) * 100).toFixed(1)}%)`, name]}
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            borderRadius: "6px",
                            border: "1px solid #DCDAD4",
                            fontSize: "12px",
                            fontFamily: "monospace"
                          }}
                        />
                        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "11px", color: "#5F6875", paddingTop: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-[#DCDAD4] pt-3 text-center">
                    <div className="p-2 rounded bg-[#FCFCFA] border border-[#DCDAD4]">
                      <span className="text-[10px] text-[#5F6875] uppercase font-bold tracking-wider block">Facturado Un Pago</span>
                      <p className="text-sm font-bold font-mono text-[#102A56] mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                        ${(paymentTypeData.find(p => p.name === "Un solo pago")?.revenue || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-[#FCFCFA] border border-[#DCDAD4]">
                      <span className="text-[10px] text-[#5F6875] uppercase font-bold tracking-wider block">Facturado en Cuotas</span>
                      <p className="text-sm font-bold font-mono text-[#198754] mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                        ${(paymentTypeData.find(p => p.name === "En cuotas")?.revenue || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <OperationalEmptyState
                  title="Sin datos de cobros disponibles"
                  description="No se registraron transacciones confirmadas en el período seleccionado."
                />
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-[#DCDAD4] text-[11px] text-[#5F6875]">
              Fuente: Metadata de pagos procesados por Mercado Pago vinculados a la orden.
            </div>
          </OperationalPanel>
        </div>
      </div>
    </div>
  );
}
