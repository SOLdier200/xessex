import { getCurrentUser, isSubscriptionActive } from "@/lib/auth";

export type AccessTier = "free" | "member" | "diamond";

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

  return {
    user,
    sub,
    active,
    tier,
    isAuthed: !!user,
    isAdminOrMod: user?.role === "ADMIN" || user?.role === "MOD",
    canViewAllVideos: tier === "member" || tier === "diamond",
    canComment: tier === "diamond", // Diamond only
    canRateStars: tier === "diamond", // Diamond only
    canVoteComments: tier === "member" || tier === "diamond", // Member + Diamond
  };
}
