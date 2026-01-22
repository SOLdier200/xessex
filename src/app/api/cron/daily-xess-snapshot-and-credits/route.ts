/**
 * Daily XESS Snapshot and Special Credits Accrual
 *
 * POST /api/cron/daily-xess-snapshot-and-credits
 *
 * This cron job runs daily and:
 * 1. Fetches XESS balances for all users with linked wallets
 * 2. Creates WalletBalanceSnapshot records
 * 3. Calculates tier from balance
 * 4. Accrues daily special credits based on tier
 *
 * Idempotent: Re-running for the same dateKey will not create duplicate entries.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getXessAtomicBalances } from "@/lib/xessBalance";
import { getDateKeyPT, raffleWeekInfo } from "@/lib/raffleWeekPT";
import {
  getTierFromBalance,
  calculateDailyAccrual,
  getDaysInMonth,
} from "@/lib/specialCredits";

const CRON_SECRET = process.env.CRON_SECRET || "";

const CreditReason = {
  DAILY_ACCRUAL: "DAILY_ACCRUAL",
  RAFFLE_BUY: "RAFFLE_BUY",
  RAFFLE_WIN: "RAFFLE_WIN",
  ADMIN_GRANT: "ADMIN_GRANT",
} as const;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Get current date info in PT timezone
    const now = new Date();
    const dateKey = getDateKeyPT(now);
    const { weekKey } = raffleWeekInfo(now);

    // Parse dateKey to get year and month for days calculation
    const [year, month] = dateKey.split("-").map(Number);
    const daysInMonth = getDaysInMonth(year, month);

    console.log(`[DAILY_SNAPSHOT] Running for dateKey=${dateKey}, weekKey=${weekKey}`);

    // Find all users with linked solWallet
    const usersWithWallets = await db.user.findMany({
      where: { solWallet: { not: null } },
      select: { id: true, solWallet: true },
    });

    console.log(`[DAILY_SNAPSHOT] Found ${usersWithWallets.length} users with wallets`);

    if (usersWithWallets.length === 0) {
      return NextResponse.json({
        ok: true,
        dateKey,
        weekKey,
        usersProcessed: 0,
        snapshotsCreated: 0,
        creditsAccrued: 0,
        elapsed: Date.now() - startTime,
      });
    }

    // Build wallet -> userId map
    const walletToUser = new Map<string, string>();
    const wallets: string[] = [];
    for (const user of usersWithWallets) {
      if (user.solWallet) {
        walletToUser.set(user.solWallet, user.id);
        wallets.push(user.solWallet);
      }
    }

    // Batch fetch XESS balances
    console.log(`[DAILY_SNAPSHOT] Fetching balances for ${wallets.length} wallets...`);
    const balances = await getXessAtomicBalances(wallets);

    let snapshotsCreated = 0;
    let snapshotsSkipped = 0;
    let creditsAccrued = 0n;
    const errors: string[] = [];

    // Process each user
    for (const wallet of wallets) {
      const userId = walletToUser.get(wallet)!;
      const balanceAtomic = balances.get(wallet) || 0n;
      const tier = getTierFromBalance(balanceAtomic);

      try {
        // Upsert WalletBalanceSnapshot (idempotent by wallet+dateKey)
        const existingSnapshot = await db.walletBalanceSnapshot.findUnique({
          where: { wallet_dateKey: { wallet, dateKey } },
        });

        if (!existingSnapshot) {
          await db.walletBalanceSnapshot.create({
            data: {
              wallet,
              dateKey,
              weekKey,
              balanceAtomic,
              tier,
              userId,
            },
          });
          snapshotsCreated++;
        } else {
          snapshotsSkipped++;
        }

        // Skip credit accrual if tier is 0 (below minimum balance)
        if (tier === 0) continue;

        // Get or create SpecialCreditAccount
        let account = await db.specialCreditAccount.findUnique({
          where: { userId },
        });

        if (!account) {
          account = await db.specialCreditAccount.create({
            data: { userId, balanceMicro: 0n, carryMicro: 0n },
          });
        }

        // Check if already accrued for this date (idempotency)
        const refId = `${userId}:${dateKey}`;
        const existingLedger = await db.specialCreditLedger.findUnique({
          where: { refType_refId: { refType: "daily", refId } },
        });

        if (existingLedger) {
          // Already processed
          continue;
        }

        // Calculate daily accrual
        const { dailyMicro, newCarryMicro } = calculateDailyAccrual(
          tier,
          account.carryMicro,
          daysInMonth
        );

        if (dailyMicro === 0n) continue;

        // Update account and create ledger entry in transaction
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
              userId,
              weekKey,
              amountMicro: dailyMicro,
              reason: `Tier ${tier} daily accrual for ${dateKey}`,
              refType: CreditReason.DAILY_ACCRUAL,
              refId,
            },
          }),
        ]);

        creditsAccrued += dailyMicro;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[DAILY_SNAPSHOT] Error processing user ${userId}:`, errMsg);
        errors.push(`${userId}: ${errMsg}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[DAILY_SNAPSHOT] Complete: ${snapshotsCreated} snapshots created, ` +
        `${snapshotsSkipped} skipped, ${creditsAccrued.toString()} microcredits accrued in ${elapsed}ms`
    );

    return NextResponse.json({
      ok: true,
      dateKey,
      weekKey,
      usersProcessed: wallets.length,
      snapshotsCreated,
      snapshotsSkipped,
      creditsAccruedMicro: creditsAccrued.toString(),
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      elapsed,
    });
  } catch (error) {
    console.error("[DAILY_SNAPSHOT] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
