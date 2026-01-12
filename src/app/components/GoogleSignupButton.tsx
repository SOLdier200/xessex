"use client";

import { supabase } from "@/lib/supabase";

type GoogleSignupButtonProps = {
  label?: string;
  redirectTo?: string;
};

export default function GoogleSignupButton({ label = "Sign in with Google", redirectTo }: GoogleSignupButtonProps) {
  const signIn = async () => {
    const target = redirectTo
      ? new URL(redirectTo, window.location.origin).toString()
      : `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: target,
      }
    });
  };

  return (
    <button
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
