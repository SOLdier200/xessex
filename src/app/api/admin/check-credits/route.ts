/**
 * Admin endpoint to check and debug Special Credits for a wallet
 *
 * GET /api/admin/check-credits?wallet=<address>
 *   - Shows user info, XESS balance, tier, and credit balance
 *
 * POST /api/admin/check-credits
 *   - Body: { wallet: string, action: "accrue" }
 *   - Triggers credit accrual for the user
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { requireUser, requireAdminOrMod } from "@/lib/auth";
import { getXessAtomicBalance, formatXess } from "@/lib/xessBalance";
import {
  getTierFromBalance,
  getTierInfo,
  calculateDailyAccrual,
  getDaysInMonth,
} from "@/lib/specialCredits";
import { CREDIT_MICRO, XESS_MULTIPLIER } from "@/lib/rewardsConstants";
import { getDateKeyPT, raffleWeekInfo } from "@/lib/raffleWeekPT";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    requireAdminOrMod(user);

    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "wallet parameter required" }, { status: 400 });
    }

    // Find user by wallet (either walletAddress or solWallet)
    const dbUser = await db.user.findFirst({
      where: {
        OR: [{ walletAddress: wallet }, { solWallet: wallet }],
      },
      include: {
        specialCreditAccount: true,
      },
    });

    // Get on-chain XESS balance
    const balanceAtomic = await getXessAtomicBalance(wallet);
    const balanceXess = Number(balanceAtomic / XESS_MULTIPLIER);
    const tier = getTierFromBalance(balanceAtomic);
    const tierInfo = getTierInfo(tier);

    // Get snapshots if user exists
    let recentSnapshots: any[] = [];
    let recentLedger: any[] = [];
    if (dbUser) {
      recentSnapshots = await db.walletBalanceSnapshot.findMany({
        where: { wallet },
        orderBy: { dateKey: "desc" },
        take: 7,
      });

      recentLedger = await db.specialCreditLedger.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    }

    const creditBalanceMicro = dbUser?.specialCreditAccount?.balanceMicro ?? 0n;
    const creditBalance = Number(creditBalanceMicro / CREDIT_MICRO);

    return NextResponse.json({
      ok: true,
      wallet,
      onChain: {
        balanceAtomic: balanceAtomic.toString(),
        balanceXess,
        balanceFormatted: formatXess(balanceAtomic),
        tier,
        tierInfo,
      },
      user: dbUser
        ? {
            id: dbUser.id,
            walletAddress: dbUser.walletAddress,
            solWallet: dbUser.solWallet,
            role: dbUser.role,
            createdAt: dbUser.createdAt,
          }
        : null,
      credits: {
        hasAccount: !!dbUser?.specialCreditAccount,
        balanceMicro: creditBalanceMicro.toString(),
        balance: creditBalance,
        carryMicro: dbUser?.specialCreditAccount?.carryMicro?.toString() ?? "0",
      },
      recentSnapshots: recentSnapshots.map((s) => ({
        dateKey: s.dateKey,
        balanceAtomic: s.balanceAtomic.toString(),
        tier: s.tier,
      })),
      recentLedger: recentLedger.map((l) => ({
        createdAt: l.createdAt,
        amountMicro: l.amountMicro.toString(),
        reason: l.reason,
        refType: l.refType,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("[check-credits] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    requireAdminOrMod(user);

    const body = await req.json();
    const { wallet, action } = body;

    if (!wallet) {
      return NextResponse.json({ ok: false, error: "wallet required" }, { status: 400 });
    }

    if (action !== "accrue") {
      return NextResponse.json({ ok: false, error: "action must be 'accrue'" }, { status: 400 });
    }

    // Find user by wallet
    const dbUser = await db.user.findFirst({
      where: {
        OR: [{ walletAddress: wallet }, { solWallet: wallet }],
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

    // Calculate today's accrual
    const now = new Date();
    const dateKey = getDateKeyPT(now);
    const { weekKey } = raffleWeekInfo(now);
    const [year, month] = dateKey.split("-").map(Number);
    const daysInMonth = getDaysInMonth(year, month);

    // Check if already accrued today
    const refId = `${dbUser.id}:${dateKey}`;
    const existingLedger = await db.specialCreditLedger.findUnique({
      where: { refType_refId: { refType: "DAILY_ACCRUAL", refId } },
    });

    if (existingLedger) {
      return NextResponse.json({
        ok: false,
        error: "Already accrued for today",
        dateKey,
        existingAmount: existingLedger.amountMicro.toString(),
      });
    }

    // Calculate and accrue
    const { dailyMicro, newCarryMicro } = calculateDailyAccrual(
      tier,
      account.carryMicro,
      daysInMonth
    );

    const newBalance = account.balanceMicro + dailyMicro;

    await db.$transaction([
      db.specialCreditAccount.update({
        where: { id: account.id },
        data: {
          balanceMicro: newBalance,
          carryMicro: newCarryMicro,
        },
      }),
      db.specialCreditLedger.create({
        data: {
          userId: dbUser.id,
          weekKey,
          amountMicro: dailyMicro,
          reason: `Admin-triggered Tier ${tier} daily accrual for ${dateKey}`,
          refType: "DAILY_ACCRUAL",
          refId,
        },
      }),
      // Also create snapshot if missing
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

    return NextResponse.json({
      ok: true,
      wallet,
      userId: dbUser.id,
      dateKey,
      tier,
      balanceXess: Number(balanceAtomic / XESS_MULTIPLIER),
      accrued: {
        dailyMicro: dailyMicro.toString(),
        dailyCredits: Number(dailyMicro / CREDIT_MICRO),
      },
      newBalance: {
        balanceMicro: newBalance.toString(),
        balance: Number(newBalance / CREDIT_MICRO),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("[check-credits POST] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
