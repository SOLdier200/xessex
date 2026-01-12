"use client";

import { supabase } from "@/lib/supabase";

export default function ClearSupabaseSession() {
  const clearSession = async () => {
    await supabase.auth.signOut();
    console.log("Supabase session cleared");
  };

  return (
    <button
      type="button"
      onClick={clearSession}
      className="text-white/50 text-sm underline hover:text-white/70 transition"
    >
      Clear cached session
    </button>
  );
}
