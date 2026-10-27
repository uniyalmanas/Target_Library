/**
 * Timezone-Safe Date Utility for LibraryOS
 * Operating primarily in Indian Standard Time (IST, UTC+05:30)
 * 
 * Prevents UTC offset shifting where local midnight (00:00 IST)
 * converts to 18:30 UTC of the previous calendar day when using .toISOString().
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in Indian Standard Time (Asia/Kolkata).
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Formats a Date object as YYYY-MM-DD using its local calendar values (not UTC).
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into year, month (1-12), and day numbers.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

/**
 * Safely adds (or subtracts) days to a YYYY-MM-DD string without timezone corruption.
 * E.g., addDaysToDate("2026-10-30", 1) => "2026-10-31"
 * E.g., addDaysToDate("2026-10-31", 1) => "2026-11-01"
 * E.g., addDaysToDate("2026-10-26", 30) => "2026-11-25"
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + Number(days));
  return formatLocalDate(date);
}

/**
 * Alias for addDaysToDate, compatible with computeEndDate(startStr, days).
 */
export function computeEndDate(startStr: string, days: number): string {
  return addDaysToDate(startStr, days);
}

/**
 * Computes calendar day difference between two YYYY-MM-DD strings.
 */
export function computeDaysBetween(startStr: string, endStr: string): number {
  const startParts = parseDateParts(startStr);
  const endParts = parseDateParts(endStr);
  if (!startParts || !endParts) return 30;

  const s = new Date(startParts.year, startParts.month - 1, startParts.day);
  const e = new Date(endParts.year, endParts.month - 1, endParts.day);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Computes 1 calendar month validity (e.g. 26-Oct -> 25-Nov, 01-Oct -> 31-Oct).
 * Next renewal starts on the same day next month (or clamped if target month is shorter).
 */
export function computeCalendarMonthEnd(startStr: string, months: number = 1): string {
  const parts = parseDateParts(startStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const targetYear = year + Math.floor((month - 1 + months) / 12);
  const targetMonth = (month - 1 + months) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  const targetDate = new Date(targetYear, targetMonth, targetDay);
  targetDate.setDate(targetDate.getDate() - 1);
  return formatLocalDate(targetDate);
}
