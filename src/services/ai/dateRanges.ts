import {
  DEFAULT_TIMEZONE,
  getMidnightInTimezone,
  getTenantDateTimeParts,
} from "@/lib/dates";

export interface ResolvedRange {
  from: Date;
  to: Date;
  label: string;
}

export interface ComparisonRange {
  current: ResolvedRange;
  previous: ResolvedRange;
}

/**
 * Resolves standard business date ranges respecting the tenant's timezone.
 */
export function resolveDateRange(
  rangeType: "hoy" | "ayer" | "esta_semana" | "este_mes" | "mes_pasado" | "ultimos_7_dias" | "ultimos_30_dias" | string,
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): ResolvedRange {
  const parts = getTenantDateTimeParts(now, timezone);
  const { year, month, day } = parts;

  const todayMidnight = getMidnightInTimezone(now, timezone);

  switch (rangeType) {
    case "hoy":
    case "today": {
      const endOfToday = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
      return {
        from: todayMidnight,
        to: endOfToday,
        label: "Hoy",
      };
    }

    case "ayer":
    case "yesterday": {
      const yesterdayMidnight = new Date(todayMidnight.getTime() - 24 * 60 * 60 * 1000);
      const endOfYesterday = new Date(todayMidnight.getTime() - 1);
      return {
        from: yesterdayMidnight,
        to: endOfYesterday,
        label: "Ayer",
      };
    }

    case "esta_semana":
    case "this_week": {
      // Find Monday of current week
      const dayOfWeek = (new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay() + 6) % 7; // 0 = Mon, 6 = Sun
      const mondayMidnight = new Date(todayMidnight.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      return {
        from: mondayMidnight,
        to: new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1),
        label: "Esta semana",
      };
    }

    case "este_mes":
    case "this_month":
    case "current_month": {
      const startOfMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
      const startOfMonth = getMidnightInTimezone(startOfMonthRef, timezone);
      const endOfToday = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
      return {
        from: startOfMonth,
        to: endOfToday,
        label: "Este mes",
      };
    }

    case "mes_pasado":
    case "last_month":
    case "previous_month": {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const startPrevMonth = getMidnightInTimezone(new Date(Date.UTC(prevYear, prevMonth - 1, 1, 12, 0, 0)), timezone);
      const startCurrentMonth = getMidnightInTimezone(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)), timezone);
      return {
        from: startPrevMonth,
        to: new Date(startCurrentMonth.getTime() - 1),
        label: "Mes pasado completo",
      };
    }

    case "ultimos_7_dias": {
      const from = new Date(todayMidnight.getTime() - 6 * 24 * 60 * 60 * 1000);
      return {
        from,
        to: new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1),
        label: "Últimos 7 días",
      };
    }

    case "ultimos_30_dias":
    default: {
      const from = new Date(todayMidnight.getTime() - 29 * 24 * 60 * 60 * 1000);
      return {
        from,
        to: new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1),
        label: "Últimos 30 días",
      };
    }
  }
}

/**
 * Compares current month-to-date with equivalent previous month-to-date.
 * Example: Sep 1 to Sep 12 vs Aug 1 to Aug 12 (avoids unfair full vs partial comparison).
 */
export function resolveMonthToDateComparison(
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date()
): ComparisonRange {
  const parts = getTenantDateTimeParts(now, timezone);
  const { year, month, day } = parts;

  const currentMonthStart = getMidnightInTimezone(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)), timezone);
  const todayMidnight = getMidnightInTimezone(now, timezone);
  const currentMonthEnd = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Previous month same day range
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const targetPrevDay = Math.min(day, daysInPrevMonth);

  const prevMonthStart = getMidnightInTimezone(new Date(Date.UTC(prevYear, prevMonth - 1, 1, 12, 0, 0)), timezone);
  const prevTargetMidnight = getMidnightInTimezone(new Date(Date.UTC(prevYear, prevMonth - 1, targetPrevDay, 12, 0, 0)), timezone);
  const prevMonthEnd = new Date(prevTargetMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    current: {
      from: currentMonthStart,
      to: currentMonthEnd,
      label: `1 al ${day} del mes actual`,
    },
    previous: {
      from: prevMonthStart,
      to: prevMonthEnd,
      label: `1 al ${targetPrevDay} del mes anterior`,
    },
  };
}

/**
 * Compares full calendar month A vs calendar month B.
 */
export function resolveFullMonthComparison(
  yearA: number,
  monthA: number,
  yearB: number,
  monthB: number,
  timezone: string = DEFAULT_TIMEZONE
): ComparisonRange {
  const startA = getMidnightInTimezone(new Date(Date.UTC(yearA, monthA - 1, 1, 12, 0, 0)), timezone);
  const endA = new Date(getMidnightInTimezone(new Date(Date.UTC(yearA, monthA, 1, 12, 0, 0)), timezone).getTime() - 1);

  const startB = getMidnightInTimezone(new Date(Date.UTC(yearB, monthB - 1, 1, 12, 0, 0)), timezone);
  const endB = new Date(getMidnightInTimezone(new Date(Date.UTC(yearB, monthB, 1, 12, 0, 0)), timezone).getTime() - 1);

  return {
    current: {
      from: startA,
      to: endA,
      label: `Mes ${monthA}/${yearA} completo`,
    },
    previous: {
      from: startB,
      to: endB,
      label: `Mes ${monthB}/${yearB} completo`,
    },
  };
}

export function formatPeriodLabel(from: Date, to: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const partsFrom = getTenantDateTimeParts(from, timezone);
  const partsTo = getTenantDateTimeParts(to, timezone);
  return `${partsFrom.day}/${partsFrom.month}/${partsFrom.year} al ${partsTo.day}/${partsTo.month}/${partsTo.year}`;
}
