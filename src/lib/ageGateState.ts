/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

"use client";

const AGE_OK_KEY = "__xessexAgeOk";
const AGE_OK_COOKIE = "age_ok";
const AGE_VERIFIED_COOKIE = "age_verified";
const AGE_COOKIE_MAX_AGE_DAYS = 30;

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

function writeCookie(name: string, value: string, maxAgeDays: number) {
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
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
      writeCookie(AGE_OK_COOKIE, "1", AGE_COOKIE_MAX_AGE_DAYS);
      writeCookie(AGE_VERIFIED_COOKIE, "1", AGE_COOKIE_MAX_AGE_DAYS);
    } else {
      sessionStorage.removeItem(AGE_OK_KEY);
      clearCookie(AGE_OK_COOKIE);
      clearCookie(AGE_VERIFIED_COOKIE);
    }
  } catch {
    // ignore client storage errors
  }
}
