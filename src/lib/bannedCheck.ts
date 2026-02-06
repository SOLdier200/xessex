/*
 * © 2026 Xessex. All rights reserved.
 * Proprietary and confidential.
 */

import { db } from "@/lib/prisma";

export async function isWalletBanned(wallet: string): Promise<{ banned: boolean; reason?: string }> {
  const entity = await db.bannedEntity.findUnique({
    where: { entityType_entityValue: { entityType: "wallet", entityValue: wallet } },
  });
  if (!entity) return { banned: false };
  if (entity.liftedAt) return { banned: false };
  if (entity.expiresAt && entity.expiresAt.getTime() < Date.now()) return { banned: false };
  return { banned: true, reason: entity.reason || "This wallet has been banned" };
}

export async function isIpBanned(ip: string): Promise<{ banned: boolean; reason?: string }> {
  const entity = await db.bannedEntity.findUnique({
    where: { entityType_entityValue: { entityType: "ip", entityValue: ip } },
  });
  if (!entity) return { banned: false };
  if (entity.liftedAt) return { banned: false };
  if (entity.expiresAt && entity.expiresAt.getTime() < Date.now()) return { banned: false };
  return { banned: true, reason: entity.reason || "Access denied" };
}
