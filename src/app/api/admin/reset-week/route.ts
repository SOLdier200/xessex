/**
 * Admin tool: Reset a week's rewards data for testing.
 * Deletes:
 * - RewardBatch for the weekKey
 * - RewardEvents for the weekKey
 * - ClaimEpoch for the weekKey
 * - ClaimLeaf for the weekKey
 *
 * Protected by admin auth. Set ALLOW_RESET_WEEK=1 to enable.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { weekKeyUTC } from "@/lib/weekKey";

/**
 * Normalize weekKey to Monday format for consistency
 */
function normalizeWeekKey(value: string): string | null {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return weekKeyUTC(d);
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Require explicit opt-in via env var
  if (process.env.ALLOW_RESET_WEEK !== "1") {
    return NextResponse.json(
      { ok: false, error: "NOT_ENABLED", message: "Set ALLOW_RESET_WEEK=1 in .env.local to enable" },
      { status: 403 }
    );
  }

  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawWeekKey = body.weekKey;

  if (!rawWeekKey || typeof rawWeekKey !== "string") {
    return NextResponse.json({ ok: false, error: "Missing weekKey" }, { status: 400 });
  }

  // Normalize to Monday format for consistency with stats
  const weekKey = normalizeWeekKey(rawWeekKey);
  if (!weekKey) {
    return NextResponse.json({ ok: false, error: "Invalid weekKey format" }, { status: 400 });
  }

  console.log(`[reset-week] Normalized weekKey: ${weekKey} (input was: ${rawWeekKey})`);

  // Delete in order (respect FK constraints)
  const results = await db.$transaction(async (tx) => {
    // 1. Delete ClaimLeaf records for this weekKey
    const deletedLeaves = await tx.claimLeaf.deleteMany({
      where: { weekKey },
    });

    // 2. Delete ClaimEpoch for this weekKey
    const deletedEpoch = await tx.claimEpoch.deleteMany({
      where: { weekKey },
    });

    // 3. Delete RewardEvents for this weekKey
    const deletedEvents = await tx.rewardEvent.deleteMany({
      where: { weekKey },
    });

    // 4. Delete RewardBatch for this weekKey
    const deletedBatch = await tx.rewardBatch.deleteMany({
      where: { weekKey },
    });

    return {
      leaves: deletedLeaves.count,
      epochs: deletedEpoch.count,
      events: deletedEvents.count,
      batches: deletedBatch.count,
    };
  });

  return NextResponse.json({
    ok: true,
    weekKey,
    deleted: results,
  });
}
