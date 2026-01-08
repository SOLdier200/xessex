import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export async function GET() {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const current = await db.video.findMany({
    where: { isShowcase: true },
    select: { slug: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  return NextResponse.json({ ok: true, current });
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { viewkeys?: string[] }
    | null;

  const viewkeys = Array.isArray(body?.viewkeys)
    ? body!.viewkeys.map((v) => String(v).trim()).filter(Boolean)
    : [];

  // Hard rule: exactly 3
  const unique = Array.from(new Set(viewkeys));
  if (unique.length !== 3) {
    return NextResponse.json(
      { ok: false, error: "MUST_SELECT_EXACTLY_3" },
      { status: 400 }
    );
  }

  // Ensure they exist
  const found = await db.video.findMany({
    where: { slug: { in: unique } },
    select: { slug: true },
  });

  if (found.length !== 3) {
    return NextResponse.json(
      { ok: false, error: "ONE_OR_MORE_NOT_PUBLISHED" },
      { status: 400 }
    );
  }

  // Atomic: clear old showcases + set new 3
  await db.$transaction([
    db.video.updateMany({
      where: { isShowcase: true },
      data: { isShowcase: false },
    }),
    db.video.updateMany({
      where: { slug: { in: unique } },
      data: { isShowcase: true },
    }),
  ]);

  const current = await db.video.findMany({
    where: { isShowcase: true },
    select: { slug: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  return NextResponse.json({ ok: true, current });
}
