import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

const VALID_REASONS = new Set([
  "SPAM",
  "HARASSMENT",
  "HATE",
  "THREAT",
  "SEXUAL_VIOLENCE",
  "OTHER",
]);
const AUTO_HIDE_THRESHOLD = 4;

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    commentId?: string;
    reason?: string;
    note?: string;
  } | null;

  const commentId = body?.commentId?.trim();
  const reason = body?.reason?.trim()?.toUpperCase() || "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : undefined;

  if (!commentId || !VALID_REASONS.has(reason)) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  const comment = await db.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, status: true },
  });

  if (!comment) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (comment.status === "REMOVED") {
    return NextResponse.json({ ok: false, error: "ALREADY_REMOVED" }, { status: 400 });
  }

  if (comment.authorId === access.user.id) {
    return NextResponse.json({ ok: false, error: "CANNOT_REPORT_OWN" }, { status: 400 });
  }

  try {
    await db.commentReport.create({
      data: {
        commentId,
        reporterId: access.user.id,
        reason: reason as any,
        note: note || undefined,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: true, alreadyReported: true });
    }
    throw e;
  }

  const reportCount = await db.commentReport.count({ where: { commentId } });

  if (reportCount >= AUTO_HIDE_THRESHOLD) {
    await db.comment.update({
      where: { id: commentId },
      data: {
        status: "HIDDEN",
        autoReason: "reports: threshold",
      },
    });
  }

  return NextResponse.json({ ok: true, reportCount });
}
