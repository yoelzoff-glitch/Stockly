"use client";

import * as React from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface OverviewChartProps {
  data: { total_amount: number; date_created: string }[];
  days?: number;
  timezone?: string;
}

export function OverviewChart({ data, days = 7, timezone = 'America/Argentina/Buenos_Aires' }: OverviewChartProps) {
  // Process the raw data into daily aggregates
  const chartData = React.useMemo(() => {
    const weekdayMap: Record<string, string> = {
      'Sun': 'Dom', 'Mon': 'Lun', 'Tue': 'Mar', 'Wed': 'Mié', 'Thu': 'Jue', 'Fri': 'Vie', 'Sat': 'Sáb'
    };

    const getLocalDateString = (date: Date) => {
      try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        return formatter.format(date);
      } catch (e) {
        return date.toISOString().split("T")[0];
      }
    };

    const getLocalDateParts = (date: Date) => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'short',
          day: 'numeric',
          month: 'numeric',
        });
        const parts = formatter.formatToParts(date);
        const weekday = parts.find(p => p.type === 'weekday')?.value || "";
        const day = parts.find(p => p.type === 'day')?.value || "";
        const month = parts.find(p => p.type === 'month')?.value || "";
        return { weekday, day, month };
      } catch (e) {
        return { weekday: "", day: String(date.getDate()), month: String(date.getMonth() + 1) };
      }
    };

    if (!data || data.length === 0) {
      return Array.from({ length: days }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const { weekday, day, month } = getLocalDateParts(d);
        const name = days <= 7 
          ? (weekdayMap[weekday] || weekday) 
          : `${day}/${month}`;
        return { name, total: 0 };
      });
    }
    
    // Create an array of the last N days in order
    const lastNDays = Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const { weekday, day, month } = getLocalDateParts(d);
      const name = days <= 7 
        ? (weekdayMap[weekday] || weekday) 
        : `${day}/${month}`;
      return {
        date: getLocalDateString(d),
        name,
        total: 0,
      };
    });

    // Aggregate totals
    data.forEach(order => {
      const orderDate = getLocalDateString(new Date(order.date_created));
      const dayData = lastNDays.find(d => d.date === orderDate);
      if (dayData) {
        dayData.total += Number(order.total_amount) || 0;
      }
    });

    return lastNDays;
  }, [data, days, timezone]);

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
