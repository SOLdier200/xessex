import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.isAdminOrMod) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { subscriptionId?: string } | null;
  const subscriptionId = body?.subscriptionId || "";

  if (!subscriptionId) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELED", expiresAt: null },
  });

  console.log(`[Admin] Canceled subscription ${updated.id} by ${access.user?.email || access.user?.solWallet}`);

  return NextResponse.json({ ok: true, canceled: true, id: updated.id });
}
