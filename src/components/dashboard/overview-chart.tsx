"use client";

import * as React from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface OverviewChartProps {
  data: { total_amount: number; date_created: string }[];
  days?: number;
}

export function OverviewChart({ data, days = 7 }: OverviewChartProps) {
  // Process the raw data into daily aggregates
  const chartData = React.useMemo(() => {
    const daysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    if (!data || data.length === 0) {
      return Array.from({ length: days }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const name = days <= 7 
          ? daysOfWeek[d.getDay()] 
          : `${d.getDate()}/${d.getMonth() + 1}`;
        return { name, total: 0 };
      });
    }
    
    // Create an array of the last N days in order
    const lastNDays = Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const name = days <= 7 
        ? daysOfWeek[d.getDay()] 
        : `${d.getDate()}/${d.getMonth() + 1}`;
      return {
        date: d.toISOString().split("T")[0],
        name,
        total: 0,
      };
    });

    // Aggregate totals
    data.forEach(order => {
      const orderDate = new Date(order.date_created).toISOString().split("T")[0];
      const dayData = lastNDays.find(d => d.date === orderDate);
      if (dayData) {
        dayData.total += Number(order.total_amount) || 0;
      }
    });

    return lastNDays;
  }, [data, days]);

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
          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Total"]}
        />
        <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
      </BarChart>
    </ResponsiveContainer>
  );
}
