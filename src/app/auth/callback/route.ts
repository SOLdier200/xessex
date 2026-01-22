import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/route";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookieOnResponse } from "@/lib/authCookies";

export const runtime = "nodejs";

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  return nextValue;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = sanitizeNext(url.searchParams.get("next"));

  const { supabase, res: sbRes } = supabaseRoute(req);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.error("supabase getUser (cookie) failed:", error);
    return NextResponse.redirect("https://xessex.me/login?error=session_failed");
  }

  const sbUser = data.user;
  const sbId = sbUser.id;
  const email = (sbUser.email || "").toLowerCase().trim() || null;

  const existing =
    (await db.user.findUnique({ where: { supabaseId: sbId } })) ||
    (email ? await db.user.findUnique({ where: { email } }) : null);

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          supabaseId: existing.supabaseId ?? sbId,
          email: existing.email ?? email ?? undefined,
        },
      })
    : await db.user.create({
        data: { supabaseId: sbId, email: email ?? undefined },
      });

  const session = await createSession(user.id);

  // Redirect directly - no client fetch hop needed
  const out = NextResponse.redirect(`https://xessex.me${next}`);

  // Carry over cookies that supabaseRoute set
  sbRes.headers.forEach((value, key) => out.headers.set(key, value));
  setSessionCookieOnResponse(out, session.token, session.expiresAt);

  return out;
}
