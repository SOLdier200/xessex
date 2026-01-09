/**
 * Bootstrap script to create an admin user with lifetime diamond subscription.
 *
 * Usage: npx tsx scripts/bootstrap-admin.ts
 */

import { PrismaClient } from "@prisma/client";

const ADMIN_WALLET = "J1ssN9Fr6qeNN1CUphVV8XaaPbx2YHpt1gv9SLupJTMe";

async function main() {
  const prisma = new PrismaClient();

  try {
    console.log(`[Bootstrap] Upserting admin user: ${ADMIN_WALLET}`);

    // Upsert user with ADMIN role
    const user = await prisma.user.upsert({
      where: { walletAddress: ADMIN_WALLET },
      update: { role: "ADMIN" },
      create: {
        walletAddress: ADMIN_WALLET,
        role: "ADMIN",
      },
    });

    console.log(`[Bootstrap] User ID: ${user.id}, Role: ${user.role}`);

    // 10 years from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);

    // Upsert subscription with DIAMOND tier
    const subscription = await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {
        tier: "DIAMOND",
        status: "ACTIVE",
        expiresAt,
      },
      create: {
        userId: user.id,
        tier: "DIAMOND",
        status: "ACTIVE",
        expiresAt,
      },
    });

    console.log(`[Bootstrap] Subscription ID: ${subscription.id}`);
    console.log(`[Bootstrap] Tier: ${subscription.tier}`);
    console.log(`[Bootstrap] Status: ${subscription.status}`);
    console.log(`[Bootstrap] Expires: ${subscription.expiresAt?.toISOString()}`);
    console.log(`[Bootstrap] Done!`);
  } catch (error) {
    console.error("[Bootstrap] Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
