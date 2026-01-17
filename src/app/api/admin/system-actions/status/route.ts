import { NextResponse } from "next/server";
import { getActionRuns, requireAdminOrMod } from "@/lib/adminActions";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const runs = await getActionRuns();
  return NextResponse.json({ ok: true, runs });
}
