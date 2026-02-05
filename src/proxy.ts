import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next.js Proxy (proxy.ts)
 * Age gate enforcement with bot bypass.
 */

const BOT_RE =
  /\b(googlebot|bingbot|yandex(?:[a-z0-9_-]*bot|images|video|news|blogs|accessibility|mobile|market|media|metrika|direct|adnet|favicons)?|duckduckbot|baiduspider|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot)\b/i;

function isIndexerBot(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  return BOT_RE.test(ua);
}

function hasAgeCookie(req: NextRequest) {
  // Match your old Nginx logic
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

// Next's proxy entrypoint (new convention)
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

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
