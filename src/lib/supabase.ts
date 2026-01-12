// src/lib/supabase.ts
import { createBrowserClient } from "@supabase/ssr";

// NOTE: Supabase docs now mention "publishable key", but anon key works fine in most setups.
// If you later add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, swap it in here.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
