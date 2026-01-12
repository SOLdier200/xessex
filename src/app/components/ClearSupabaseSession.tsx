"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ClearSupabaseSession() {
  const clearSession = async () => {
    const supabase = supabaseBrowser();
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
