"use client";

import * as React from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface OverviewChartProps {
  data: { total_amount: number; date_created: string }[];
}

export function OverviewChart({ data }: OverviewChartProps) {
  // Process the raw data into daily aggregates
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { name: "Lun", total: 0 },
        { name: "Mar", total: 0 },
        { name: "Mié", total: 0 },
        { name: "Jue", total: 0 },
        { name: "Vie", total: 0 },
        { name: "Sáb", total: 0 },
        { name: "Dom", total: 0 },
      ];
    }

    const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    
    // Create an array of the last 7 days in order
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toISOString().split("T")[0],
        name: days[d.getDay()],
        total: 0,
      };
    });

    // Aggregate totals
    data.forEach(order => {
      const orderDate = new Date(order.date_created).toISOString().split("T")[0];
      const dayData = last7Days.find(d => d.date === orderDate);
      if (dayData) {
        dayData.total += Number(order.total_amount) || 0;
      }
    });

    return last7Days;
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, "Total"]}
        />
        <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  );
}
