import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function sanitizeNext(nextValue: string | null | undefined) {
  if (!nextValue) return "/";
  // only allow same-origin relative paths
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  if (nextValue.startsWith("/age")) return "/";
  return nextValue;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const nextRaw = form.get("next");
  const next = sanitizeNext(typeof nextRaw === "string" ? nextRaw : null);

  // Redirect first (303 forces GET)
  const res = NextResponse.redirect(new URL(next, req.url), 303);

  // Keep SameSite=None for iOS wallet deep-link returns
  const maxAge = 60 * 60 * 24 * 365; // 1 year

  res.cookies.set("age_ok", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    domain: ".xessex.me",
    maxAge,
  });

  // Optional: keep if any legacy client code still reads it
  // If AgeGateEnforcer is removed, you can delete this cookie later.
  res.cookies.set("age_verified", "1", {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    domain: ".xessex.me",
    maxAge,
  });

  return res;
}
