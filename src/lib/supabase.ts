import { createClient } from "@supabase/supabase-js";

// Fallbacks keep `next build` from crashing when env vars are missing.
// Real values MUST be set in .env.local and in Vercel project settings.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
export const envReady = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(url, key);
