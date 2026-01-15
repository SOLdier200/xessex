import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const Body = z.object({
  refCode: z.string().trim().min(4).max(32),
});

/**
 * POST /api/profile/set-referrer
 * Allows a user to set their referrer after signup (if they didn't use a referral link)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Check if user already has a referrer
  if (user.referredById) {
    return NextResponse.json({ ok: false, error: "ALREADY_REFERRED" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const refCode = parsed.data.refCode.trim().toUpperCase();

  // Find the referrer by their referral code
  const referrer = await db.user.findUnique({
    where: { referralCode: refCode },
    select: { id: true, email: true },
  });

  if (!referrer) {
    return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 404 });
  }

  // Prevent self-referral
  if (referrer.id === user.id) {
    return NextResponse.json({ ok: false, error: "CANNOT_REFER_SELF" }, { status: 400 });
  }

  // Set the referrer
  await db.user.update({
    where: { id: user.id },
    data: {
      referredById: referrer.id,
      referredAt: new Date(),
    },
  });

  // Mask email for response
  let referredByEmail: string | null = null;
  if (referrer.email) {
    const [local, domain] = referrer.email.split("@");
    referredByEmail = `${local.slice(0, 2)}***@${domain}`;
  }

  return NextResponse.json({
    ok: true,
    referredByEmail,
  });
}
