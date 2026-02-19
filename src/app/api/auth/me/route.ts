/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { signR2GetUrl } from "@/lib/r2";
import { db } from "@/lib/prisma";
import { getXessAtomicBalance } from "@/lib/xessBalance";
import { getTierFromBalance } from "@/lib/specialCredits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  const access = await getAccessContext();

  // Not logged in
  if (!access.user) {
    return NextResponse.json(
      {
        ok: true,
        authed: false,
        user: null,

        // Permissions (defaults for unauthenticated)
        canComment: false,
        canRateStars: false,
        canVoteComments: false,

        // Wallet status
        hasWallet: false,
        walletAddress: null,

        // Credit balance
        creditBalance: 0,

        // Role
        isAdminOrMod: false,
      },
      { headers: noCache }
    );
  }

  const u = access.user;

  // Compute tier from live on-chain balance; fall back to DB snapshot if RPC fails
  let xessTier = 0;
  const xessWallet = u.walletAddress;
  if (xessWallet) {
    const liveBalance = await getXessAtomicBalance(xessWallet);
    let balanceAtomic = liveBalance ?? 0n;

    if (liveBalance === null || liveBalance === 0n) {
      const latestSnapshot = await db.walletBalanceSnapshot.findFirst({
        where: { userId: u.id },
        orderBy: { createdAt: "desc" },
        select: { tier: true, balanceAtomic: true },
      });
      if (latestSnapshot && BigInt(latestSnapshot.balanceAtomic) > 0n) {
        balanceAtomic = BigInt(latestSnapshot.balanceAtomic);
      }
    }

    xessTier = getTierFromBalance(balanceAtomic);
  }

  // Get avatar URL if user has a profile picture
  let avatarUrl: string | null = null;
  if (u.profilePictureKey) {
    try {
      avatarUrl = await signR2GetUrl(u.profilePictureKey, 3600);
    } catch {
      // Silent fail - avatar just won't display
    }
  }

  return NextResponse.json(
    {
      ok: true,
      authed: true,

      user: {
        id: u.id,
        memberId: u.memberId,
        role: u.role,
        createdAt: u.createdAt.toISOString(),

        walletAddress: u.walletAddress,
        username: u.username ?? null,
        avatarUrl,
      },

      // Wallet status
      hasWallet: access.hasWallet,
      walletAddress: access.walletAddress,

      // Credit balance
      creditBalance: access.creditBalance,

      // XESS tier
      xessTier,

      // Permissions
      canComment: access.canComment,
      canRateStars: access.canRateStars,
      canVoteComments: access.canVoteComments,

      // Role
      isAdminOrMod: access.isAdminOrMod,
    },
    { headers: noCache }
  );
}
