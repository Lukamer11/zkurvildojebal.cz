// core/supabaseClient.js - Supabase klient

const SUPABASE_URL = 'https://bmmaijlbpwgzhrxzxphf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZnZveGxjb2Npd3R5b2Jhb3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3OTQ3MTgsImV4cCI6MjA4MzM3MDcxOH0.ydY1I-rVv08Kg76wI6oPgAt9fhUMRZmsFxpc03BhmkA';

let supabaseClient = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;
  
  if (typeof window !== 'undefined' && window.supabase) {
    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('âœ… Supabase client created');
    return supabaseClient;
  }
  
  throw new Error('Supabase library not loaded');
}

export default getSupabase;
