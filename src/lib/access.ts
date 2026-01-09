import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export type AccessTier = "free" | "member" | "diamond";

// Env-based admin allowlist (comma-separated wallet addresses)
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
);

export async function getAccessContext() {
  const user = await getCurrentUser();
  const sub = user?.subscription ?? null;

  const active = !!sub && isSubscriptionActive(sub);
  const tier: AccessTier =
    active && sub?.tier === "DIAMOND"
      ? "diamond"
      : active
        ? "member"
        : "free";

  // Check DB role OR env allowlist
  const isAdminOrMod =
    user?.role === "ADMIN" ||
    user?.role === "MOD" ||
    (user?.walletAddress && ADMIN_WALLETS.has(user.walletAddress));

  return {
    user,
    sub,
    active,
    tier,
    isAuthed: !!user,
    isAdminOrMod,
    canViewAllVideos: tier === "member" || tier === "diamond",
    canComment: tier === "diamond",
    canRateStars: tier === "diamond",
    canVoteComments: tier === "member" || tier === "diamond",
  };
}
