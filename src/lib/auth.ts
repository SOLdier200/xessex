import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("xessex_session")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { subscription: true } } },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  return session.user;
}

export function isSubscriptionActive(user: any) {
  if (!user?.subscription) return false;
  if (user.subscription.status !== "active") return false;
  if (!user.subscription.expiresAt) return true;
  return user.subscription.expiresAt.getTime() > Date.now();
}
