import { NextRequest, NextResponse } from "next/server";
import { supabaseRoute } from "@/lib/supabase/route";

export const runtime = "nodejs";

const ORIGIN = process.env.PUBLIC_ORIGIN || "https://xessex.me";

function sanitizeNext(v: string | null) {
  if (!v) return "/signup";
  if (!v.startsWith("/") || v.startsWith("//")) return "/signup";
  return v;
}

export async function GET(req: NextRequest) {
  console.log("=== EXCHANGE ROUTE HIT v3 ===");

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

  const { supabase, res } = supabaseRoute(req);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error("server exchangeCodeForSession failed:", error);
    // IMPORTANT: return redirect *with res cookies* so state cleanup persists
    res.headers.set("Location", `${ORIGIN}/login?error=auth_failed`);
    return new NextResponse(null, { status: 307, headers: res.headers });
  }

  console.log("exchangeCodeForSession SUCCESS!");

  res.headers.set(
    "Location",
    `${ORIGIN}/auth/callback?next=${encodeURIComponent(next)}`
  );
  return new NextResponse(null, { status: 307, headers: res.headers });
}
