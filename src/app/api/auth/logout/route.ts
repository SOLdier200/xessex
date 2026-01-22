import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/authCookies";

export const runtime = "nodejs";

const COOKIE_NAME = process.env.XESSEX_SESSION_COOKIE || "xessex_session";

/**
 * POST /api/auth/logout
 *
 * Clears session from DB and removes cookie.
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await db.session.delete({ where: { token } }).catch(() => {});
  }

  await clearSessionCookie();

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}
