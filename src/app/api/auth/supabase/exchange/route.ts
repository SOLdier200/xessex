import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

// Hardcode canonical origin - no more guessing from headers
function getOrigin(_: NextRequest) {
  return "https://xessex.me";
}

function sanitizeNext(v: string | null) {
  if (!v) return "/signup";
  if (!v.startsWith("/") || v.startsWith("//")) return "/signup";
  return v;
}

function hashCode(code: string) {
  // simple stable-ish hash without crypto import (good enough for cookie keying)
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Cookie domain for cross-subdomain sharing
const COOKIE_DOMAIN = process.env.NODE_ENV === "production" ? ".xessex.me" : undefined;

const guardCookieBase = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  domain: COOKIE_DOMAIN,
};

export async function GET(req: NextRequest) {
  console.log("=== EXCHANGE ROUTE HIT v9 ===");

  const origin = getOrigin(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // ONE-TIME GUARD: if we already processed this exact `code`, skip.
  // This prevents the "first success, second fail" pattern.
  const codeKey = `sb_code_done_${hashCode(code)}`;
  const alreadyDone = req.cookies.get(codeKey)?.value === "1";
  if (alreadyDone) {
    console.log("exchange: code already processed; skipping re-exchange");
    return NextResponse.redirect(`${origin}/auth/callback?next=${encodeURIComponent(next)}`);
  }

  // Redirect response that we can attach cookies to
  const res = NextResponse.redirect(`${origin}/auth/callback?next=${encodeURIComponent(next)}`);

  // mark the code as "done" immediately to stop retries racing in
  // short TTL is enough (OAuth codes are one-time anyway)
  res.cookies.set(codeKey, "1", {
    ...guardCookieBase,
    maxAge: 60 * 5, // 5 minutes
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("server exchangeCodeForSession failed:", error);

    // if exchange failed, clear the guard so a fresh attempt can work
    res.cookies.set(codeKey, "0", {
      ...guardCookieBase,
      maxAge: 0,
    });

    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  console.log("exchangeCodeForSession SUCCESS! wrote cookies to redirect response");
  return res;
}
