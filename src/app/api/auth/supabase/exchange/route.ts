import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

const ORIGIN = process.env.PUBLIC_ORIGIN || "https://xessex.me";

function sanitizeNext(v: string | null) {
  if (!v) return "/signup";
  if (!v.startsWith("/") || v.startsWith("//")) return "/signup";
  return v;
}

export async function GET(req: NextRequest) {
  console.log("=== EXCHANGE ROUTE HIT v4 ===");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  // Debug: log cookies
  const cookie = req.headers.get("cookie") || "";
  const keys = cookie.split(";").map(s => s.trim().split("=")[0]);
  console.log("cookie keys:", keys);
  console.log("has code-verifier cookie?", keys.some(k => k.includes("code-verifier")));

  if (!code) {
    return NextResponse.redirect(`${ORIGIN}/login?error=missing_code`);
  }

  // Create server client that reads cookies from request
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // We don't need to set cookies here - just reading for exchange
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("server exchangeCodeForSession failed:", error);
    return NextResponse.redirect(`${ORIGIN}/login?error=auth_failed`);
  }

  console.log("exchangeCodeForSession SUCCESS!");

  // IMPORTANT: redirect, don't NextResponse.next()
  return NextResponse.redirect(`${ORIGIN}/auth/callback?next=${encodeURIComponent(next)}`);
}
