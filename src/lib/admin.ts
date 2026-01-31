/**
 * Admin/Mod authorization helper.
 * Checks user role and ADMIN_WALLETS allowlist.
 */

export function isAdminOrMod(user: {
  role: "USER" | "MOD" | "ADMIN";
  walletAddress: string | null;
} | null | undefined): boolean {
  if (!user) return false;

  const hasAdminRole = user.role === "ADMIN" || user.role === "MOD";

  const raw = process.env.ADMIN_WALLETS || "";
  const ADMIN_WALLETS = new Set(
    raw.split(",").map((s) => s.trim()).filter(Boolean)
  );

  const walletInAllowlist = !!(user.walletAddress && ADMIN_WALLETS.has(user.walletAddress));

  return hasAdminRole || walletInAllowlist;
}
