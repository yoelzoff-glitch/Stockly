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
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          stroke="#5F6875"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: "#DCDAD4" }}
        />
        <YAxis
          stroke="#5F6875"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`}
        />
        <Tooltip
          cursor={{ fill: 'rgba(16, 42, 86, 0.05)' }}
          contentStyle={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #DCDAD4',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            fontSize: '12px',
            color: '#101828'
          }}
          formatter={(value: any) => [`$ ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, "Ingresos"]}
        />
        <Bar dataKey="total" fill="#102A56" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
