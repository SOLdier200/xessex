import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

/**
 * POST /api/admin/honest-moderators/resolve
 * Mark a ModeratorIntegrityFlag as resolved
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Only full admins can resolve flags (not regular mods)
  if (access.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "ADMIN_ONLY" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const flagId = body.flagId as string | undefined;

  if (!flagId) {
    return NextResponse.json({ ok: false, error: "MISSING_FLAG_ID" }, { status: 400 });
  }

  const flag = await db.moderatorIntegrityFlag.findUnique({
    where: { id: flagId },
  });

  if (!flag) {
    return NextResponse.json({ ok: false, error: "FLAG_NOT_FOUND" }, { status: 404 });
  }

  if (flag.resolvedAt) {
    return NextResponse.json({ ok: false, error: "ALREADY_RESOLVED" }, { status: 400 });
  }

  await db.moderatorIntegrityFlag.update({
    where: { id: flagId },
    data: { resolvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
