/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * Wallet Nonce Endpoint - iOS-safe challenge for wallet auth/rehydration
 * Returns a short-lived nonce that must be signed to prove wallet ownership.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noCache = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(req: Request) {
  try {
    const { wallet } = await req.json().catch(() => ({}));
    const w = String(wallet ?? "").trim();

    if (!w) {
      return NextResponse.json(
        { ok: false, error: "missing_wallet" },
        { status: 400, headers: noCache }
      );
    }

    // Generate random nonce (24 bytes = 32 base64url chars)
    const nonce = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Upsert: create or update nonce for this wallet
    await db.walletNonce.upsert({
      where: { wallet: w },
      create: { wallet: w, nonce, expiresAt },
      update: { nonce, expiresAt },
    });

    return NextResponse.json(
      { ok: true, nonce, expiresAt: expiresAt.toISOString() },
      { headers: noCache }
    );
  } catch (err) {
    console.error("wallet/nonce error:", err);
    return NextResponse.json(
      { ok: false, error: "nonce_failed" },
      { status: 500, headers: noCache }
    );
  }
}
