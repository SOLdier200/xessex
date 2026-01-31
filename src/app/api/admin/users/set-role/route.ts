/**
 * Admin API: Set user role
 * POST /api/admin/users/set-role
 * Body: { userId: string, role: "USER" | "MOD" }
 *
 * Only ADMIN can set roles. MOD cannot promote/demote other users.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const access = await getAccessContext();

  // Only ADMIN can set roles (not MOD)
  if (!access.user || access.user.role !== "ADMIN") {
    // Also check ADMIN_WALLETS for admin-by-wallet users
    const adminWallets = new Set(
      (process.env.ADMIN_WALLETS || "")
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean)
    );

    const userWallet = access.user?.solWallet || access.user?.walletAddress;
    const isAdminByWallet = userWallet && adminWallets.has(userWallet);

    if (!isAdminByWallet) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_REQUIRED", message: "Only admins can change user roles" },
        { status: 403 }
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { userId, role } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  if (!role || !["USER", "MOD"].includes(role)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ROLE", message: "Role must be USER or MOD" },
      { status: 400 }
    );
  }

  // Check if target user exists
  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });

  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Cannot change ADMIN role
  if (targetUser.role === "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "CANNOT_MODIFY_ADMIN", message: "Cannot modify admin roles" },
      { status: 403 }
    );
  }

  // Cannot set someone to ADMIN via this endpoint
  if (role === "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "CANNOT_SET_ADMIN", message: "Cannot promote to admin via this endpoint" },
      { status: 403 }
    );
  }

  // Update the role
  await db.user.update({
    where: { id: userId },
    data: { role },
  });

  console.log(
    `[admin/users/set-role] User ${access.user?.id} changed role of ${userId} (${targetUser.email || "no email"}) from ${targetUser.role} to ${role}`
  );

  return NextResponse.json({
    ok: true,
    userId,
    previousRole: targetUser.role,
    newRole: role,
  });
}
