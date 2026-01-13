import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

// Force canonical external origin (never localhost from proxy)
const ORIGIN = process.env.PUBLIC_ORIGIN || "https://xessex.me";

function sanitizeNext(v: string | null) {
  if (!v) return "/signup";
  if (!v.startsWith("/") || v.startsWith("//")) return "/signup";
  return v;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const next = sanitizeNext(url.searchParams.get("next"));

    if (!code) {
      return NextResponse.redirect(`${ORIGIN}/login?error=missing_code`);
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error("server exchangeCodeForSession failed:", error);
      return NextResponse.redirect(`${ORIGIN}/login?error=auth_failed`);
    }

    // Redirect to callback page (no code), carry next through
    return NextResponse.redirect(`${ORIGIN}/auth/callback?next=${encodeURIComponent(next)}`);
  } catch (e) {
    console.error("exchange route fatal:", e);
    return NextResponse.json(
      { ok: false, error: "EXCHANGE_FATAL" },
      { status: 500 }
    );
  }
}
