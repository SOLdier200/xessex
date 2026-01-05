import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow the gate itself + the API that sets the cookie + assets
  if (
    pathname.startsWith("/age") ||
    pathname.startsWith("/leave") ||
    pathname.startsWith("/api/age") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/logos") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  const ageOk = req.cookies.get("age_ok")?.value === "1";
  if (ageOk) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/age";
  url.searchParams.set("next", pathname + search);

  const res = NextResponse.redirect(url);
  // Prevent caching weirdness
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
