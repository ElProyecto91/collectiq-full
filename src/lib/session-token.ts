/** The app's session token (the one the Worker and the Vercel functions verify in user_sessions). */
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem('auth_token') || localStorage.getItem('collectiq-session-token');
  } catch {
    return null;
  }
}

/** Headers for a call to our own backend: JSON plus the session as a Bearer token. */
export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getSessionToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(extra ?? {}) };
}

/** Fire-and-forget progress report after a card is added (referrals). Never throws. */
export function reportCardsAdded(totalCards: number): void {
  fetch('/api/scans', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ action: 'check_referral', totalCards }) }).catch(() => undefined);
}
