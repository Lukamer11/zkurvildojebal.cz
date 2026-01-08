
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://bmmaijlbpwgzhrxzxphf.supabase.co";
// ⬇⬇⬇ VLOŽ SI SEM SVŮJ ANON PUBLIC KEY ⬇⬇⬇
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA";

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
