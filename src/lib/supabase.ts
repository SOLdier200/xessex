import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,

      // Force storage that survives the OAuth redirect in-tab
      storage:
        typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  }
);
