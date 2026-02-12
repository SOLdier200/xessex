import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { getContentById } from "@/lib/xessexContent";
import { db } from "@/lib/prisma";
import { CREDIT_MICRO } from "@/lib/rewardsConstants";

export const runtime = "nodejs";

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contentId } = await params;
  const content = getContentById(contentId);

  if (!content) {
    return NextResponse.json(
      { ok: false, error: "not_found" },
      { status: 404 }
    );
  }

  const ctx = await getAccessContext();

  if (!ctx.isAuthed || !ctx.user) {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const userId = ctx.user.id;
  const refId = `${userId}_${contentId}`;
  const costMicro = BigInt(content.unlockCost) * CREDIT_MICRO;

  const result = await db.$transaction(async (tx) => {
    // Idempotency: check if already unlocked
    const existing = await tx.specialCreditLedger.findFirst({
      where: { refType: "XESSEX_CONTENT_UNLOCK", refId },
      select: { id: true },
    });

    if (existing) {
      const account = await tx.specialCreditAccount.findUnique({
        where: { userId },
        select: { balanceMicro: true },
      });
      return {
        ok: true as const,
        alreadyUnlocked: true,
        creditBalance: Number((account?.balanceMicro ?? 0n) / CREDIT_MICRO),
      };
    }

    // Check credit account
    const account = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    if (!account) {
      return { ok: false as const, error: "no_credit_account" };
    }

    if (account.balanceMicro < costMicro) {
      return { ok: false as const, error: "insufficient_credits" };
    }

    // Debit credits
    await tx.specialCreditAccount.update({
      where: { userId },
      data: { balanceMicro: { decrement: costMicro } },
    });

    // Create ledger entry
    await tx.specialCreditLedger.create({
      data: {
        userId,
        weekKey: getWeekKey(new Date()),
        amountMicro: -costMicro,
        reason: `Unlocked Xessex content: ${content.title}`,
        refType: "XESSEX_CONTENT_UNLOCK",
        refId,
      },
    });

    const accountAfter = await tx.specialCreditAccount.findUnique({
      where: { userId },
      select: { balanceMicro: true },
    });

    return {
      ok: true as const,
      alreadyUnlocked: false,
      creditBalance: Number(
        (accountAfter?.balanceMicro ?? 0n) / CREDIT_MICRO
      ),
    };
  });

  if (!result.ok) {
    const status =
      result.error === "insufficient_credits" || result.error === "no_credit_account"
        ? 402
        : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadyUnlocked: result.alreadyUnlocked,
    creditBalance: result.creditBalance,
  });
}
