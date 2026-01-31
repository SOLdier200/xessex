import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/age/accept
 * Sets age verification cookie server-side for reliable persistence
 * on iOS/wallet browsers where client-side cookies are flaky.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Set httpOnly cookie for server-side checks (more secure)
  res.cookies.set("age_ok", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "none", // Required for wallet in-app browsers
    path: "/",
    domain: ".xessex.me", // Works for both www and root domain
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  // Set readable cookie for client-side JS checks (AgeGateEnforcer)
  // Not httpOnly so document.cookie can read it
  res.cookies.set("age_verified", "1", {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    domain: ".xessex.me",
    maxAge: 60 * 60 * 24 * 365,
  });

  return res;
}
