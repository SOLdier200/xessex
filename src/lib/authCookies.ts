/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

// Determine if we're on a real production domain (not localhost)
const SITE_URL = process.env.SITE_URL || "";
const isRealProduction = SITE_URL.includes("xessex.me");

// Share cookies across apex + www (only on real production domain)
const COOKIE_DOMAIN = isRealProduction ? ".xessex.me" : undefined;

const BASE = {
  httpOnly: true,
  secure: SITE_URL.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
  domain: COOKIE_DOMAIN,
};

// For Server Actions / Server Components
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    ...BASE,
    expires: expiresAt,
  });
}

// For Route Handlers - sets cookie directly on response object
export function setSessionCookieOnResponse(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(COOKIE_NAME, token, {
    ...BASE,
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    ...BASE,
    expires: new Date(0),
  });
}
