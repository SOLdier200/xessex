"use client";

import { supabase } from "@/lib/supabase";

export default function GoogleSignupButton() {
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
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
      Sign in with Google
    </button>
  );
}
