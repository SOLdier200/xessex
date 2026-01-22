/**
 * Redeem Special Credits for Membership
 *
 * POST /api/rewards-drawing/redeem
 *
 * Body: { months: number, tier: "MEMBER" | "DIAMOND" }
 *
 * Spends Special Credits to add membership time.
 *
 * Pricing (example - adjust as needed):
 * - Member: 100 credits/month
 * - Diamond: 200 credits/month
 *
 * Note: Credits have no cash value - this is the ONLY way to use them
 * besides entering the weekly drawing.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

// Credits cost per month (in whole credits)
const MEMBER_CREDITS_PER_MONTH = 100n;
const DIAMOND_CREDITS_PER_MONTH = 200n;

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const userId = ctx.user.id;

  const body = await req.json().catch(() => ({}));
  const months = Number(body?.months);
  const tier = String(body?.tier || "MEMBER").toUpperCase();

  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return NextResponse.json({ ok: false, error: "months_must_be_1_to_12" }, { status: 400 });
  }

  if (tier !== "MEMBER" && tier !== "DIAMOND") {
    return NextResponse.json({ ok: false, error: "tier_must_be_MEMBER_or_DIAMOND" }, { status: 400 });
  }

  const creditsPerMonth = tier === "DIAMOND" ? DIAMOND_CREDITS_PER_MONTH : MEMBER_CREDITS_PER_MONTH;
  const totalCredits = creditsPerMonth * BigInt(months);
  const costMicro = totalCredits * CREDIT_MICRO;

  try {
    const result = await db.$transaction(async (tx) => {
      // Check balance
      const acct = await tx.specialCreditAccount.findUnique({
        where: { userId },
      });

      if (!acct || acct.balanceMicro < costMicro) {
        throw new Error("insufficient_credits");
      }

      // Deduct credits
      await tx.specialCreditAccount.update({
        where: { userId },
        data: { balanceMicro: { decrement: costMicro } },
      });

      // Record in ledger
      await tx.specialCreditLedger.create({
        data: {
          userId,
          weekKey: new Date().toISOString().slice(0, 10), // Today's date
          amountMicro: -costMicro,
          reason: `Redeemed ${totalCredits.toString()} credits for ${months} month(s) ${tier} membership`,
          refType: "MEMBERSHIP_REDEMPTION",
          refId: `${userId}:${tier}:${months}:${Date.now()}`,
        },
      });

      // Get or create subscription
      const existingSub = await tx.subscription.findUnique({
        where: { userId },
      });

      const now = new Date();
      let newExpiresAt: Date;

      if (existingSub && existingSub.status === "ACTIVE" && existingSub.expiresAt && existingSub.expiresAt > now) {
        // Extend from current expiry
        newExpiresAt = new Date(existingSub.expiresAt);
      } else {
        // Start from now
        newExpiresAt = new Date(now);
      }

      // Add months
      newExpiresAt.setMonth(newExpiresAt.getMonth() + months);

      // Upsert subscription
      await tx.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: tier as "MEMBER" | "DIAMOND",
          status: "ACTIVE",
          expiresAt: newExpiresAt,
          cancelAtPeriodEnd: false,
        },
        update: {
          tier: tier as "MEMBER" | "DIAMOND",
          status: "ACTIVE",
          expiresAt: newExpiresAt,
          cancelAtPeriodEnd: false,
        },
      });

      return { newExpiresAt, creditsUsed: totalCredits.toString() };
    });

    return NextResponse.json({
      ok: true,
      expiresAt: result.newExpiresAt.toISOString(),
      creditsUsed: result.creditsUsed,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "insufficient_credits") {
      return NextResponse.json({ ok: false, error: "insufficient_credits" }, { status: 400 });
    }
    throw e;
  }
}

export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx.user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Return pricing info
  return NextResponse.json({
    ok: true,
    pricing: {
      member: { creditsPerMonth: Number(MEMBER_CREDITS_PER_MONTH) },
      diamond: { creditsPerMonth: Number(DIAMOND_CREDITS_PER_MONTH) },
    },
  });
}
