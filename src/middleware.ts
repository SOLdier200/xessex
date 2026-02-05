// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next.js Middleware
 * Server-side age gate enforcement with bot bypass for SEO crawlers.
 */

const BOT_RE =
  /\b(googlebot|yandex(?:[a-z0-9_-]*bot|images|video|news|blogs|accessibility|mobile|market|media|metrika|direct|adnet|favicons)?|bingbot|duckduckbot|baiduspider|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot)\b/i;

function isIndexerBot(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  return BOT_RE.test(ua);
}

// Wallet / in-app UA detection (used for behavior tweaks, NOT for skipping the gate)
function isWalletInAppUA(req: NextRequest) {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  return (
    ua.includes("phantom") ||
    ua.includes("solflare") ||
    ua.includes("backpack") ||
    ua.includes("slope") ||
    ua.includes("coinbasewallet") ||
    ua.includes("trust") ||
    ua.includes("metamask")
  );
}

function isStaticOrMetaAsset(pathname: string) {
  // "Never gate these"
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/logos/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap-") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/browserconfig.xml" ||
    pathname.startsWith("/.well-known/")
  ) {
    return true;
  }

  // File extensions
  return /\.(png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?|ttf|otf|webm|mp4|xml|json)$/i.test(
    pathname
  );
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const { pathname } = url;

  // Never gate preflight / probe methods
  if (req.method === "OPTIONS" || req.method === "HEAD") {
    return NextResponse.next();
  }

  // 🚨 ABSOLUTE BYPASS - robots/sitemaps MUST return 200, no redirect ever
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap-")
  ) {
    return NextResponse.next();
  }

  // Never gate static assets + meta assets
  if (isStaticOrMetaAsset(pathname)) {
    return NextResponse.next();
  }

  // Never gate API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Bot bypass (server-side, reliable for Bing)
  if (isIndexerBot(req)) {
    const res = NextResponse.next();
    res.headers.set("x-xessex-mw", "bot-bypass");
    res.headers.append("Vary", "User-Agent");
    return res;
  }

  // Allow the age page and its subroutes (avoid loops; required for /age/accept)
  if (pathname === "/age" || pathname.startsWith("/age/")) {
    return NextResponse.next();
  }

  // If user passed age gate, allow (support legacy cookie too)
  const ageOk =
    req.cookies.get("age_ok")?.value === "1" ||
    req.cookies.get("age_verified")?.value === "1";

  if (ageOk) return NextResponse.next();

  // Gate humans: redirect to /age and preserve full original path+query
  const redir = url.clone();
  redir.pathname = "/age";
  redir.searchParams.set("next", pathname + (url.search || ""));

  // Prefer 302/303 over 307 for a UX gate (avoid method preservation weirdness)
  const res = NextResponse.redirect(redir, 302);
  res.headers.set("x-xessex-mw", "redirect-age");

  // Wallet in-app browsers can be sticky about caching redirects
  if (isWalletInAppUA(req)) {
    res.headers.set("Cache-Control", "no-store");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
