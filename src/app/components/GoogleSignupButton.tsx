"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type GoogleSignupButtonProps = {
  label?: string;
  redirectTo?: string;
};

export default function GoogleSignupButton({
  label = "Sign in with Google",
  redirectTo,
}: GoogleSignupButtonProps) {
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    // Guard against in-app browsers where Google OAuth often fails
    const ua = navigator.userAgent || "";
    const isInApp =
      /FBAN|FBAV|Instagram|Line|MicroMessenger|Snapchat|Pinterest|wv|; wv\)/i.test(ua);

    if (isInApp) {
      alert("Google sign-in may fail inside in-app browsers. Open xessex.me in Chrome/Safari and try again.");
      setBusy(false);
      return;
    }

    // Use current origin so PKCE cookies match the redirect host
    // (www.xessex.me cookies won't be sent to xessex.me)
    const origin = window.location.origin;

    // Build the "next" parameter (where to go after auth completes)
    let nextPath = "/";
    if (redirectTo) {
      // Extract the path from redirectTo (e.g., /signup?plan=MM)
      try {
        const redirectUrl = new URL(redirectTo, origin);
        nextPath = redirectUrl.pathname + redirectUrl.search;
      } catch {
        nextPath = redirectTo;
      }
    }

    // Store plan in localStorage before OAuth (survives the redirect)
    const planMatch = nextPath.match(/plan=(MM|MY|DM|DY)/);
    if (planMatch?.[1]) {
      localStorage.setItem("selected_plan", planMatch[1]);
    }

    // Redirect to server exchange route (handles PKCE exchange server-side)
    const target = `${origin}/api/auth/supabase/exchange?next=${encodeURIComponent(nextPath)}`;

    console.log("OAuth redirectTo target:", target);

    const supabase = supabaseBrowser();

    // Debug: cookie BEFORE OAuth
    console.log("BEFORE OAuth - document.cookie:", document.cookie);
    console.log("BEFORE OAuth - has code-verifier?", document.cookie.includes("code-verifier"));

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target },
    });

    // Debug: cookie AFTER OAuth starts (before redirect)
    console.log("AFTER signInWithOAuth - document.cookie:", document.cookie);
    console.log("AFTER signInWithOAuth - has code-verifier?", document.cookie.includes("code-verifier"));

    console.log("OAuth started:", data);
    if (error) console.error("OAuth start error:", error);
  };

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="w-full flex items-center justify-center gap-3
        bg-white text-black font-semibold py-3 rounded-xl
        hover:bg-gray-100 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <img src="/google.svg" alt="Google" className="w-5 h-5" />
      {busy ? "Redirecting..." : label}
    </button>
  );
}
