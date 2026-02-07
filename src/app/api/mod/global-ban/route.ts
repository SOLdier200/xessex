/**
 * POST /api/mod/global-ban
 * Permanently ban a user from the platform.
 * Bans their wallet, optionally bans known IPs, kills sessions.
 * Body: {
 *   userId: string,
 *   reason?: string,
 *   banIps?: boolean (default false)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrMod } from "@/lib/adminActions";
import { db } from "@/lib/prisma";
import { notifyMods, getUserDisplayString } from "@/lib/modNotifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const modUser = await requireAdminOrMod();
  if (!modUser) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const { userId, reason, banIps = false } = body;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_USER_ID" }, { status: 400 });
  }

  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, walletAddress: true },
  });
  if (!targetUser) {
    return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const banReason = reason || "Permanently banned by moderator";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operations: any[] = [];

  // 1. Ban user globally + hold rewards + freeze claims
  operations.push(
    db.user.update({
      where: { id: userId },
      data: {
        globalBanStatus: "PERM_BANNED",
        globalBanReason: banReason,
        rewardBanStatus: "PERM_BANNED",
        rewardBanReason: "Global ban",
        claimFrozen: true,
        claimFrozenReason: "Global ban",
      },
    })
  );

  // 2. Kill all sessions
  operations.push(db.session.deleteMany({ where: { userId } }));

  // 3. Ban wallet address
  if (targetUser.walletAddress) {
    operations.push(
      db.bannedEntity.upsert({
        where: {
          entityType_entityValue: { entityType: "wallet", entityValue: targetUser.walletAddress },
        },
        create: {
          entityType: "wallet",
          entityValue: targetUser.walletAddress,
          reason: banReason,
          bannedById: modUser.id,
          userId,
        },
        update: { reason: banReason, liftedAt: null },
      })
    );
  }

  // 4. Optionally ban known IPs
  let bannedIpCount = 0;
  if (banIps) {
    const voteIps = await db.voteEvent.findMany({
      where: { userId },
      distinct: ["ip"],
      select: { ip: true },
    });

    const allIps = new Set(voteIps.map((v) => v.ip));
    // Remove fallback/localhost IPs
    allIps.delete("0.0.0.0");
    allIps.delete("127.0.0.1");
    allIps.delete("::1");

    for (const ip of allIps) {
      operations.push(
        db.bannedEntity.upsert({
          where: {
            entityType_entityValue: { entityType: "ip", entityValue: ip },
          },
          create: {
            entityType: "ip",
            entityValue: ip,
            reason: `Global ban (associated with user ${userId})`,
            bannedById: modUser.id,
            userId,
          },
          update: { reason: `Global ban (associated with user ${userId})`, liftedAt: null },
        })
      );
    }
    bannedIpCount = allIps.size;
  }

  // 5. Audit record
  operations.push(
    db.modAction.create({
      data: {
        modId: modUser.id,
        targetUserId: userId,
        actionType: "GLOBAL_BAN",
        reason: banReason,
        details: JSON.stringify({
          banIps,
          bannedIpCount,
          wallet: targetUser.walletAddress,
        }),
      },
    })
  );

  await db.$transaction(operations);

  notifyMods({
    type: "GLOBAL_BAN",
    targetUserId: userId,
    targetUserDisplay: getUserDisplayString(targetUser),
    details: `Global ban by ${getUserDisplayString(modUser)}. ${banIps ? `${bannedIpCount} IP(s) also banned.` : "Wallet banned only."}\nReason: ${banReason}`,
  });

  return NextResponse.json({
    ok: true,
    userId,
    globalBan: true,
    walletBanned: !!targetUser.walletAddress,
    ipsBanned: bannedIpCount,
  });
}
