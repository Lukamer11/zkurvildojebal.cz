import { requireAuth } from './authGuard.js';

(async () => {
  try {
    await requireAuth();
  } catch (e) {
    console.error('Auth guard error:', e);
    // fallback to login
    location.href = 'login.html';
  }
})();
