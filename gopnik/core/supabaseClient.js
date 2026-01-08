// core/supabaseClient.js — ESM singleton pro stránky, které jedou jako modules.
// Primárně ale projekt používá menu.js (globální window.supabaseClient / window.SF).
// Tenhle soubor držíme sjednocený na stejný URL/KEY, aby nedocházelo k duplicitám.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const DEFAULT_SUPABASE_URL = "https://jbfvoxlcociwtyobaotz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA";

const SUPABASE_URL =
  globalThis.SUPABASE_URL ||
  globalThis.localStorage?.getItem("SUPABASE_URL") ||
  DEFAULT_SUPABASE_URL;

const SUPABASE_KEY =
  globalThis.SUPABASE_ANON_KEY ||
  globalThis.localStorage?.getItem("SUPABASE_ANON_KEY") ||
  DEFAULT_SUPABASE_ANON_KEY;

let sb = null;

export function getSupabase() {
  if (!sb) {
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: globalThis.localStorage,
      },
    });
    console.log("🟢 Supabase ESM singleton ready");
  }
  return sb;
}
