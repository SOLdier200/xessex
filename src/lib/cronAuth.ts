import { NextResponse } from "next/server";

/** Returns true when cron endpoints are disabled for this deployment (presale). */
function isCronDisabled(): boolean {
  const v = process.env.CRON_DISABLED;
  return v === "1" || v === "true";
}

/**
 * Shared cron auth — accepts both x-cron-secret header and Authorization: Bearer.
 * Always .trim()s both sides to prevent CRLF / whitespace mismatches.
 */
export function verifyCronSecret(req: Request): boolean {
  if (isCronDisabled()) return false;

  const expected = (process.env.CRON_SECRET || "").trim();
  if (!expected) return false;

  const got =
    req.headers.get("x-cron-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";

  return got === expected;
}

/** Throws if cron secret is missing or wrong. For routes using try/catch. */
export function assertCronSecret(req: Request): void {
  if (!verifyCronSecret(req)) {
    throw new Error("unauthorized");
  }
}

/** Returns a 401 Response if cron secret is wrong, or null if OK. For routes that return early. */
export function unauthorizedIfBadCron(req: Request): NextResponse | null {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}
