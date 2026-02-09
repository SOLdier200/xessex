import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { unauthorizedIfBadCron } from "@/lib/cronAuth";

// Claims older than 30 minutes are considered stale
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * POST /api/cron/rewards/revert-stale
 * Revert PROCESSING claims older than 30 minutes back to PENDING
 *
 * This should be run periodically (e.g., every 5 minutes) to clean up
 * abandoned claim attempts.
 */
export async function POST(req: NextRequest) {
  // Verify cron secret
  const denied = unauthorizedIfBadCron(req);
  if (denied) return denied;

  try {
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Find and revert stale PROCESSING claims
    const result = await db.rewardEvent.updateMany({
      where: {
        status: "PROCESSING",
        createdAt: { lt: staleThreshold },
      },
      data: { status: "PENDING" },
    });

    return NextResponse.json({
      ok: true,
      revertedCount: result.count,
      staleThreshold: staleThreshold.toISOString(),
    });
  } catch (error) {
    console.error("[REVERT_STALE] Error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
