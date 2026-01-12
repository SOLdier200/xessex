import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { next } = await req.json().catch(() => ({ next: "/" }));

  const res = NextResponse.json({ ok: true, next });

  // Session cookie: no maxAge/expires => cleared when browser closes
  res.cookies.set("age_ok", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.cookies.set("age_verified", "true", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  // Avoid caching
  res.headers.set("Cache-Control", "no-store");

  return res;
}
