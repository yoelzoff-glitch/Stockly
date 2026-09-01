export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Returns year, month (1-12), day (1-31), hour, minute, second for a Date in a specific timezone.
 */
export function getTenantDateTimeParts(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find(p => p.type === 'year')?.value || 2026);
  const month = Number(parts.find(p => p.type === 'month')?.value || 1);
  const day = Number(parts.find(p => p.type === 'day')?.value || 1);
  const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
  const second = Number(parts.find(p => p.type === 'second')?.value || 0);

  return { year, month, day, hour, minute, second };
}

/**
 * Gets a Date object corresponding to 00:00:00.000 local time in the specified timezone (represented as UTC timestamp).
 */
export function getMidnightInTimezone(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day } = getTenantDateTimeParts(date, timezone);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const parts = formatter.formatToParts(utcDate);
  const pYear = Number(parts.find(p => p.type === 'year')?.value || year);
  const pMonth = Number(parts.find(p => p.type === 'month')?.value || month);
  const pDay = Number(parts.find(p => p.type === 'day')?.value || day);
  const pHour = Number(parts.find(p => p.type === 'hour')?.value || 0);
  
  const localTimeAsUtc = new Date(Date.UTC(pYear, pMonth - 1, pDay, pHour, 0, 0));
  const offsetMs = utcDate.getTime() - localTimeAsUtc.getTime();
  
  return new Date(utcDate.getTime() + offsetMs);
}

/**
 * Returns formatted date string "YYYY-MM-DD" for a date in tenant timezone.
 */
export function getTenantDateString(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): string {
  const { year, month, day } = getTenantDateTimeParts(date, timezone);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Calculates start and end Date bounds for period filters in the tenant's timezone.
 */
export function getPeriodRangeInTimezone(
  daysParam: string | number,
  timezone: string = DEFAULT_TIMEZONE,
  fromParam?: string,
  toParam?: string
): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const { year, month, day } = getTenantDateTimeParts(now, timezone);
  const daysStr = String(daysParam);

  let dateFrom: Date;
  let dateTo = new Date(); // current timestamp

  if (daysStr === "current_month") {
    // 1st day of current month in tenant timezone at 00:00:00
    const startOfMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    dateFrom = getMidnightInTimezone(startOfMonthRef, timezone);
  } else if (daysStr === "previous_month" || daysStr === "last_month") {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const startOfPrevMonthRef = new Date(Date.UTC(prevYear, prevMonth - 1, 1, 12, 0, 0));
    dateFrom = getMidnightInTimezone(startOfPrevMonthRef, timezone);

    const startOfCurrentMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const startOfCurrentMonthMidnight = getMidnightInTimezone(startOfCurrentMonthRef, timezone);
    dateTo = new Date(startOfCurrentMonthMidnight.getTime() - 1);
  } else if (daysStr === "custom") {
    if (fromParam) {
      const [fY, fM, fD] = fromParam.split('-').map(Number);
      const customRef = new Date(Date.UTC(fY || year, (fM || month) - 1, fD || 1, 12, 0, 0));
      dateFrom = getMidnightInTimezone(customRef, timezone);
    } else {
      const startOfMonthRef = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
      dateFrom = getMidnightInTimezone(startOfMonthRef, timezone);
    }
    if (toParam) {
      const [tY, tM, tD] = toParam.split('-').map(Number);
      const customToRef = new Date(Date.UTC(tY || year, (tM || month) - 1, tD || day, 12, 0, 0));
      const customToMidnight = getMidnightInTimezone(customToRef, timezone);
      dateTo = new Date(customToMidnight.getTime() + 24 * 60 * 60 * 1000 - 1);
    }
  } else {
    const daysNum = parseInt(daysStr, 10) || 30;
    // Go back daysNum days from current tenant day
    const tempRef = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    tempRef.setUTCDate(tempRef.getUTCDate() - daysNum + 1);
    dateFrom = getMidnightInTimezone(tempRef, timezone);
  }

  return { dateFrom, dateTo };
}
