/**
 * Twice-Daily XESS Snapshot and Special Credits Accrual
 *
 * POST /api/cron/daily-xess-snapshot-and-credits
 *
 * Debug:
 *  - ?debug=1                 -> per-user logs for all
 *  - ?debug=<userId|wallet>   -> per-user logs only for one
 *  - ?receipts=1              -> include per-user receipt rows in JSON (capped at 500)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { unauthorizedIfBadCron } from "@/lib/cronAuth";
import { getXessAtomicBalances } from "@/lib/xessBalance";
import { getDateKeyPT, raffleWeekInfo } from "@/lib/raffleWeekPT";
import {
  getTierFromBalance,
  calculateTwiceDailyAccrual,
  getDaysInMonth,
  formatCredits,
} from "@/lib/specialCredits";
import { XESS_MULTIPLIER, CREDIT_MICRO } from "@/lib/rewardsConstants";

function getTimeSlot(): "AM" | "PM" {
  const now = new Date();
  const ptTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  return ptTime.getHours() < 12 ? "AM" : "PM";
}

const CreditReason = {
  DAILY_ACCRUAL: "DAILY_ACCRUAL",
  RAFFLE_BUY: "RAFFLE_BUY",
  RAFFLE_WIN: "RAFFLE_WIN",
  ADMIN_GRANT: "ADMIN_GRANT",
} as const;

function shouldDebug(req: NextRequest, wallet: string, userId: string): boolean {
  const v = req.nextUrl.searchParams.get("debug");
  if (!v) return false;
  if (v === "1" || v.toLowerCase() === "true") return true;
  return v === wallet || v === userId;
}

type ReceiptRow = {
  userId: string;
  wallet: string;
  dateKey: string;
  timeSlot: "AM" | "PM";
  weekKey: string;
  balanceXess: string;
  tier: number;
  snapshot: "created" | "updated" | "unchanged" | "rpc_null";
  credit:
    | "awarded"
    | "skip_tier0"
    | "skip_already_processed"
    | "skip_zero_accrual"
    | "skip_rpc_null"
    | "error";
  accrualMicro?: string;
  accrualCreditsFormatted?: string;
  carryInMicro?: string;
  carryOutMicro?: string;
  refId?: string;
  note?: string;
};

export async function POST(req: NextRequest) {
  const denied = unauthorizedIfBadCron(req);
  if (denied) return denied;

  const startTime = Date.now();
  const includeReceipts = req.nextUrl.searchParams.get("receipts") === "1";

  let snapshotsCreated = 0;
  let snapshotsUpdated = 0;
  let snapshotsUnchanged = 0;
  let snapshotsRpcNull = 0;

  let creditsAwardedCount = 0;
  let creditsAccruedMicro = 0n;

  let creditsSkipTier0 = 0;
  let creditsSkipAlreadyProcessed = 0;
  let creditsSkipZeroAccrual = 0;
  let creditsSkipRpcNull = 0;
  let userErrorsCount = 0;

  const receipts: ReceiptRow[] = [];

  try {
    const now = new Date();
    const dateKey = getDateKeyPT(now);
    const { weekKey } = raffleWeekInfo(now);
    const timeSlot = getTimeSlot();

    const [year, month] = dateKey.split("-").map(Number);
    const daysInMonth = getDaysInMonth(year, month);

    console.log(
      `[TWICE_DAILY_SNAPSHOT] Running dateKey=${dateKey} slot=${timeSlot} weekKey=${weekKey} daysInMonth=${daysInMonth} CREDIT_MICRO=${CREDIT_MICRO.toString()}`
    );

    const usersWithWallets = await db.user.findMany({
      where: { walletAddress: { not: null } },
      select: { id: true, walletAddress: true },
    });

    console.log(
      `[DAILY_SNAPSHOT] Found ${usersWithWallets.length} users with wallets`
    );

    if (usersWithWallets.length === 0) {
      return NextResponse.json({
        ok: true,
        dateKey,
        timeSlot,
        weekKey,
        usersProcessed: 0,
        snapshot: { created: 0, updated: 0, unchanged: 0, rpcNull: 0 },
        credits: {
          awardedCount: 0,
          accruedMicro: "0",
          accruedCreditsFormatted: "0",
          skips: { tier0: 0, alreadyProcessed: 0, zeroAccrual: 0, rpcNull: 0 },
        },
        errorsCount: 0,
        elapsed: Date.now() - startTime,
        receipts: includeReceipts ? [] : undefined,
      });
    }

    const walletToUser = new Map<string, string>();
    const wallets: string[] = [];
    for (const u of usersWithWallets) {
      const w = u.walletAddress!;
      walletToUser.set(w, u.id);
      wallets.push(w);
    }

    console.log(
      `[DAILY_SNAPSHOT] Fetching balances for ${wallets.length} wallets...`
    );
    const balances = await getXessAtomicBalances(wallets);

    for (const wallet of wallets) {
      const userId = walletToUser.get(wallet)!;
      const debug = shouldDebug(req, wallet, userId);
      const balanceAtomic = balances.get(wallet);

      if (balanceAtomic === null || balanceAtomic === undefined) {
        snapshotsRpcNull++;
        creditsSkipRpcNull++;

        if (debug) {
          console.warn(
            `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] RPC balance missing -> skip`
          );
        }

        if (includeReceipts && receipts.length < 500) {
          receipts.push({
            userId,
            wallet,
            dateKey,
            timeSlot,
            weekKey,
            balanceXess: "0",
            tier: 0,
            snapshot: "rpc_null",
            credit: "skip_rpc_null",
            note: "RPC balance null/undefined",
          });
        }
        continue;
      }

      const tier = getTierFromBalance(balanceAtomic);
      const balanceXess = (balanceAtomic / XESS_MULTIPLIER).toString();

      if (debug) {
        console.log(
          `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] balanceXess=${balanceXess} tier=${tier}`
        );
      }

      try {
        // ── Snapshot ──
        const existingSnapshot = await db.walletBalanceSnapshot.findUnique({
          where: { wallet_dateKey: { wallet, dateKey } },
        });

        let priorTier: number | undefined = existingSnapshot?.tier;
        if (priorTier === undefined) {
          const lastSnapshot = await db.walletBalanceSnapshot.findFirst({
            where: { wallet },
            orderBy: { dateKey: "desc" },
            select: { tier: true },
          });
          priorTier = lastSnapshot?.tier;
        }

        let snapshotStatus: ReceiptRow["snapshot"] = "unchanged";

        if (!existingSnapshot) {
          await db.walletBalanceSnapshot.create({
            data: { wallet, dateKey, weekKey, balanceAtomic, tier, userId },
          });
          snapshotsCreated++;
          snapshotStatus = "created";
        } else if (
          existingSnapshot.balanceAtomic !== balanceAtomic ||
          existingSnapshot.tier !== tier
        ) {
          await db.walletBalanceSnapshot.update({
            where: { id: existingSnapshot.id },
            data: { balanceAtomic, tier, weekKey },
          });
          snapshotsUpdated++;
          snapshotStatus = "updated";
        } else {
          snapshotsUnchanged++;
        }

        const tierChanged = priorTier !== undefined && priorTier !== tier;
        const tierDowngraded = priorTier !== undefined && priorTier > tier;

        // ── Tier 0 → no credits ──
        if (tier === 0) {
          creditsSkipTier0++;

          if (tierDowngraded) {
            const existingAccount = await db.specialCreditAccount.findUnique({
              where: { userId },
            });
            if (existingAccount && existingAccount.carryMicro !== 0n) {
              await db.specialCreditAccount.update({
                where: { id: existingAccount.id },
                data: { carryMicro: 0n },
              });
            }
          }

          if (debug) {
            console.log(
              `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] credits SKIP tier=0`
            );
          }

          if (includeReceipts && receipts.length < 500) {
            receipts.push({
              userId,
              wallet,
              dateKey,
              timeSlot,
              weekKey,
              balanceXess,
              tier,
              snapshot: snapshotStatus,
              credit: "skip_tier0",
            });
          }
          continue;
        }

        // ── Get/create account ──
        let account = await db.specialCreditAccount.findUnique({
          where: { userId },
        });
        if (!account) {
          account = await db.specialCreditAccount.create({
            data: { userId, balanceMicro: 0n, carryMicro: 0n },
          });
        }

        // ── Idempotency check ──
        const refId = `${userId}:${dateKey}:${timeSlot}`;
        const existingLedger = await db.specialCreditLedger.findUnique({
          where: {
            refType_refId: { refType: CreditReason.DAILY_ACCRUAL, refId },
          },
          select: { id: true, amountMicro: true },
        });

        if (existingLedger) {
          creditsSkipAlreadyProcessed++;

          if (debug) {
            console.log(
              `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] credits SKIP alreadyProcessed refId=${refId}`
            );
          }

          if (tierChanged && account.carryMicro !== 0n) {
            await db.specialCreditAccount.update({
              where: { id: account.id },
              data: { carryMicro: 0n },
            });
          }

          if (includeReceipts && receipts.length < 500) {
            receipts.push({
              userId,
              wallet,
              dateKey,
              timeSlot,
              weekKey,
              balanceXess,
              tier,
              snapshot: snapshotStatus,
              credit: "skip_already_processed",
              refId,
              note: `Existing amountMicro=${existingLedger.amountMicro.toString()}`,
            });
          }
          continue;
        }

        // ── Calculate accrual ──
        const carryIn = tierChanged ? 0n : account.carryMicro;
        const { accrualMicro, newCarryMicro } = calculateTwiceDailyAccrual(
          tier,
          carryIn,
          daysInMonth
        );

        if (debug) {
          console.log(
            `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] calc carryIn=${carryIn.toString()} accrualMicro=${accrualMicro.toString()} carryOut=${newCarryMicro.toString()}`
          );
        }

        if (accrualMicro === 0n) {
          creditsSkipZeroAccrual++;

          if (includeReceipts && receipts.length < 500) {
            receipts.push({
              userId,
              wallet,
              dateKey,
              timeSlot,
              weekKey,
              balanceXess,
              tier,
              snapshot: snapshotStatus,
              credit: "skip_zero_accrual",
              refId,
              accrualMicro: "0",
              note: "accrualMicro=0 (unexpected for tier>0)",
            });
          }
          continue;
        }

        // ── Award credits ──
        const newBalance = account.balanceMicro + accrualMicro;

        await db.$transaction([
          db.specialCreditAccount.update({
            where: { id: account.id },
            data: { balanceMicro: newBalance, carryMicro: newCarryMicro },
          }),
          db.specialCreditLedger.create({
            data: {
              userId,
              weekKey,
              amountMicro: accrualMicro,
              reason: `Tier ${tier} ${timeSlot} accrual for ${dateKey}`,
              refType: CreditReason.DAILY_ACCRUAL,
              refId,
            },
          }),
        ]);

        creditsAccruedMicro += accrualMicro;
        creditsAwardedCount++;

        if (debug) {
          console.log(
            `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] AWARD +${accrualMicro.toString()} micro (${formatCredits(accrualMicro)} credits) newBalance=${newBalance.toString()}`
          );
        }

        if (includeReceipts && receipts.length < 500) {
          receipts.push({
            userId,
            wallet,
            dateKey,
            timeSlot,
            weekKey,
            balanceXess,
            tier,
            snapshot: snapshotStatus,
            credit: "awarded",
            refId,
            accrualMicro: accrualMicro.toString(),
            accrualCreditsFormatted: formatCredits(accrualMicro),
            carryInMicro: carryIn.toString(),
            carryOutMicro: newCarryMicro.toString(),
          });
        }
      } catch (err) {
        userErrorsCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[TWICE_DAILY_SNAPSHOT][${userId}][${wallet}] ERROR ${errMsg}`
        );

        if (includeReceipts && receipts.length < 500) {
          receipts.push({
            userId,
            wallet,
            dateKey,
            timeSlot,
            weekKey,
            balanceXess,
            tier,
            snapshot: "unchanged",
            credit: "error",
            note: errMsg,
          });
        }
      }
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `[TWICE_DAILY_SNAPSHOT] Snapshot (${timeSlot}): created=${snapshotsCreated} updated=${snapshotsUpdated} unchanged=${snapshotsUnchanged} rpcNull=${snapshotsRpcNull}`
    );
    console.log(
      `[TWICE_DAILY_SNAPSHOT] Credits (${timeSlot}): awarded=${creditsAwardedCount} accruedMicro=${creditsAccruedMicro.toString()} (${formatCredits(creditsAccruedMicro)} credits) skips={tier0:${creditsSkipTier0}, already:${creditsSkipAlreadyProcessed}, zero:${creditsSkipZeroAccrual}, rpcNull:${creditsSkipRpcNull}} errors=${userErrorsCount} elapsed=${elapsed}ms`
    );

    return NextResponse.json({
      ok: true,
      dateKey,
      timeSlot,
      weekKey,
      usersProcessed: wallets.length,
      snapshot: {
        created: snapshotsCreated,
        updated: snapshotsUpdated,
        unchanged: snapshotsUnchanged,
        rpcNull: snapshotsRpcNull,
      },
      credits: {
        awardedCount: creditsAwardedCount,
        accruedMicro: creditsAccruedMicro.toString(),
        accruedCreditsFormatted: formatCredits(creditsAccruedMicro),
        skips: {
          tier0: creditsSkipTier0,
          alreadyProcessed: creditsSkipAlreadyProcessed,
          zeroAccrual: creditsSkipZeroAccrual,
          rpcNull: creditsSkipRpcNull,
        },
      },
      errorsCount: userErrorsCount,
      elapsed,
      receipts: includeReceipts ? receipts : undefined,
    });
  } catch (error) {
    console.error("[TWICE_DAILY_SNAPSHOT] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
