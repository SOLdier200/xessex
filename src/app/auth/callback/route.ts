import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookieOnResponse } from "@/lib/authCookies";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";

export const runtime = "nodejs";

type EffectiveTier = "FREE" | "MEMBER" | "DIAMOND";

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  return nextValue;
}

function getEffectiveTier(sub?: { status: any; expiresAt: Date | null; tier: any }): EffectiveTier {
  if (!sub) return "FREE";

  const now = Date.now();
  const notExpired = !!sub.expiresAt && sub.expiresAt.getTime() > now;

  // ACTIVE = real paid
  if (sub.status === "ACTIVE") {
    const ok = !sub.expiresAt || sub.expiresAt.getTime() > now;
    if (ok) return sub.tier === "DIAMOND" ? "DIAMOND" : "MEMBER";
    return "FREE";
  }

  // PENDING + future expiresAt = provisional access
  if (sub.status === "PENDING" && notExpired) {
    return sub.tier === "DIAMOND" ? "DIAMOND" : "MEMBER";
  }

  return "FREE";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = sanitizeNext(nextParam);

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Exchange code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", url.origin));
  }

  const supabaseUser = data.user;
  const email = supabaseUser.email;
  const supabaseId = supabaseUser.id;
  const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name;

  if (!email) {
    return NextResponse.redirect(new URL("/login?error=no_email", url.origin));
  }

  // Upsert user in Prisma
  let user = await db.user.findFirst({
    where: {
      OR: [
        { supabaseId },
        { email },
      ],
    },
    include: { subscription: true },
  });

  if (!user) {
    // Create new user
    user = await db.user.create({
      data: {
        email,
        supabaseId,
      },
      include: { subscription: true },
    });
  } else if (!user.supabaseId) {
    // Link existing email user to Supabase
    user = await db.user.update({
      where: { id: user.id },
      data: { supabaseId },
      include: { subscription: true },
    });
  }

  // Create session for this user
  const { token, expiresAt } = await createSession(user.id);

  // IMPORTANT: set cookie on the response object
  const res = NextResponse.redirect(new URL(next, url.origin));
  setSessionCookieOnResponse(res, token, expiresAt);

  // Send welcome email ONCE (race-safe), tier-aware
  if (email && !user.welcomeEmailSentAt) {
    const tier = getEffectiveTier(user.subscription ?? undefined);

    try {
      const claimed = await db.user.updateMany({
        where: { id: user.id, welcomeEmailSentAt: null },
        data: { welcomeEmailSentAt: new Date() },
      });

      if (claimed.count === 1) {
        await sendWelcomeEmail({ to: email, name, tier });
      }
    } catch (e) {
      console.error("Failed to send welcome email:", e);
    }
  }

  return res;
}
