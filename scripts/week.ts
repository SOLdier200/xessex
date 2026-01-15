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
