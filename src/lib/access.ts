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

  // Check user role from database OR env allowlist
  const hasAdminRole = user?.role === "ADMIN" || user?.role === "MOD";
  const walletInAllowlist =
    !!(user?.walletAddress && ADMIN_WALLETS.has(user.walletAddress)) ||
    !!(user?.solWallet && ADMIN_WALLETS.has(user.solWallet));
  const isAdminOrMod = hasAdminRole || walletInAllowlist;

  // Diamond email users who haven't linked a wallet yet
  const hasLinkedWallet = !!user?.walletAddress || !!user?.solWallet;
  const needsSolWalletLink = tier === "diamond" && !!user?.email && !hasLinkedWallet;

  return {
    user,
    sub,
    active,
    tier,
    isAuthed: !!user,
    isAdminOrMod,
    needsSolWalletLink,
    canViewAllVideos: isAdminOrMod || tier === "member" || tier === "diamond",
    canComment: isAdminOrMod || tier === "diamond",
    canRateStars: isAdminOrMod || tier === "diamond",
    canVoteComments: isAdminOrMod || tier === "member" || tier === "diamond",
  };
}
