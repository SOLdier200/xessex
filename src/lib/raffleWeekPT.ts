/**
 * PT timezone utilities for raffle week calculations
 *
 * weekKey = ending Sunday date (PT)
 * Week runs Monday 00:00 PT -> Sunday 23:59 PT
 */

const PT = "America/Los_Angeles";

function fmtDateKeyPT(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
}

function weekdayPT(d: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: PT, weekday: "short" }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function addDaysDateKeyPT(dateKey: string, deltaDays: number): string {
  const base = new Date(dateKey + "T12:00:00Z");
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return fmtDateKeyPT(base);
}

function ptOffsetMinutesAtUtc(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  // tz examples: "GMT-8", "GMT-07:00"
  const m = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = m[3] ? Number(m[3]) : 0;
  return sign * (hh * 60 + mm);
}

/**
 * Convert a PT-local dateKey + time to a UTC Date.
 * We do a small 2-iteration refinement to handle DST boundaries.
 */
export function ptLocalToUtc(dateKey: string, hh: number, mm: number, ss: number): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoLocal = `${dateKey}T${pad(hh)}:${pad(mm)}:${pad(ss)}.000`;

  // Start with a UTC guess (treat local as UTC)
  let utc = new Date(isoLocal + "Z");

  for (let i = 0; i < 2; i++) {
    const offMin = ptOffsetMinutesAtUtc(utc);
    // local = utc + off; so utc = local - off
    utc = new Date(utc.getTime() - offMin * 60_000);
  }

  return utc;
}

/**
 * Get the current date key in PT timezone
 */
export function getDateKeyPT(now = new Date()): string {
  return fmtDateKeyPT(now);
}

/**
 * weekKey is the ending Sunday date (PT) for the week containing `now`.
 * Week runs Monday 00:00 PT -> Sunday 23:59 PT.
 */
export function raffleWeekInfo(now = new Date()) {
  const todayKey = fmtDateKeyPT(now);
  const w = weekdayPT(now); // Sun=0..Sat=6

  // days until Sunday: if Sun, 0; Mon->6; Sat->1
  const daysUntilSun = (7 - w) % 7;
  const weekKey = addDaysDateKeyPT(todayKey, daysUntilSun); // ending Sunday date

  const mondayKey = addDaysDateKeyPT(weekKey, -6); // Monday of that same raffle week

  const opensAt = ptLocalToUtc(mondayKey, 0, 0, 0);
  const closesAt = ptLocalToUtc(weekKey, 23, 59, 0);

  // For claim expiry: next week's close
  const nextWeekKey = addDaysDateKeyPT(weekKey, 7);
  const nextClosesAt = ptLocalToUtc(nextWeekKey, 23, 59, 0);

  return { weekKey, mondayKey, opensAt, closesAt, nextWeekKey, nextClosesAt };
}

/**
 * Get the previous week's key
 */
export function getPrevWeekKey(weekKey: string): string {
  return addDaysDateKeyPT(weekKey, -7);
}
