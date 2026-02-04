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

  const reports = await db.commentReport.findMany({
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      comment: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          status: true,
          author: { select: { id: true, email: true, walletAddress: true, createdAt: true } },
          video: { select: { id: true, slug: true, title: true } },
        },
      },
      reporter: {
        select: { id: true, email: true, walletAddress: true },
      },
    },
  });

  const grouped = new Map<string, any>();

  for (const r of reports) {
    if (!r.comment) continue;
    const key = r.commentId;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        commentId: r.commentId,
        body: r.comment.body,
        createdAt: r.comment.createdAt.toISOString(),
        status: r.comment.status,
        author: {
          ...r.comment.author,
          createdAt: r.comment.author.createdAt?.toISOString(),
        },
        video: r.comment.video,
        reportCount: 0,
        reasons: {} as Record<string, number>,
        reporters: [] as Array<{ id: string; email: string | null; walletAddress: string | null; reportedAt: string; reason: string }>,
        latestReportAt: r.createdAt.toISOString(),
      });
    }
    const row = grouped.get(key);
    row.reportCount += 1;
    row.reasons[r.reason] = (row.reasons[r.reason] || 0) + 1;
    row.reporters.push({
      id: r.reporter.id,
      email: r.reporter.email,
      walletAddress: r.reporter.walletAddress,
      reportedAt: r.createdAt.toISOString(),
      reason: r.reason,
    });
    if (r.createdAt.toISOString() > row.latestReportAt) {
      row.latestReportAt = r.createdAt.toISOString();
    }
  }

  const list = Array.from(grouped.values()).sort((a, b) => {
    if (b.reportCount !== a.reportCount) return b.reportCount - a.reportCount;
    return b.latestReportAt.localeCompare(a.latestReportAt);
  });

  return NextResponse.json({ ok: true, reports: list });
}
