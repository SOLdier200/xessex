/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import crypto from "crypto";

export function makeRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function addMinutes(min: number) {
  return new Date(Date.now() + min * 60 * 1000);
}

export function makeNonce() {
  return crypto.randomBytes(16).toString("hex");
}
