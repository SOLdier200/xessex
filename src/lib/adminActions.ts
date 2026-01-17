import { db } from "@/lib/prisma";
import { getAccessContext } from "@/lib/access";
import type { AdminActionKey } from "@prisma/client";

export async function requireAdminOrMod() {
  const access = await getAccessContext();
  if (!access.user || !access.isAdminOrMod) return null;
  return access.user;
}

export async function markActionRun(
  key: AdminActionKey,
  ok: boolean,
  msg?: string
) {
  await db.adminActionRun.upsert({
    where: { key },
    create: { key, lastRunAt: new Date(), lastOk: ok, lastMsg: msg },
    update: { lastRunAt: new Date(), lastOk: ok, lastMsg: msg },
  });
}

export async function getActionRuns() {
  const rows = await db.adminActionRun.findMany();
  const map: Record<
    string,
    { lastRunAt: string | null; lastOk: boolean; lastMsg: string | null }
  > = {};
  for (const row of rows) {
    map[row.key] = {
      lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
      lastOk: row.lastOk,
      lastMsg: row.lastMsg ?? null,
    };
  }
  return map;
}
