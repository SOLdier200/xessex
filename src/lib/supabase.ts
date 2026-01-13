// src/lib/supabase.ts
// Re-export for backward compatibility - use @/lib/supabase/client.ts for new code
import { supabaseBrowser } from "./supabase/client";

export const supabase = supabaseBrowser();
