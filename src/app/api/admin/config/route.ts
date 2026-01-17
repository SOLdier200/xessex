import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { getAdminConfig } from "@/lib/adminConfig";

export const runtime = "nodejs";

const UpdateBody = z.object({
  minWeeklyScoreThreshold: z.number().int().min(0).max(1_000_000).optional(),
  minMvmThreshold: z.number().int().min(0).max(1_000_000).optional(),
  allTimeLikesBpsOfLikes: z.number().int().min(0).max(10_000).optional(),
  memberVoterBpsOfLikes: z.number().int().min(0).max(10_000).optional(),
  voterRewardPerVoteAtomic: z.union([z.string(), z.number()]).optional(), // BigInt-friendly
});

/**
 * GET /api/admin/config
 * Get current admin configuration (admin/mod only)
 */
export async function GET() {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const cfg = await getAdminConfig();
    return NextResponse.json({
      ok: true,
      config: {
        ...cfg,
        // Serialize BigInt as string for JSON
        voterRewardPerVoteAtomic: cfg.voterRewardPerVoteAtomic.toString(),
      },
    });
  } catch (error) {
    console.error("[ADMIN_CONFIG] GET error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * POST /api/admin/config
 * Update admin configuration (admin/mod only)
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const cfg = await getAdminConfig();
    const patch: Record<string, unknown> = { ...parsed.data };

    // BigInt field may arrive as string/number
    if (patch.voterRewardPerVoteAtomic !== undefined) {
      try {
        const val = BigInt(patch.voterRewardPerVoteAtomic as string | number);
        if (val < 0n) throw new Error("negative");
        patch.voterRewardPerVoteAtomic = val;
      } catch {
        return NextResponse.json(
          { ok: false, error: "INVALID_VOTER_REWARD" },
          { status: 400 }
        );
      }
    }

    // Ensure likes sub-slices don't exceed 100% of likes pool
    const allTime = (patch.allTimeLikesBpsOfLikes as number) ?? cfg.allTimeLikesBpsOfLikes;
    const voter = (patch.memberVoterBpsOfLikes as number) ?? cfg.memberVoterBpsOfLikes;
    if (allTime + voter > 10_000) {
      return NextResponse.json(
        { ok: false, error: "LIKES_SLICE_OVER_100_PERCENT" },
        { status: 400 }
      );
    }

    const updated = await db.adminConfig.update({
      where: { id: cfg.id },
      data: patch,
    });

    return NextResponse.json({
      ok: true,
      config: {
        ...updated,
        voterRewardPerVoteAtomic: updated.voterRewardPerVoteAtomic.toString(),
      },
    });
  } catch (error) {
    console.error("[ADMIN_CONFIG] POST error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
