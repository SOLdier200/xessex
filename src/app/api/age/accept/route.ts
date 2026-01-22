import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { next } = await req.json().catch(() => ({ next: "/" }));

  const res = NextResponse.json({ ok: true, next });

  // Avoid caching
  res.headers.set("Cache-Control", "no-store");

  return res;
}
