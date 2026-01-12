import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  const body = await req.json().catch(() => null);
  const accessToken = String(body?.accessToken ?? "");
  const next = sanitizeNext(body?.next);

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "MISSING_TOKEN" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user) {
    console.error("supabase getUser failed:", error);
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 401 });
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
  const res = NextResponse.json({ ok: true, redirectTo: next });

  setSessionCookieOnResponse(res, session.token, session.expiresAt);
  return res;
}
