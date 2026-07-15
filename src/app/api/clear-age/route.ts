import { NextRequest, NextResponse } from "next/server";
import { cookieOptionsForHost } from "@/lib/authCookies";

export async function GET(request: NextRequest) {
  // Use request URL origin to avoid hardcoded port issues
  const origin = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/age", origin));
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const cookieBase = cookieOptionsForHost(host);

  // Clear the age verification cookie
  response.cookies.set("age_verified", "", {
    ...cookieBase,
    maxAge: 0, // Expire immediately
  });
  response.cookies.set("age_ok", "", {
    ...cookieBase,
    maxAge: 0,
  });

  return response;
}
