import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const mod = await import("@/app/api/admin/site-stats/route");
    const res: Response = await mod.GET();
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = body?.error || `site-stats failed (${res.status})`;
      await markActionRun("RECOMPUTE_ANALYTICS", false, msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const pageViews = body?.pageViews ?? body?.views ?? null;
    const msg =
      pageViews !== null ? `Analytics recomputed. pageViews=${pageViews}` : "Analytics recomputed.";
    await markActionRun("RECOMPUTE_ANALYTICS", true, msg);
    return NextResponse.json({ ok: true, message: msg, detail: body });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    await markActionRun("RECOMPUTE_ANALYTICS", false, msg);
    return NextResponse.json(
      { ok: false, error: "FAILED_TO_RECOMPUTE_ANALYTICS" },
      { status: 500 }
    );
  }
}
