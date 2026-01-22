import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { truncWallet } from "@/lib/scoring";

export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      tier: "free",
      isDiamond: false,
      isMember: false,
      isAdminOrMod: false,
      canComment: false,
      canVoteComments: false,
      canRateStars: false,
    });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    tier: access.tier,
    isDiamond: access.tier === "diamond",
    isMember: access.tier === "member" || access.tier === "diamond",
    isAdminOrMod: access.isAdminOrMod,
    canComment: access.canComment,
    canVoteComments: access.canVoteComments,
    canRateStars: access.canRateStars,
    wallet: truncWallet(access.user.walletAddress, access.user.email),
  });
}
