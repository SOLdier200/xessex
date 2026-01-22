import { NextResponse } from "next/server";
import { markActionRun, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function POST() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const msg = "Search index not configured";
  await markActionRun("REBUILD_SEARCH_INDEX", false, msg);
  return NextResponse.json({ ok: false, error: msg }, { status: 501 });
}
