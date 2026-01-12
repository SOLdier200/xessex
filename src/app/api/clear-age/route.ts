import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect(new URL("/age", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001"));

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
