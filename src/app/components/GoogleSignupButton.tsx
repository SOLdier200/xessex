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
    try {
      const target = redirectTo
        ? new URL(redirectTo, window.location.origin).toString()
        : `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: target },
      });

      if (error) console.error("OAuth start error:", error);
      else console.log("OAuth started:", data);
    } catch (err) {
      console.error("OAuth start exception:", err);
    }
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
