import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

export async function GET() {
  const access = await getAccessContext();
  const noCache = { "Cache-Control": "no-store, no-cache, must-revalidate, private" };

  if (!access.user) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      isAdminOrMod: false,
      canComment: false,
      canVoteComments: false,
      canRateStars: false,
      creditBalance: 0,
    }, { headers: noCache });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    isAdminOrMod: access.isAdminOrMod,
    canComment: access.canComment,
    canVoteComments: access.canVoteComments,
    canRateStars: access.canRateStars,
    creditBalance: access.creditBalance,
    wallet: truncWallet(access.user.walletAddress, null),
  }, { headers: noCache });
}
