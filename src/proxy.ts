// src/proxy.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next.js 16 Proxy Middleware (proxy.ts)
 * - If proxy.ts exists, DO NOT use middleware.ts (Next will error)
 */

const BOT_RE =
  /\b(googlebot|yandex(bot|images|video|news)?|bingbot|duckduckbot|baiduspider|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot)\b/i;

function isIndexerBot(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  return BOT_RE.test(ua);
}

export default function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 🚨 ABSOLUTE BYPASS - robots/sitemaps MUST return 200, no redirect ever
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap-")
  ) {
    return NextResponse.next();
  }

  // Never gate static assets
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const url = req.nextUrl;

  // Let search engines through (200) so they can index
  if (isIndexerBot(req)) {
    const res = NextResponse.next();
    res.headers.set("x-xessex-mw", "bot-bypass");
    res.headers.append("Vary", "User-Agent");
    return res;
  }

  // Allow the age page itself (avoid loops)
  if (pathname === "/age") return NextResponse.next();

  // If user passed age gate, allow
  const ageOk = req.cookies.get("age_ok")?.value === "1";
  if (ageOk) return NextResponse.next();

  // Gate humans
  const redir = url.clone();
  redir.pathname = "/age";
  redir.searchParams.set("next", pathname + (url.search || ""));
  const res = NextResponse.redirect(redir, 307);
  res.headers.set("x-xessex-mw", "redirect-age");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
