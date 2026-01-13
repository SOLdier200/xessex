import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/route";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookieOnResponse } from "@/lib/authCookies";

export const runtime = "nodejs";

function sanitizeNext(nextValue: unknown) {
  const v = String(nextValue ?? "");
  if (!v) return "/";
  if (!v.startsWith("/") || v.startsWith("//")) return "/";
  return v;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const next = sanitizeNext((body as { next?: string }).next);

  const { supabase, res: sbRes } = supabaseRoute(req);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    console.error("supabase getUser (cookie) failed:", error);
    return NextResponse.json(
      { ok: false, error: "NO_SUPABASE_USER" },
      { status: 401, headers: sbRes.headers }
    );
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
        data: {
          supabaseId: sbId,
          email: email ?? undefined,
        },
      });

  const session = await createSession(user.id);
  const out = NextResponse.json({ ok: true, redirectTo: next }, { headers: sbRes.headers });
  setSessionCookieOnResponse(out, session.token, session.expiresAt);
  return out;
}
