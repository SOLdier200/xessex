import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent")?.toLowerCase() || "";
  const pathname = req.nextUrl.pathname;

  // Allow search engines (VERY IMPORTANT for SEO)
  if (
    ua.includes("bingbot") ||
    ua.includes("googlebot") ||
    ua.includes("duckduckbot") ||
    ua.includes("slurp") ||        // Yahoo
    ua.includes("yandex") ||
    ua.includes("baiduspider")
  ) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap")
  ) {
    return NextResponse.next();
  }

  // Age gate logic
  const hasAgeCookie = req.cookies.get("age_verified");

  if (!hasAgeCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/age";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except api routes, static files, and _next
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
