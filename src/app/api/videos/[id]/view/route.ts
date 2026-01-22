import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

// Track a video view - increments viewsCount
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing video ID" }, { status: 400 });
  }

  try {
    await db.video.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Video might not exist, just ignore
    return NextResponse.json({ ok: true });
  }
}
