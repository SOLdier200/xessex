import { NextResponse } from "next/server";
import { recomputeVideoRanks } from "@/lib/videoRank";
import { db } from "@/lib/prisma";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await recomputeVideoRanks();
    const total = await db.video.count();
    await markActionRun("RECOMPUTE_VIDEO_RANKS", true, `Rebuilt ranks for ${total} videos`);
    return NextResponse.json({ ok: true, total });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("RECOMPUTE_VIDEO_RANKS", false, msg);
    return NextResponse.json({ ok: false, error: "FAILED_TO_RECOMPUTE" }, { status: 500 });
  }
}
