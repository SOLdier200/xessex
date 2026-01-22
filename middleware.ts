import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isCrawler(uaRaw: string) {
  const ua = (uaRaw || "").toLowerCase();

  // Major search engines + common preview bots
  return (
    ua.includes("googlebot") ||
    ua.includes("bingbot") ||
    ua.includes("duckduckbot") ||
    ua.includes("slurp") || // Yahoo
    ua.includes("yandex") ||
    ua.includes("baiduspider") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("pinterest") ||
    ua.includes("discordbot") ||
    ua.includes("slackbot")
  );
}

function allowWithoutAge(pathname: string) {
  // Pages that should never be age-gated
  return (
    pathname.startsWith("/age") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/parental-controls") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/2257") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/link-wallet") ||
    pathname.startsWith("/link-auth-wallet") ||
    pathname.startsWith("/members-preview")
  );
}

function isStaticOrVerification(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/logos") ||
    pathname.startsWith("/yandex_") ||
    pathname.startsWith("/google") ||
    pathname.startsWith("/BingSiteAuth")
  ) {
    return true;
  }

  // file extensions
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|webmanifest|txt|xml)$/i.test(pathname);
}

function isProtectedMembersArea(pathname: string) {
  return (
    pathname === "/members" ||
    pathname.startsWith("/members/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/diamond" ||
    pathname.startsWith("/diamond/")
  );
}

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") || "";
  const pathname = req.nextUrl.pathname;

  // Never interfere with APIs or static/verification
  if (isStaticOrVerification(pathname)) return NextResponse.next();

  const crawler = isCrawler(ua);

  // Cookies - support both age cookie names
  const hasAgeCookie =
    !!req.cookies.get("age_verified")?.value ||
    !!req.cookies.get("age_ok")?.value;
  const hasSession = !!req.cookies.get("xessex_session")?.value;

  // 1) AGE GATE:
  // - Crawlers: NEVER redirect to /age (serve the page normally -> 200)
  // - Humans without cookie: REWRITE to /age (still 200), so no redirect chain
  if (!crawler && !hasAgeCookie && !allowWithoutAge(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/age";
    // Keep full path + query
    url.searchParams.set("next", pathname + (req.nextUrl.search || ""));
    return NextResponse.rewrite(url);
  }

  // 2) MEMBERS-ONLY:
  // - Crawlers: return a teaser page with 200 + NOINDEX header (prevents indexing gated pages)
  // - Humans: rewrite to /login with next=... (200, no redirect loop)
  if (isProtectedMembersArea(pathname) && !hasSession) {
    if (crawler) {
      const url = req.nextUrl.clone();
      url.pathname = "/members-preview";
      const res = NextResponse.rewrite(url);
      res.headers.set("X-Robots-Tag", "noindex, follow");
      return res;
    } else {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + (req.nextUrl.search || ""));
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except api and Next assets
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
