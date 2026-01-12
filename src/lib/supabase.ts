import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: "pkce",
      persistSession: false,       // you use your own Prisma Session cookie
      autoRefreshToken: false,     // don't refresh Supabase tokens
      detectSessionInUrl: false,   // your server /auth/callback handles the exchange
    },
  }
);
