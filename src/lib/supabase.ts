// src/lib/supabase.ts
// Re-export for backward compatibility - use supabase-browser.ts for new code
import { supabaseBrowser } from "./supabase-browser";

export const supabase = supabaseBrowser();
