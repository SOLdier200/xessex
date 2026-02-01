/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

"use client";

const AGE_OK_KEY = "__xessexAgeOk";
const AGE_OK_COOKIE = "age_ok";
const AGE_VERIFIED_COOKIE = "age_verified";
// TTL in seconds: 6 hours for compliance without being too intrusive
const AGE_COOKIE_MAX_AGE_SECONDS = 21600;

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(prefix)) {
      return decodeURIComponent(cookie.slice(prefix.length));
    }
  }
  return null;
}

function getCookieDomain(): string {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  // Don't set domain for localhost or IP addresses
  if (hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return "";
  }
  // Use parent domain for xessex.me and subdomains
  if (hostname.endsWith("xessex.me")) {
    return "; Domain=.xessex.me";
  }
  return "";
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const isHttps = window.location.protocol === "https:";
  // Use SameSite=None for wallet in-app browsers (requires Secure)
  const sameSite = isHttps ? "None" : "Lax";
  const secure = isHttps ? "; Secure" : "";
  const domain = getCookieDomain();
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=${sameSite}${secure}${domain}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  const isHttps = window.location.protocol === "https:";
  const sameSite = isHttps ? "None" : "Lax";
  const secure = isHttps ? "; Secure" : "";
  const domain = getCookieDomain();
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=${sameSite}${secure}${domain}`;
}

function isTruthyCookie(value: string | null) {
  return value === "1" || value === "true";
}

// Use sessionStorage to persist across page navigations within the same tab/window.
// sessionStorage is cleared when the tab or browser is closed, which is the desired behavior.

export function getAgeGateOk() {
  try {
    if (typeof window === "undefined") return false;
    if (sessionStorage.getItem(AGE_OK_KEY) === "1") return true;

    const cookieOk =
      isTruthyCookie(readCookie(AGE_OK_COOKIE)) ||
      isTruthyCookie(readCookie(AGE_VERIFIED_COOKIE));

    if (cookieOk) {
      sessionStorage.setItem(AGE_OK_KEY, "1");
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function setAgeGateOk(value: boolean) {
  try {
    if (typeof window === "undefined") return;
    if (value) {
      sessionStorage.setItem(AGE_OK_KEY, "1");
      writeCookie(AGE_OK_COOKIE, "1", AGE_COOKIE_MAX_AGE_SECONDS);
      writeCookie(AGE_VERIFIED_COOKIE, "1", AGE_COOKIE_MAX_AGE_SECONDS);
    } else {
      sessionStorage.removeItem(AGE_OK_KEY);
      clearCookie(AGE_OK_COOKIE);
      clearCookie(AGE_VERIFIED_COOKIE);
    }
  } catch {
    // ignore client storage errors
  }
}
