import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabase = createClient(
  'https://wngzgptxrgfrwuyiyueu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduZ3pncHR4cmdmcnd1eWl5dWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQzNTYsImV4cCI6MjA4MzU1MDM1Nn0.N-UJpDi_CQVTC6gYFzYIFQdlm0C4x6K7GjeXGzdS8No',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  }
);

// Global guard: pokud není session, poslat na login.html
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const back = encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash);
    location.href = 'login.html?next=' + back;
  }
}

// Helper: když je už přihlášenej, přesměruj ho pryč z loginu
export async function redirectIfAuthed(defaultPage = 'menu.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) location.href = defaultPage;
}
