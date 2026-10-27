import { createClient } from "@supabase/supabase-js";

const env = (import.meta as any).env || (typeof process !== "undefined" ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabaseKey =
  env.VITE_SUPABASE_ANON_KEY?.trim() ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase =
  supabaseConfigured && supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null;

export function getSupabaseSetupMessage() {
  if (!supabaseUrl) return "VITE_SUPABASE_URL is not configured.";
  if (!supabaseKey) {
    return "VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) is not configured.";
  }
  return null;
}
