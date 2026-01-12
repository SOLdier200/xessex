import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=missing_code`, url.origin));
  }

  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session?.access_token) {
    console.error("server exchangeCodeForSession failed:", error);
    return NextResponse.redirect(new URL(`/login?error=auth_failed`, url.origin));
  }

  // At this point, server has set Supabase cookies.
  // Now redirect to callback page (client) to handoff to Prisma cookie creation.
  const redirectUrl = new URL(`/auth/callback`, url.origin);
  redirectUrl.searchParams.set("next", next);

  return NextResponse.redirect(redirectUrl);
}
