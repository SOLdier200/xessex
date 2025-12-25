import { NextRequest, NextResponse } from "next/server";

const AGE_COOKIE = "age_verified";
const AGE_PATH = "/age";

// Routes that should NOT be blocked
const PUBLIC_PATH_PREFIXES = [
  "/age",
  "/leave",
  "/privacy",
  "/terms",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

// Also allow common static assets
const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes and files
  if (
    PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const ageVerified = req.cookies.get(AGE_COOKIE)?.value === "1";

  if (!ageVerified) {
    const url = req.nextUrl.clone();
    url.pathname = AGE_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
      Run middleware on all routes except:
      - next internals (_next)
      - static files
    */
    "/((?!_next/static|_next/image).*)",
  ],
};
