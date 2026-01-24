const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function getReferralChain(userId) {
  const chain = [];

  const u1 = await db.user.findUnique({
    where: { id: userId },
    select: { referredById: true },
  });
  console.log("Step 1 - User referredById:", u1?.referredById);
  if (!u1?.referredById) return chain;

  const l1User = await db.user.findUnique({
    where: { id: u1.referredById },
    select: { id: true, solWallet: true, referredById: true, email: true },
  });
  console.log("Step 2 - L1 referrer:", l1User?.email, "| solWallet:", l1User?.solWallet);
  
  if (l1User?.solWallet) {
    chain.push({ id: l1User.id, wallet: l1User.solWallet });
  }

  return chain;
}

async function main() {
  const userId = "506859e3-0157-48ab-beb1-f3c9e9b43111";
  
  console.log("=== TESTING getReferralChain for misss.izzzy ===\n");
  const chain = await getReferralChain(userId);
  
  console.log("\nResult chain:", chain);
  console.log("Chain length:", chain.length);
  
  if (chain.length > 0) {
    console.log("\n✓ Referral chain IS working - admin should have received REF_L1 rewards");
  } else {
    console.log("\n✗ Referral chain returned empty - something is wrong");
  }
}

main().catch(console.error).finally(() => db.$disconnect());
