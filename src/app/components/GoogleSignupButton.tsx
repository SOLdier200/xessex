"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

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

    console.log("OAuth redirectTo:", target);

    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: target },
    });

    if (error) console.error("OAuth start error:", error);
    else console.log("OAuth started:", data);
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
