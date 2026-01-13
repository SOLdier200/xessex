import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(url, key, {
    auth: {
      flowType: "pkce",
      persistSession: false,      // you still use your Prisma session cookie
      autoRefreshToken: false,
      detectSessionInUrl: false,  // your server exchange route handles it
    },
  });
}
