import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { commentId?: string } | null;
  const commentId = body?.commentId?.trim();
  if (!commentId) {
    return NextResponse.json({ ok: false, error: "MISSING_COMMENT_ID" }, { status: 400 });
  }

  const result = await db.commentReport.updateMany({
    where: { commentId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: access.user.id },
  });

  return NextResponse.json({ ok: true, resolved: result.count });
}
