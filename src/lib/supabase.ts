import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,        // keep verifier in localStorage until exchange
      autoRefreshToken: false,     // don't refresh Supabase tokens
      detectSessionInUrl: true,    // let client exchange PKCE code
    },
  }
);
