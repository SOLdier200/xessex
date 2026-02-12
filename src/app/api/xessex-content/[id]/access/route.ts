import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { getContentById } from "@/lib/xessexContent";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const content = getContentById(id);

  if (!content) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json({
      ok: true,
      unlocked: false,
      unlockCost: content.unlockCost,
      creditBalance: 0,
      isAuthed: false,
      hasWallet: false,
    });
  }

  // Admin/mod bypass
  if (ctx.isAdminOrMod) {
    return NextResponse.json({
      ok: true,
      unlocked: true,
      unlockCost: content.unlockCost,
      creditBalance: ctx.creditBalance,
      isAuthed: true,
      hasWallet: ctx.hasWallet,
    });
  }

  // Check existing unlock via SpecialCreditLedger
  const existing = await db.specialCreditLedger.findFirst({
    where: {
      refType: "XESSEX_CONTENT_UNLOCK",
      refId: `${ctx.user.id}_${id}`,
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    unlocked: !!existing,
    unlockCost: content.unlockCost,
    creditBalance: ctx.creditBalance,
    isAuthed: true,
    hasWallet: ctx.hasWallet,
  });
}
