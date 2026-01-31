/**
 * GET /api/mod/banned-users
 * Returns users who are comment banned (temp, perm, or unbanned)
 */

import { NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { getCommentBannedUsers } from "@/lib/commentModeration";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdminOrMod();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const users = await getCommentBannedUsers();

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      wallet: u.solWallet || u.walletAddress,
      status: u.commentBanStatus,
      banUntil: u.commentBanUntil?.toISOString() || null,
      banReason: u.commentBanReason,
      removedCount: u.removedCommentCount,
      latestBan: u.latestBan
        ? {
            type: u.latestBan.banType,
            bannedAt: u.latestBan.bannedAt.toISOString(),
            unbannedAt: u.latestBan.unbannedAt?.toISOString() || null,
            rebannedAt: u.latestBan.rebannedAt?.toISOString() || null,
          }
        : null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
