import { NextRequest, NextResponse } from "next/server";

const AGE_COOKIE = "age_verified";
const AGE_PATH = "/age";

const PUBLIC_PATH_PREFIXES = [
  "/age",
  "/leave",
  "/parental-controls",
  "/privacy",
  "/terms",
  "/api",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/icons",
  "/manifest",
  "/site.webmanifest",
];

const PUBLIC_FILE = /\.(.*)$/;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (
    PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
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
  matcher: ["/((?!_next/static|_next/image).*)"],
};
