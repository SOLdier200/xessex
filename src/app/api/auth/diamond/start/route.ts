/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 *
 * POST /api/auth/diamond/start
 *
 * Sets the authenticated user's subscription to DIAMOND + PENDING (waiting to be paid).
 * Requires user to be logged in (via /api/auth/verify).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401, headers: noCache }
    );
  }

  // Check if already active Diamond
  if (
    user.subscription?.tier === "DIAMOND" &&
    user.subscription?.status === "ACTIVE" &&
    (!user.subscription?.expiresAt || user.subscription.expiresAt.getTime() > Date.now())
  ) {
    return NextResponse.json(
      { ok: true, alreadyActive: true },
      { headers: noCache }
    );
  }

  // Upsert subscription to DIAMOND + PENDING
  await db.subscription.upsert({
    where: { userId: user.id },
    update: { tier: "DIAMOND", status: "PENDING" },
    create: { userId: user.id, tier: "DIAMOND", status: "PENDING" },
  });

  // Ensure solWallet is set for payout eligibility (wallet-native users)
  if (user.walletAddress && !user.solWallet) {
    await db.user.update({
      where: { id: user.id },
      data: { solWallet: user.walletAddress, solWalletLinkedAt: new Date() },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true }, { headers: noCache });
}
