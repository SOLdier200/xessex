"use client";

import { supabase } from "@/lib/supabase";

type GoogleSignupButtonProps = {
  label?: string;
  redirectTo?: string;
};

export default function GoogleSignupButton({
  label = "Sign in with Google",
  redirectTo,
}: GoogleSignupButtonProps) {
  const signIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const origin = isLocal
      ? `http://${window.location.host}` // force HTTP locally
      : window.location.origin;

    const target = redirectTo
      ? new URL(redirectTo, origin).toString()
      : `${origin}/auth/callback`;

    console.log("OAuth redirectTo:", target);

    // Store plan in localStorage before OAuth (survives the redirect)
    if (redirectTo?.includes("plan=")) {
      const m = redirectTo.match(/plan=(MM|MY|DM|DY)/);
      if (m?.[1]) localStorage.setItem("selected_plan", m[1]);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target },
    });

    if (error) console.error("OAuth start error:", error);
    else console.log("OAuth started:", data);

    // Debug: verify PKCE verifier was stored (check all storage backends)
    setTimeout(() => {
      const ssKeys = Object.keys(sessionStorage);
      const lsKeys = Object.keys(localStorage);

      const ssHit = ssKeys.find(k => k.includes("code-verifier") || k.includes("code_verifier") || k.includes("pkce"));
      const lsHit = lsKeys.find(k => k.includes("code-verifier") || k.includes("code_verifier") || k.includes("pkce"));

      console.log("PKCE key sessionStorage?", !!ssHit, ssHit);
      console.log("PKCE key localStorage?", !!lsHit, lsHit);
      console.log("cookie has sb-?", document.cookie.includes("sb-"));
    }, 50);
  };

  return (
    <button
      type="button"
      onClick={signIn}
      className="w-full flex items-center justify-center gap-3
        bg-white text-black font-semibold py-3 rounded-xl
        hover:bg-gray-100 transition shadow-lg"
    >
      <img src="/google.svg" alt="Google" className="w-5 h-5" />
      {label}
    </button>
  );
}
