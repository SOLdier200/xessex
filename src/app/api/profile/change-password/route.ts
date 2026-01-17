import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

const Body = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(5, "New password must be at least 5 characters"),
});

/**
 * POST /api/profile/change-password
 *
 * Change the user's password. Requires current password verification.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  if (!access.user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Only users with email/password can change password
  const user = await db.user.findUnique({
    where: { id: access.user.id },
    select: { id: true, email: true, passHash: true },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "USER_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!user.email || !user.passHash) {
    return NextResponse.json(
      { ok: false, error: "NO_PASSWORD_SET", message: "This account uses wallet login only" },
      { status: 400 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Invalid input";
    return NextResponse.json(
      { ok: false, error: "INVALID_INPUT", message: firstError },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // Verify current password
  const passwordMatch = await bcrypt.compare(currentPassword, user.passHash);
  if (!passwordMatch) {
    return NextResponse.json(
      { ok: false, error: "WRONG_PASSWORD", message: "Current password is incorrect" },
      { status: 401 }
    );
  }

  // Check if new password is same as current
  const samePassword = await bcrypt.compare(newPassword, user.passHash);
  if (samePassword) {
    return NextResponse.json(
      { ok: false, error: "SAME_PASSWORD", message: "New password must be different from current password" },
      { status: 400 }
    );
  }

  // Hash new password and update
  const newPassHash = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: { passHash: newPassHash },
  });

  return NextResponse.json({ ok: true });
}
