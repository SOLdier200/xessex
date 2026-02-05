import { NextRequest, NextResponse } from "next/server";

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
  // Prefer x-forwarded headers (set by Cloudflare/proxies)
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  // Validate host - must not be localhost or contain unexpected ports
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1") && !host.match(/:\d+$/)) {
    return `${proto}://${host}`;
  }

  // Fallback to production URL
  return "https://xessex.me";
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

  res.cookies.set("age_ok", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    domain: ".xessex.me",
    maxAge,
  });

  // Optional: keep if any legacy client code still reads it
  // If AgeGateEnforcer is removed, you can delete this cookie later.
  res.cookies.set("age_verified", "1", {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    domain: ".xessex.me",
    maxAge,
  });

  return res;
}
