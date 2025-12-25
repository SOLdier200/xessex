import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/age",
  "/terms",
  "/privacy",
  "/robots.txt",
  "/sitemap.xml",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow next internals + static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Check age cookie
  const ageOk = req.cookies.get("age_ok")?.value === "1";
  if (ageOk) return NextResponse.next();

  // Redirect to age gate, preserve destination
  const url = req.nextUrl.clone();
  url.pathname = "/age";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api).*)"], // keep APIs reachable if you want
};
