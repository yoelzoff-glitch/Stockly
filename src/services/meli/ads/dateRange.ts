import { DEFAULT_TIMEZONE, getTenantDateTimeParts, getMidnightInTimezone, getTenantDateString } from "@/lib/dates";

export interface AdsDateRangeResult {
  dateFrom: Date | null;
  dateTo: Date;
  dateFromString: string | null;
  dateToString: string;
  periodLabel: string;
}

export function getAdsDateRange(period: string = "30days", timezone: string = DEFAULT_TIMEZONE): AdsDateRangeResult {
  const now = new Date();
  const { year, month, day } = getTenantDateTimeParts(now, timezone);

  let dateFrom: Date | null = null;
  let dateTo: Date = now;
  let periodLabel = "Últimos 30 días";

  if (period === "today") {
    const todayRef = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    dateFrom = getMidnightInTimezone(todayRef, timezone);
    periodLabel = "Hoy";
  } else if (period === "7days") {
    const tempRef = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    tempRef.setUTCDate(tempRef.getUTCDate() - 6);
    dateFrom = getMidnightInTimezone(tempRef, timezone);
    periodLabel = "Últimos 7 días";
  } else if (period === "this_month") {
    const startOfMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    dateFrom = getMidnightInTimezone(startOfMonthRef, timezone);
    periodLabel = "Este Mes";
  } else if (period === "last_month") {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const startOfPrevMonthRef = new Date(Date.UTC(prevYear, prevMonth - 1, 1, 12, 0, 0));
    dateFrom = getMidnightInTimezone(startOfPrevMonthRef, timezone);

    const startOfCurrentMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const startOfCurrentMonthMidnight = getMidnightInTimezone(startOfCurrentMonthRef, timezone);
    dateTo = new Date(startOfCurrentMonthMidnight.getTime() - 1);
    periodLabel = "Mes Anterior";
  } else if (period === "all") {
    dateFrom = null;
    periodLabel = "Histórico Completo";
  } else {
    // Default 30 days
    const tempRef = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    tempRef.setUTCDate(tempRef.getUTCDate() - 29);
    dateFrom = getMidnightInTimezone(tempRef, timezone);
    periodLabel = "Últimos 30 días";
  }

  const dateFromString = dateFrom ? getTenantDateString(dateFrom, timezone) : null;
  const dateToString = getTenantDateString(dateTo, timezone);

  return {
    dateFrom,
    dateTo,
    dateFromString,
    dateToString,
    periodLabel,
  };
}
