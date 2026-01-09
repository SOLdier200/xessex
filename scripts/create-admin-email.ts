import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@xessex.me";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";

  const passHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { passHash, role: "ADMIN" },
    create: { email, passHash, role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });

  // ensure subscription row exists (lifetime admin)
  await db.subscription.upsert({
    where: { userId: user.id },
    update: { status: "ACTIVE", tier: "DIAMOND", expiresAt: null },
    create: { userId: user.id, status: "ACTIVE", tier: "DIAMOND", expiresAt: null },
  });

  console.log("✅ Admin user ready:");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Role:", user.role);
}

main().finally(() => db.$disconnect());
