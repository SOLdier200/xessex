import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET || "";

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
  const authHeader = req.headers.get("x-cron-secret");
  if (!CRON_SECRET || authHeader !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

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
