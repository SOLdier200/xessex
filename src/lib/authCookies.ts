/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

type SameSite = "lax" | "strict" | "none";

function parseSameSite(value: string | undefined, fallback: SameSite): SameSite {
  const v = (value || "").toLowerCase().trim();
  if (v === "lax" || v === "strict" || v === "none") return v;
  return fallback;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

// Determine if we're on a real production domain (not localhost)
const SITE_URL = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
const IS_PROD = process.env.NODE_ENV === "production" || SITE_URL.includes("xessex.me");

// Defaults (override via env if needed)
const DEFAULT_DOMAIN = IS_PROD ? ".xessex.me" : undefined;
const DEFAULT_SAMESITE: SameSite = IS_PROD ? "none" : "lax";

const COOKIE_DOMAIN = (process.env.AUTH_COOKIE_DOMAIN || DEFAULT_DOMAIN || "").trim() || undefined;
const COOKIE_SAMESITE = parseSameSite(process.env.AUTH_COOKIE_SAMESITE, DEFAULT_SAMESITE);
const COOKIE_SECURE = parseBool(process.env.AUTH_COOKIE_SECURE, IS_PROD);

const BASE_HOST_ONLY = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAMESITE,
  path: "/",
};

const BASE = COOKIE_DOMAIN ? { ...BASE_HOST_ONLY, domain: COOKIE_DOMAIN } : BASE_HOST_ONLY;

export function getAuthCookieBaseOptions() {
  return { ...BASE };
}

export function getAuthCookieHostOnlyOptions() {
  return { ...BASE_HOST_ONLY };
}

export function clearCookieOnResponse(res: NextResponse, name: string) {
  const base = getAuthCookieBaseOptions();
  res.cookies.set(name, "", { ...base, expires: new Date(0) });
  if (base.domain) {
    const hostOnly = getAuthCookieHostOnlyOptions();
    res.cookies.set(name, "", { ...hostOnly, expires: new Date(0) });
  }
}

// For Server Actions / Server Components
export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  const base = getAuthCookieBaseOptions();
  cookieStore.set(COOKIE_NAME, token, { ...base, expires: expiresAt });
  if (base.domain) {
    const hostOnly = getAuthCookieHostOnlyOptions();
    cookieStore.set(COOKIE_NAME, "", { ...hostOnly, expires: new Date(0) });
  }
}

// For Route Handlers - sets cookie directly on response object
export function setSessionCookieOnResponse(res: NextResponse, token: string, expiresAt: Date) {
  const base = getAuthCookieBaseOptions();
  res.cookies.set(COOKIE_NAME, token, { ...base, expires: expiresAt });
  if (base.domain) {
    const hostOnly = getAuthCookieHostOnlyOptions();
    res.cookies.set(COOKIE_NAME, "", { ...hostOnly, expires: new Date(0) });
  }
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  const base = getAuthCookieBaseOptions();
  cookieStore.set(COOKIE_NAME, "", { ...base, expires: new Date(0) });
  if (base.domain) {
    const hostOnly = getAuthCookieHostOnlyOptions();
    cookieStore.set(COOKIE_NAME, "", { ...hostOnly, expires: new Date(0) });
  }
}
