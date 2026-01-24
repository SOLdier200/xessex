import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return NextResponse.json({
      exists: false,
      cookieName: COOKIE_NAME,
      preview: null,
      message: "No session cookie found",
    });
  }

  return NextResponse.json({
    exists: true,
    cookieName: COOKIE_NAME,
    preview: sessionCookie.value.slice(0, 8) + "...",
    length: sessionCookie.value.length,
    message: "Session cookie exists",
  });
}
