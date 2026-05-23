"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ParetoAnalysisResult } from "@/services/analytics/pareto";

export default function ParetoChart({ data }: { data: ParetoAnalysisResult }) {
  // Take top 20 products for the chart
  const top20 = data.paretoProducts.concat(data.longTailProducts).slice(0, 20);

  const chartData = top20.map(p => ({
    name: p.title.length > 20 ? p.title.substring(0, 20) + "..." : p.title,
    revenue: p.revenue,
    cumulative: p.cumulative_percentage
  }));

  return (
    <Card className="col-span-12">
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
              <CartesianGrid stroke="#f5f5f5" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tickFormatter={(v) => `$${v.toLocaleString()}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip formatter={(value: any, name: any) => {
                const numVal = Number(value) || 0;
                if (name === 'Facturación') return [`$${numVal.toLocaleString()}`, name];
                return [`${numVal.toFixed(1)}%`, name];
              }} />
              <Legend verticalAlign="top" />
              <Bar yAxisId="left" dataKey="revenue" barSize={20} fill="#413ea0" name="Facturación" />
              <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#ff7300" name="% Acumulado" strokeWidth={2} dot={false} />
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
