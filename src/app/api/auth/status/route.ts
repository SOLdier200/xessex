import { NextResponse } from "next/server";
import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      isDiamond: false,
    });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    isDiamond: isSubscriptionActive(user),
    wallet: user.wallet,
  });
}
