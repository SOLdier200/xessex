/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

type SameSite = "lax" | "strict" | "none";

function isXessexHost(host: string): boolean {
  const h = host.toLowerCase().split(":")[0]; // strip port
  return h === "xessex.me" || h.endsWith(".xessex.me");
}

/**
 * Returns cookie options based on the actual request host.
 * - xessex.me / *.xessex.me → Domain=.xessex.me, SameSite=None, Secure=true
 * - localhost / other → host-only cookie, SameSite=Lax, Secure=false
 */
export function cookieOptionsForHost(host: string) {
  const prodHost = isXessexHost(host);

  const secure = prodHost;
  const sameSite: SameSite = prodHost ? "none" : "lax";
  const domain = prodHost ? ".xessex.me" : undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    ...(domain ? { domain } : {}),
  } as const;
}

/**
 * Legacy: Returns cookie options based on NODE_ENV (used when host is not available).
 * Prefer cookieOptionsForHost() when you have access to the request host.
 */
export function getAuthCookieBaseOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as SameSite,
    path: "/",
    ...(isProd ? { domain: ".xessex.me" } : {}),
  };
}

/**
 * Host-only cookie options (no domain attribute).
 */
export function getAuthCookieHostOnlyOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as SameSite,
    path: "/",
  };
}

export function clearCookieOnResponse(res: NextResponse, name: string, host?: string) {
  const base = host ? cookieOptionsForHost(host) : getAuthCookieBaseOptions();
  res.cookies.set(name, "", { ...base, expires: new Date(0) });

  // Also clear host-only variant if we set a domain cookie
  if ("domain" in base) {
    const hostOnly = host
      ? { httpOnly: true, secure: base.secure, sameSite: base.sameSite, path: "/" }
      : getAuthCookieHostOnlyOptions();
    res.cookies.set(name, "", { ...hostOnly, expires: new Date(0) });
  }
}

// For Server Actions / Server Components (no host available, uses NODE_ENV fallback)
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  const base = getAuthCookieBaseOptions();
  const hostOnly = getAuthCookieHostOnlyOptions();

  // Clear both variants first to avoid stale cookie precedence issues
  cookieStore.set(COOKIE_NAME, "", { ...base, expires: new Date(0) });
  cookieStore.set(COOKIE_NAME, "", { ...hostOnly, expires: new Date(0) });

  // Set only the chosen base cookie
  cookieStore.set(COOKIE_NAME, token, { ...base, expires: expiresAt });
}

// For Route Handlers - sets cookie directly on response object
export function setSessionCookieOnResponse(res: NextResponse, token: string, expiresAt: Date, host?: string) {
  // Clear both variants first to avoid stale cookie precedence issues
  clearCookieOnResponse(res, COOKIE_NAME, host);

  const base = host ? cookieOptionsForHost(host) : getAuthCookieBaseOptions();
  res.cookies.set(COOKIE_NAME, token, { ...base, expires: expiresAt });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const base = getAuthCookieBaseOptions();
  cookieStore.set(COOKIE_NAME, "", { ...base, expires: new Date(0) });
  if ("domain" in base) {
    const hostOnly = getAuthCookieHostOnlyOptions();
    cookieStore.set(COOKIE_NAME, "", { ...hostOnly, expires: new Date(0) });
  }
}
