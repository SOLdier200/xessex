import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const wallet = process.env.ADMIN_WALLET;
  if (!wallet) throw new Error("Missing ADMIN_WALLET env var");

  // Ensure user exists and is ADMIN
  const user = await prisma.user.upsert({
    where: { walletAddress: wallet },
    create: {
      walletAddress: wallet,
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
    },
    select: { id: true, walletAddress: true },
  });

  // Lifetime Diamond (expiresAt = null)
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tier: "DIAMOND",
      status: "ACTIVE",
      expiresAt: null, // lifetime
    },
    update: {
      tier: "DIAMOND",
      status: "ACTIVE",
      expiresAt: null,
    },
  });

  console.log("✅ Lifetime ADMIN + DIAMOND set for:", user.walletAddress);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
