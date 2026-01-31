/**
 * Admin endpoint to backfill Special Credits for missed days
 *
 * POST /api/admin/backfill-credits
 * Body: { wallet: string, days: number }
 *
 * This will:
 * 1. Look up the user by wallet
 * 2. Get their current on-chain XESS balance
 * 3. Calculate what tier they're in
 * 4. Accrue credits for the specified number of past days
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireUser, requireAdminOrMod } from "@/lib/auth";
import { getXessAtomicBalance } from "@/lib/xessBalance";
import {
  getTierFromBalance,
  calculateDailyAccrual,
  getDaysInMonth,
} from "@/lib/specialCredits";
import { CREDIT_MICRO, XESS_MULTIPLIER } from "@/lib/rewardsConstants";
import { getDateKeyPT, raffleWeekInfo } from "@/lib/raffleWeekPT";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    requireAdminOrMod(user);

    const body = await req.json();
    const { wallet, days } = body;

    if (!wallet) {
      return NextResponse.json({ ok: false, error: "wallet required" }, { status: 400 });
    }

    const numDays = Math.min(Math.max(1, Number(days) || 7), 30); // 1-30 days

    // Find user by wallet
    const dbUser = await db.user.findFirst({
      where: {
        walletAddress: wallet,
      },
      include: {
        specialCreditAccount: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ ok: false, error: "User not found for wallet" }, { status: 404 });
    }

    // Get on-chain balance and calculate tier
    const balanceAtomic = await getXessAtomicBalance(wallet);
    const tier = getTierFromBalance(balanceAtomic);

    if (tier === 0) {
      return NextResponse.json({
        ok: false,
        error: "User is tier 0 (below minimum balance for credits)",
        balanceXess: Number(balanceAtomic / XESS_MULTIPLIER),
      });
    }

    // Get or create SpecialCreditAccount
    let account = dbUser.specialCreditAccount;
    if (!account) {
      account = await db.specialCreditAccount.create({
        data: { userId: dbUser.id, balanceMicro: 0n, carryMicro: 0n },
      });
    }

    const results: { dateKey: string; accrued: boolean; dailyMicro?: string; reason?: string }[] = [];
    let totalAccrued = 0n;
    let currentCarry = account.carryMicro;

    // Process each day going backwards
    for (let i = 0; i < numDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      const dateKey = getDateKeyPT(date);
      const { weekKey } = raffleWeekInfo(date);
      const [year, month] = dateKey.split("-").map(Number);
      const daysInMonth = getDaysInMonth(year, month);

      // Check if already accrued
      const refId = `${dbUser.id}:${dateKey}`;
      const existingLedger = await db.specialCreditLedger.findUnique({
        where: { refType_refId: { refType: "DAILY_ACCRUAL", refId } },
      });

      if (existingLedger) {
        results.push({ dateKey, accrued: false, reason: "already_accrued" });
        continue;
      }

      // Calculate daily accrual
      const { dailyMicro, newCarryMicro } = calculateDailyAccrual(tier, currentCarry, daysInMonth);

      if (dailyMicro === 0n) {
        results.push({ dateKey, accrued: false, reason: "zero_accrual" });
        continue;
      }

      // Create ledger entry and snapshot
      await db.$transaction([
        db.specialCreditLedger.create({
          data: {
            userId: dbUser.id,
            weekKey,
            amountMicro: dailyMicro,
            reason: `Backfill Tier ${tier} daily accrual for ${dateKey}`,
            refType: "DAILY_ACCRUAL",
            refId,
          },
        }),
        db.walletBalanceSnapshot.upsert({
          where: { wallet_dateKey: { wallet, dateKey } },
          create: {
            wallet,
            dateKey,
            weekKey,
            balanceAtomic,
            tier,
            userId: dbUser.id,
          },
          update: {},
        }),
      ]);

      totalAccrued += dailyMicro;
      currentCarry = newCarryMicro;

      results.push({ dateKey, accrued: true, dailyMicro: dailyMicro.toString() });
    }

    // Update account balance with total accrued
    if (totalAccrued > 0n) {
      const newBalance = account.balanceMicro + totalAccrued;
      await db.specialCreditAccount.update({
        where: { id: account.id },
        data: {
          balanceMicro: newBalance,
          carryMicro: currentCarry,
        },
      });
    }

    // Refetch account for final balance
    const updatedAccount = await db.specialCreditAccount.findUnique({
      where: { userId: dbUser.id },
    });

    return NextResponse.json({
      ok: true,
      wallet,
      userId: dbUser.id,
      tier,
      balanceXess: Number(balanceAtomic / XESS_MULTIPLIER),
      daysProcessed: numDays,
      totalAccruedMicro: totalAccrued.toString(),
      totalAccruedCredits: Number(totalAccrued / CREDIT_MICRO),
      finalBalance: {
        balanceMicro: updatedAccount?.balanceMicro?.toString() ?? "0",
        balance: Number((updatedAccount?.balanceMicro ?? 0n) / CREDIT_MICRO),
      },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("[backfill-credits] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
