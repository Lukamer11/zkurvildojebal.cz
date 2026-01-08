
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://bmmaijlbpwgzhrxzxphf.supabase.co";
// ⬇⬇⬇ VLOŽ SI SEM SVŮJ ANON PUBLIC KEY ⬇⬇⬇
const SUPABASE_KEY = "PASTE_YOUR_ANON_PUBLIC_KEY_HERE";

let sb = null;

export function getSupabase() {
  if (!sb) {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
    console.log("🟢 Supabase singleton ready");
  }
  return sb;
}
