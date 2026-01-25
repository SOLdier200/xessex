/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

// Determine if we're on a real production domain (not localhost)
const SITE_URL = process.env.SITE_URL || "";
const IS_PROD = SITE_URL.includes("xessex.me");

// Share cookies across apex + www (only on real production domain)
const COOKIE_DOMAIN = IS_PROD ? ".xessex.me" : undefined;

// iOS in-app browsers (Phantom) drop SameSite=None cookies as "third-party-ish"
// Host-only + Lax is most reliable for iOS WebViews
const BASE = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,   // Lax works better in iOS in-app browsers
  path: "/",
  // domain: COOKIE_DOMAIN,   // REMOVED: host-only cookies are most reliable on iOS
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
