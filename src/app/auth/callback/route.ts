import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { setSessionCookie } from "@/lib/authCookies";
import { sendWelcomeEmail } from "@/lib/email/sendWelcomeEmail";

type EffectiveTier = "FREE" | "MEMBER" | "DIAMOND";

function getEffectiveTier(sub?: { status: any; expiresAt: Date | null; tier: any }): EffectiveTier {
  if (!sub) return "FREE";

  const now = Date.now();
  const notExpired = !sub.expiresAt || sub.expiresAt.getTime() > now;

  if (sub.status === "ACTIVE" && notExpired) {
    return sub.tier === "DIAMOND" ? "DIAMOND" : "MEMBER";
  }

  return "FREE";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Exchange code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }

  const supabaseUser = data.user;
  const email = supabaseUser.email;
  const supabaseId = supabaseUser.id;
  const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name;

  if (!email) {
    return NextResponse.redirect(new URL("/login?error=no_email", req.url));
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
  await setSessionCookie(token, expiresAt);

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

  return NextResponse.redirect(new URL("/", req.url));
}
