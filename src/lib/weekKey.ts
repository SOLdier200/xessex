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
