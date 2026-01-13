import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

/**
 * If the same ?code=... hits twice (double redirect, refresh, retry),
 * Supabase will succeed once and then return flow_state_not_found.
 * So we must make this route idempotent for a short window.
 */
const usedCodes = new Map<string, number>();
const USED_TTL_MS = 2 * 60_000; // 2 minutes

function cleanupUsedCodes() {
  const now = Date.now();
  for (const [k, t] of usedCodes) {
    if (now - t > USED_TTL_MS) usedCodes.delete(k);
  }
}
function alreadyUsed(code: string) {
  cleanupUsedCodes();
  const t = usedCodes.get(code);
  return t != null && Date.now() - t < USED_TTL_MS;
}
function markUsed(code: string) {
  cleanupUsedCodes();
  usedCodes.set(code, Date.now());
}

function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "xessex.me")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

function sanitizeNext(v: string | null) {
  if (!v) return "/signup";
  if (!v.startsWith("/") || v.startsWith("//")) return "/signup";
  return v;
}

export async function GET(req: NextRequest) {
  console.log("=== EXCHANGE ROUTE HIT v8 ===");

  const origin = getOrigin(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  // Always redirect to /auth/callback (your app's continuation point)
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // Prevent caches/proxies from doing anything "helpful"
  const baseRes = NextResponse.redirect(redirectTo);
  baseRes.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  baseRes.headers.set("Pragma", "no-cache");
  baseRes.headers.set("Expires", "0");

  // Debug cookies
  const cookieHeader = req.headers.get("cookie") || "";
  const keys = cookieHeader.split(";").map((s) => s.trim().split("=")[0]);
  console.log("cookie keys:", keys);
  console.log("has code-verifier cookie?", keys.some((k) => k.includes("code-verifier")));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // HARD STOP: same code hits again -> do NOT call exchange again
  if (alreadyUsed(code)) {
    console.log("exchange: code already used (duplicate hit) -> skipping exchange");
    return baseRes;
  }

  // Also skip exchange if ANY auth-token cookie exists (not just .0/.1)
  const hasAnyAuthCookie = req.cookies
    .getAll()
    .some((c) => c.name.includes("-auth-token"));
  if (hasAnyAuthCookie) {
    console.log("exchange: auth-token cookie already present -> skipping exchange");
    return baseRes;
  }

  // Attach cookies to the redirect response
  const res = baseRes;

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

  // Mark used BEFORE calling exchange to survive ultra-fast duplicates
  markUsed(code);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("server exchangeCodeForSession failed:", error);

    // If we hit flow_state_not_found due to a duplicate/retry,
    // just continue to callback (the session may already exist after the first hit).
    if ((error as any)?.code === "flow_state_not_found") {
      console.log("exchange: flow_state_not_found -> treating as duplicate, continuing");
      return res;
    }

    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  console.log("exchangeCodeForSession SUCCESS! wrote cookies to redirect response");
  return res;
}
