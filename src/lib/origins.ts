/**
 * Cross-domain routing helpers for the two-deployment architecture.
 *
 * Main site (xessex.me)     → devnet, general app
 * Presale site (presale.xessex.me) → mainnet, sale-only
 */

export const MAIN_ORIGIN =
  process.env.NEXT_PUBLIC_MAIN_ORIGIN || "https://xessex.me";

export const PRESALE_ORIGIN =
  process.env.NEXT_PUBLIC_PRESALE_ORIGIN || "https://presale.xessex.me";

const PRESALE_PATH_PREFIXES = [
  "/launch",
  "/tokenomics",
  "/admin/presale",
  "/api/sale",
  "/api/pyth",
  "/api/admin/presale",
  "/api/admin/sale",
];

export function isPresalePath(pathname: string) {
  return PRESALE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function originForPath(pathname: string) {
  return isPresalePath(pathname) ? PRESALE_ORIGIN : MAIN_ORIGIN;
}

export function absoluteUrlForPath(pathname: string, search = "") {
  const origin = originForPath(pathname);
  return origin + pathname + (search || "");
}
