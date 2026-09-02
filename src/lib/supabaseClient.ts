import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local");
}

/**
 * Auth-only client — used for Google sign-in and to read the current
 * session's access token. All data reads/writes go through ictd_app_express
 * instead, which uses the service-role key server-side.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
