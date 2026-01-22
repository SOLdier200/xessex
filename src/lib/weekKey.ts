/**
 * Week key helper for server-side use
 * Returns YYYY-MM-DD of the Monday of the current week (UTC)
 */
export function weekKeyUTC(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon => 0, Sun => 6
  dt.setUTCDate(dt.getUTCDate() - diffToMonday);
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Month key helper for server-side use
 * Returns YYYY-MM format for the given date (UTC)
 */
export function monthKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Week key helper for Sunday midnight PT (America/Los_Angeles)
 * Returns YYYY-MM-DD of the Sunday that starts the current week in PT.
 * Example: "2026-01-18" for the week starting Sunday Jan 18, 2026 @ 00:00 PT
 */
export function weekKeySundayMidnightPT(d = new Date()): string {
  // Get date parts in America/Los_Angeles timezone
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

  // Construct a Date representing "today" in PT using UTC as container
  const ptMiddayUTC = new Date(Date.UTC(yyyy, mm - 1, dd, 20, 0, 0)); // ~noon PT in UTC
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).format(ptMiddayUTC);

  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[weekday];

  // Move back to Sunday by subtracting dow days
  const base = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() - dow);

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
