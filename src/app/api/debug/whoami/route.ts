import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  const result: Record<string, unknown> = {
    cookieName: COOKIE_NAME,
    cookiePresent: !!token,
    cookiePreview: token ? token.slice(0, 8) + "..." : null,
  };

  if (!token) {
    result.sessionFound = false;
    result.userId = null;
    result.subscription = null;
    result.derivedTier = "free (no cookie)";
    return NextResponse.json(result);
  }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: { include: { subscription: true } },
    },
  });

  if (!session) {
    result.sessionFound = false;
    result.userId = null;
    result.subscription = null;
    result.derivedTier = "free (no session in db)";
    return NextResponse.json(result);
  }

  const sessionExpired = session.expiresAt.getTime() < Date.now();
  result.sessionFound = true;
  result.sessionExpired = sessionExpired;
  result.sessionExpiresAt = session.expiresAt.toISOString();

  if (sessionExpired) {
    result.userId = session.userId;
    result.subscription = null;
    result.derivedTier = "free (session expired)";
    return NextResponse.json(result);
  }

  const user = session.user;
  const sub = user.subscription;

  result.userId = user.id;
  result.userEmail = user.email ?? null;
  result.userWallet = user.walletAddress ?? null;

  if (!sub) {
    result.subscription = null;
    result.derivedTier = "free (no subscription)";
    return NextResponse.json(result);
  }

  result.subscription = {
    tier: sub.tier,
    status: sub.status,
    expiresAt: sub.expiresAt?.toISOString() ?? null,
    expiresAtMs: sub.expiresAt?.getTime() ?? null,
    nowMs: Date.now(),
    isExpired: sub.expiresAt ? sub.expiresAt.getTime() < Date.now() : false,
  };

  const active = isSubscriptionActive(sub);
  result.isSubscriptionActive = active;

  if (!active) {
    result.derivedTier = "free (subscription inactive)";
  } else if (sub.tier === "DIAMOND") {
    result.derivedTier = "diamond";
  } else if (sub.tier === "MEMBER") {
    result.derivedTier = "member";
  } else {
    result.derivedTier = "free (unknown tier)";
  }

  return NextResponse.json(result);
}
