import { NextRequest, NextResponse } from "next/server";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (nextValue.startsWith("/") && !nextValue.startsWith("//")) {
    return nextValue;
  }
  return "/";
}

export function GET(request: NextRequest) {
  const nextValue = request.nextUrl.searchParams.get("next");
  const nextPath = sanitizeNext(nextValue);
  const redirectUrl = new URL(nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set({
    name: "age_ok",
    value: "1",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    httpOnly: false,
  });

  return response;
}
