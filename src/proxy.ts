import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next.js Proxy (proxy.ts)
 * - Presale subdomain routing (redirect wrong-host requests)
 * - Age gate enforcement with bot bypass (main site only)
 */

const MAIN_HOST = "xessex.me";
const PRESALE_HOST = "presale.xessex.me";

function isPresalePath(pathname: string) {
  return (
    pathname === "/launch" ||
    pathname.startsWith("/launch/") ||
    pathname === "/tokenomics" ||
    pathname.startsWith("/tokenomics/") ||
    pathname === "/admin/presale" ||
    pathname.startsWith("/admin/presale/") ||
    pathname.startsWith("/api/sale/") ||
    pathname.startsWith("/api/pyth/") ||
    pathname.startsWith("/api/admin/presale") ||
    pathname.startsWith("/api/admin/sale")
  );
}

const BOT_RE =
  /\b(googlebot|bingbot|yandex(?:[a-z0-9_-]*bot|images|video|news|blogs|accessibility|mobile|market|media|metrika|direct|adnet|favicons)?|duckduckbot|baiduspider|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot)\b/i;

function isIndexerBot(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  return BOT_RE.test(ua);
}

function hasAgeCookie(req: NextRequest) {
  const a = req.cookies.get("age_ok")?.value;
  const b = req.cookies.get("age_verified")?.value;
  return a === "1" || b === "1";
}

function isAllowlistedPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/age") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/parental-controls") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/2257") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/login") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/logos/")
  );
}

// Next.js 16 proxy entrypoint
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();

  // ── Presale subdomain routing ──────────────────────────────────

  // Main host hitting a presale path → redirect to presale subdomain
  if (
    (host === MAIN_HOST || host === `www.${MAIN_HOST}`) &&
    isPresalePath(pathname)
  ) {
    const url = req.nextUrl.clone();
    url.host = PRESALE_HOST;
    url.port = "";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  // Presale host hitting a non-presale path → bounce to /launch
  if (host === PRESALE_HOST) {
    if (
      !isPresalePath(pathname) &&
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/logos/") &&
      !pathname.startsWith("/api/auth") &&
      !pathname.startsWith("/login") &&
      pathname !== "/favicon.ico" &&
      pathname !== "/age" &&
      !pathname.startsWith("/age")
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/launch";
      url.search = "";
      return NextResponse.redirect(url, 302);
    }

    // Presale site skips age gate — just pass through
    const res = NextResponse.next();
    res.headers.set("x-xessex-mw", "presale-pass");
    return res;
  }

  // ── Main site: age gate logic ──────────────────────────────────

  // Always allow allowlisted routes
  if (isAllowlistedPath(pathname)) {
    const res = NextResponse.next();
    res.headers.set("x-xessex-mw", "allowlist");
    return res;
  }

  // Bots bypass age gate
  if (isIndexerBot(req)) {
    const res = NextResponse.next();
    res.headers.set("x-xessex-mw", "bot-allow");
    return res;
  }

  // Gate humans without cookie
  if (!hasAgeCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/age";
    url.searchParams.set("next", pathname + (search || ""));
    const res = NextResponse.redirect(url, 307);
    res.headers.set("x-xessex-mw", "redirect-age");
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("x-xessex-mw", "pass");
  return res;
}
