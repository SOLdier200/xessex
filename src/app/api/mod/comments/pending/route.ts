import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export async function GET(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);

  const pending = await db.comment.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      author: { select: { id: true, email: true, walletAddress: true } },
      video: { select: { id: true, slug: true, title: true, kind: true } },
      _count: { select: { reports: true } },
    },
  });

  const rows = pending.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    autoReason: c.autoReason ?? null,
    status: c.status,
    reportCount: c._count.reports,
    author: {
      id: c.author.id,
      email: c.author.email,
      walletAddress: c.author.walletAddress,
    },
    video: {
      id: c.video.id,
      slug: c.video.slug,
      title: c.video.title,
      kind: c.video.kind,
    },
  }));

  return NextResponse.json({ ok: true, comments: rows });
}
