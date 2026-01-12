import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Use request URL origin to avoid hardcoded port issues
  const origin = request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/age", origin));

  // Clear the age verification cookie
  response.cookies.set("age_verified", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Expire immediately
    path: "/",
  });
  response.cookies.set("age_ok", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
