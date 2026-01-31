import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

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
    result.authed = false;
    return NextResponse.json(result);
  }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          specialCreditAccount: true,
        },
      },
    },
  });

  if (!session) {
    result.sessionFound = false;
    result.userId = null;
    result.authed = false;
    return NextResponse.json(result);
  }

  const sessionExpired = session.expiresAt.getTime() < Date.now();
  result.sessionFound = true;
  result.sessionExpired = sessionExpired;
  result.sessionExpiresAt = session.expiresAt.toISOString();

  if (sessionExpired) {
    result.userId = session.userId;
    result.authed = false;
    return NextResponse.json(result);
  }

  const user = session.user;

  result.authed = true;
  result.userId = user.id;
  result.walletAddress = user.walletAddress ?? null;
  result.role = user.role;

  // Credit balance
  const creditBalanceMicro = user.specialCreditAccount?.balanceMicro ?? 0n;
  result.creditBalance = Number(creditBalanceMicro / CREDIT_MICRO);
  result.creditBalanceMicro = creditBalanceMicro.toString();

  return NextResponse.json(result);
}
