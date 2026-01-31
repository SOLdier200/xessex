/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";

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
      },

      // Wallet status
      hasWallet: access.hasWallet,
      walletAddress: access.walletAddress,

      // Credit balance
      creditBalance: access.creditBalance,

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
