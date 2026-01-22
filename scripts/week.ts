/**
 * Week helpers for XESS rewards system
 */

export function weekKeyUTC(d: Date): string {
  // Monday start UTC (ISO week-like)
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon => 0, Sun => 6
  dt.setUTCDate(dt.getUTCDate() - diffToMonday);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function weekRangeUTC(weekKey: string): { start: Date; end: Date } {
  const start = new Date(weekKey + "T00:00:00.000Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function getPreviousWeekKey(weekKey: string): string {
  const start = new Date(weekKey + "T00:00:00.000Z");
  start.setUTCDate(start.getUTCDate() - 7);
  return weekKeyUTC(start);
}

export function monthKeyUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Week key helper for Sunday midnight PT (America/Los_Angeles)
 * Returns YYYY-MM-DD of the Sunday that starts the current week in PT.
 * Example: "2026-01-18" for the week starting Sunday Jan 18, 2026 @ 00:00 PT
 *
 * This is the STANDARD for XESS claim epochs.
 */
export function weekKeySundayMidnightPT(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);

  const get = (t: string) => parts.find(p => p.type === t)?.value!;
  const yyyy = Number(get("year"));
  const mm = Number(get("month"));
  const dd = Number(get("day"));

  const middayUTC = new Date(Date.UTC(yyyy, mm - 1, dd, 20, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).format(middayUTC);

  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday];

  const base = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() - dow);

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
