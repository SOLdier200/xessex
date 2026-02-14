import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/rewards/week?weekKey=2026-01-13
 * Returns detailed reward breakdown for a specific week.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const weekKey = req.nextUrl.searchParams.get("weekKey");
  if (!weekKey || !/^\d{4}-\d{2}-\d{2}(-P[12])?$/.test(weekKey)) {
    return NextResponse.json({ ok: false, error: "INVALID_WEEK_KEY" }, { status: 400 });
  }

  // Get all rewards for this week
  const rewards = await db.rewardEvent.findMany({
    where: { userId: user.id, weekKey },
    select: {
      id: true,
      type: true,
      refType: true,
      amount: true,
      status: true,
      createdAt: true,
      paidAt: true,
      claimedAt: true,
      txSig: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by type+pool so Xessex and Embed entries show separately
  const byType: Record<string, { amount: string; status: string; count: number; refType?: string }> = {};

  for (const r of rewards) {
    // Use refType pool prefix to distinguish pool-specific rewards
    let key: string = r.type;
    if (r.refType?.startsWith("xessex:")) key = `${r.type}:xessex`;
    else if (r.refType?.startsWith("embed:")) key = `${r.type}:embed`;

    const userStatus = r.claimedAt ? "CLAIMED" : r.status === "PAID" ? "PENDING_CLAIM" : r.status;

    if (!byType[key]) {
      byType[key] = { amount: "0", status: userStatus, count: 0, refType: r.refType ?? undefined };
    }
    byType[key].amount = (BigInt(byType[key].amount) + r.amount).toString();
    byType[key].count++;
    // If any reward is not yet claimed, mark the type as not claimed
    if (userStatus !== "CLAIMED") {
      byType[key].status = userStatus;
    }
  }

  // Calculate totals — "paid" means actually claimed by user (claimedAt set)
  const total = rewards.reduce((sum, r) => sum + r.amount, 0n);
  const claimed = rewards
    .filter((r) => r.claimedAt !== null)
    .reduce((sum, r) => sum + r.amount, 0n);
  const pending = total - claimed;

  return NextResponse.json({
    ok: true,
    weekKey,
    rewards: rewards.map((r) => ({
      id: r.id,
      type: r.type,
      refType: r.refType,
      amount: r.amount.toString(),
      status: r.claimedAt ? "CLAIMED" : r.status === "PAID" ? "PENDING_CLAIM" : r.status,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
      claimedAt: r.claimedAt?.toISOString() ?? null,
      txSig: r.txSig,
    })),
    byType,
    totals: {
      total: total.toString(),
      pending: pending.toString(),
      paid: claimed.toString(),
    },
  });
}
