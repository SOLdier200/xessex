/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * POST /api/cron/expire-provisional
 * Expire PENDING manual payments whose provisional window has passed,
 * and expire PARTIAL subscriptions that have timed out.
 *
 * Run this hourly to clean up provisional access.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();

  try {
    // Find ManualPayments still PENDING but provisionalUntil < now
    const pendingExpired = await db.manualPayment.findMany({
      where: { status: "PENDING", provisionalUntil: { lt: now } },
      select: { id: true, userId: true },
      take: 1000,
    });

    await db.$transaction(async (tx) => {
      // Mark ManualPayments as EXPIRED
      if (pendingExpired.length > 0) {
        await tx.manualPayment.updateMany({
          where: { id: { in: pendingExpired.map((x) => x.id) } },
          data: { status: "EXPIRED" },
        });
      }

      // Expire PARTIAL subscriptions that have timed out
      await tx.subscription.updateMany({
        where: { status: "PARTIAL", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
    });

    return NextResponse.json({
      ok: true,
      manualPaymentsExpired: pendingExpired.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[EXPIRE_PROVISIONAL] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
