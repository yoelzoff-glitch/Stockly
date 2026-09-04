"use client";

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ParetoAnalysisResult } from "@/services/analytics/pareto";
import { OperationalPanel } from "@/components/operational/panel";
import { OperationalEmptyState } from "@/components/operational/empty-state";

export default function ParetoChart({ data }: { data: ParetoAnalysisResult }) {
  const top20 = data.paretoProducts.concat(data.longTailProducts).slice(0, 20);

  const chartData = top20.map(p => ({
    name: p.title.length > 18 ? p.title.substring(0, 18) + "..." : p.title,
    revenue: p.revenue,
    cumulative: p.cumulative_percentage
  }));

  return (
    <OperationalPanel
      title="Curva Pareto 80/20 de Concentración de Ventas"
      description={`${data.productsToReach80} productos generan el 80% de tu facturación (${data.percentageOfCatalog.toFixed(1)}% del catálogo activo).`}
      action={<span className="text-[11px] font-mono text-[#5F6875]">Unidad: $ ARS / % acum.</span>}
    >
      <div className="h-[380px] w-full pt-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 20, bottom: 25, left: 10 }}>
              <CartesianGrid stroke="#E5E3DC" strokeDasharray="2 2" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#5F6875" }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={55}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#5F6875" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: "#5F6875" }}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  const numVal = Number(value) || 0;
                  if (name === "Facturación") return [`$${numVal.toLocaleString("es-AR")}`, name];
                  return [`${numVal.toFixed(1)}%`, name];
                }}
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "6px",
                  border: "1px solid #DCDAD4",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  fontSize: "12px",
                  fontFamily: "monospace"
                }}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ fontSize: "11px", paddingBottom: "12px", color: "#5F6875" }}
              />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                barSize={18}
                fill="#102A56"
                radius={[3, 3, 0, 0]}
                name="Facturación"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="#198754"
                name="% Acumulado"
                strokeWidth={2}
                dot={{ r: 2, fill: "#198754" }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <OperationalEmptyState
            title="Datos insuficientes para el análisis Pareto"
            description="Se requiere un mayor volumen de órdenes en el período para graficar la concentración 80/20."
          />
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[#DCDAD4] flex flex-wrap items-center justify-between text-[11px] text-[#5F6875]">
        <span>Fuente: Órdenes sincronizadas de Mercado Libre en el período seleccionado.</span>
        <span>Regla operativa: Un catálogo con menos de 20% de productos generando el 80% de ventas presenta riesgo de stockout.</span>
      </div>
    </OperationalPanel>
  );
}
