// authGuard.js — offline-friendly varianta
// Nepoužívá import z CDN (ten offline spadne). Spoléhá na window.supabase (supabase_stub.js nebo supabase-js).

const SUPABASE_URL = 'https://wngzgptxrgfrwuyiyueu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No';

const lib = (typeof window !== 'undefined') ? window.supabase : null;
const createClient = (lib && typeof lib.createClient === 'function') ? lib.createClient.bind(lib) : null;

export const supabase = createClient
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    })
  : null;

// Global guard: pokud není session, poslat na login.html
export async function requireAuth() {
  if (!supabase) {
    // když knihovna není načtená, chovej se jako „nepřihlášený“
    location.href = 'login.html';
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const back = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    location.href = 'login.html?next=' + back;
  }
}

// Helper: když je už přihlášenej, přesměruj ho pryč z loginu
export async function redirectIfAuthed(defaultPage = 'menu.html') {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) location.href = defaultPage;
}
