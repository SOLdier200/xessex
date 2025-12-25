import { NextRequest, NextResponse } from "next/server";

const AGE_COOKIE = "age_verified";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const accept = body?.accept === true;

  const res = NextResponse.json({ ok: true });

  if (accept) {
    // 30 days
    res.cookies.set(AGE_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else {
    // Clear cookie
    res.cookies.set(AGE_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
    });
  }

  return res;
}
