import { createBrowserClient } from "@supabase/ssr";
// Cookie-based session, so the server middleware can verify the same login.
export const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key");
