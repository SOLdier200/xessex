import { db } from "@/lib/prisma";

/**
 * Get or create the singleton AdminConfig
 */
export async function getAdminConfig() {
  const existing = await db.adminConfig.findFirst();
  if (existing) return existing;
  return db.adminConfig.create({ data: {} });
}

/**
 * Get a specific config value
 */
export async function getConfigValue<K extends keyof Awaited<ReturnType<typeof getAdminConfig>>>(
  key: K
): Promise<Awaited<ReturnType<typeof getAdminConfig>>[K]> {
  const cfg = await getAdminConfig();
  return cfg[key];
}
