/** All dates are plain "YYYY-MM-DD" strings in IST. */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function todayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function toUTCDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function addDays(d: string, days: number): string {
  const dt = toUTCDate(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Subtract months, clamping to month end (e.g. 31 Mar - 1 month = 28/29 Feb). */
export function addMonths(d: string, months: number): string {
  const dt = toUTCDate(d);
  const day = dt.getUTCDate();
  dt.setUTCDate(1);
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(day, lastDay));
  return dt.toISOString().slice(0, 10);
}

export function previousYearEnd(d: string): string {
  return `${Number(d.slice(0, 4)) - 1}-12-31`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86_400_000);
}

/** mfapi uses "DD-MM-YYYY". */
export function fromMfapiDate(d: string): string {
  const [dd, mm, yyyy] = d.split("-");
  return `${yyyy}-${mm}-${dd}`;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** AMFI uses "09-Oct-2026". Returns null if unparseable. */
export function fromAmfiDate(d: string): string | null {
  const m = d.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  return mm ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : null;
}
