"use client";

const AGE_OK_KEY = "__xessexAgeOk";

export function getAgeGateOk() {
  try {
    return (globalThis as Record<string, unknown>)[AGE_OK_KEY] === true;
  } catch {
    return false;
  }
}

export function setAgeGateOk(value: boolean) {
  try {
    (globalThis as Record<string, unknown>)[AGE_OK_KEY] = value;
  } catch {
    // ignore client storage errors
  }
}
