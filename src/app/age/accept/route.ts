import { NextRequest, NextResponse } from "next/server";
import { cookieOptionsForHost } from "@/lib/authCookies";

export const runtime = "nodejs";

function sanitizeNext(nextValue: string | null | undefined) {
  if (!nextValue) return "/";
  // only allow same-origin relative paths
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  if (nextValue.startsWith("/age")) return "/";
  return nextValue;
}

/**
 * Safely derive the origin from request headers.
 * Some in-app browsers (Backpack, etc.) may have malformed req.url
 */
function getOrigin(req: NextRequest): string {
  return req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const nextRaw = form.get("next");
  const next = sanitizeNext(typeof nextRaw === "string" ? nextRaw : null);

  // Build redirect URL safely (don't rely on req.url which can be malformed in some browsers)
  const origin = getOrigin(req);
  const res = NextResponse.redirect(new URL(next, origin), 303);

  // Keep SameSite=None for iOS wallet deep-link returns
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const cookieBase = cookieOptionsForHost(host);

  res.cookies.set("age_ok", "1", {
    ...cookieBase,
    maxAge,
  });

  // Optional: keep if any legacy client code still reads it
  // If AgeGateEnforcer is removed, you can delete this cookie later.
  res.cookies.set("age_verified", "1", {
    ...cookieBase,
    maxAge,
  });

  return res;
}
