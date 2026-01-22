import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const mod = await import("@/app/api/leaderboard/route");
    const res: Response = await mod.GET();
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = body?.error || `leaderboard failed (${res.status})`;
      await markActionRun("RECALCULATE_LEADERBOARDS", false, msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const msg = `Leaderboards recomputed. karat=${body?.karat?.length ?? 0}, mvm=${
      body?.mvm?.length ?? 0
    }, rewards=${body?.rewards?.length ?? 0}, referrals=${body?.referrals?.length ?? 0}`;
    await markActionRun("RECALCULATE_LEADERBOARDS", true, msg);
    return NextResponse.json({ ok: true, message: msg });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("RECALCULATE_LEADERBOARDS", false, msg);
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_RECALCULATE_LEADERBOARDS" },
      { status: 500 }
    );
  }
}
