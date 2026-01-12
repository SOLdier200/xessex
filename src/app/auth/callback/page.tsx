// src/app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function sanitizeNext(nextValue: string | null) {
  if (!nextValue) return "/";
  if (!nextValue.startsWith("/") || nextValue.startsWith("//")) return "/";
  return nextValue;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
      const next = sanitizeNext(sp.get("next"));
      const code = sp.get("code");
      const oauthError = sp.get("error");
      const oauthErrorDesc = sp.get("error_description");

      if (oauthError) {
        console.error("Supabase OAuth callback error:", oauthError, oauthErrorDesc);
        router.replace(`/login?error=${encodeURIComponent(oauthError)}`);
        return;
      }

      if (!code) {
        console.error("Callback missing code. Full URL:", window.location.href);
        router.replace(`/login?error=missing_code`);
        return;
      }

      // PKCE exchange MUST happen in the browser (code_verifier lives here)
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !data.session?.access_token) {
        console.error("exchangeCodeForSession error:", error);
        router.replace(`/login?error=auth_failed`);
        return;
      }

      const accessToken = data.session.access_token;

      // Create Prisma session cookie (your real auth)
      const res = await fetch("/api/auth/supabase/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken, next }),
      }).catch(() => null);

      if (!res || !res.ok) {
        console.error("complete endpoint failed", res?.status);
        router.replace(`/login?error=session_failed`);
        return;
      }

      // Optional: clear Supabase session (Prisma cookie is your long-term session)
      await supabase.auth.signOut().catch(() => null);

      window.location.href = next;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <p>Signing you in…</p>
    </div>
  );
}
