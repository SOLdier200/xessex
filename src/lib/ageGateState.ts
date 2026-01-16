/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

"use client";

const AGE_OK_KEY = "__xessexAgeOk";

// Use sessionStorage to persist across page navigations within the same tab/window.
// sessionStorage is cleared when the tab or browser is closed, which is the desired behavior.

export function getAgeGateOk() {
  try {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(AGE_OK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAgeGateOk(value: boolean) {
  try {
    if (typeof window === "undefined") return;
    if (value) {
      sessionStorage.setItem(AGE_OK_KEY, "1");
    } else {
      sessionStorage.removeItem(AGE_OK_KEY);
    }
  } catch {
    // ignore client storage errors
  }
}
