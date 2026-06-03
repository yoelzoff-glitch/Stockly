"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ParetoAnalysisResult } from "@/services/analytics/pareto";

export default function ParetoChart({ data }: { data: ParetoAnalysisResult }) {
  // Take top 20 products for the chart
  const top20 = data.paretoProducts.concat(data.longTailProducts).slice(0, 20);

  const chartData = top20.map(p => ({
    name: p.title.length > 12 ? p.title.substring(0, 12) + "..." : p.title,
    revenue: p.revenue,
    cumulative: p.cumulative_percentage
  }));

  return (
    <Card className="col-span-12 shadow-sm">
      <CardHeader>
        <CardTitle>Análisis Pareto 80/20</CardTitle>
        <CardDescription>
          {data.productsToReach80} productos representan el 80% de tu facturación. 
          (El {data.percentageOfCatalog.toFixed(1)}% de tu catálogo genera el 80% de tus ventas).
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[400px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip formatter={(value: any, name: any) => {
                const numVal = Number(value) || 0;
                if (name === 'Facturación') return [`$${numVal.toLocaleString()}`, name];
                return [`${numVal.toFixed(1)}%`, name];
              }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} />
              <Bar yAxisId="left" dataKey="revenue" barSize={16} fill="#6366f1" radius={[4, 4, 0, 0]} name="Facturación" />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#f97316" name="% Acumulado" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No hay suficientes datos para el análisis.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
