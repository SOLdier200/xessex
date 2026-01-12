import { NextRequest, NextResponse } from "next/server";

const AGE_COOKIE = "age_verified";
const AGE_PATH = "/age";

// Routes that should NOT be blocked
const PUBLIC_PATH_PREFIXES = [
  "/age",
  "/leave",
  "/parental-controls",
  "/privacy",
  "/terms",
  "/api",
  "/auth/callback",  // OAuth callback - must not be gated
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/icons",
  "/manifest",
  "/site.webmanifest",
];

// Also allow common static assets
const PUBLIC_FILE = /\.(.*)$/;

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow public routes and files
  if (
    PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const ageVerifiedValue = req.cookies.get(AGE_COOKIE)?.value;
  const ageOkValue = req.cookies.get("age_ok")?.value;
  const ageVerified =
    ageVerifiedValue === "true" || ageVerifiedValue === "1" || ageOkValue === "1";

  if (!ageVerified) {
    const url = req.nextUrl.clone();
    url.pathname = AGE_PATH;
    url.searchParams.set("next", pathname + (search ? search : ""));
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
