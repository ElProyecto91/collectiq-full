/**
 * Shared collection ("household") plumbing for the Supabase client.
 *
 * Every page asks for its data with `.eq('telegram_user_id', me)`. Rather than rewriting ~80 call sites, the
 * Supabase client is given the `scopedFetch` below: for the COLLECTION tables it widens
 * `telegram_user_id=eq.<me>` into `telegram_user_id=in.(<every member of my household>)`, so reads, edits and
 * deletes cover the whole household while inserts still carry the author's own id. Personal tables (xp,
 * streaks, notifications, ...) are NOT in the list and stay per person.
 *
 * It also attaches a short-lived JWT minted by the Worker (`/auth-token`) so the database can enforce who is who.
 * If the Worker cannot mint one (secret not configured yet) the client keeps using the anon key as before.
 */
import { API_BASE } from '@/config/api';
import { authHeaders, getSessionToken } from '@/lib/session-token';

/** Tables whose rows belong to the household as a whole. */
export const SHARED_TABLES = new Set([
  'collection_items', 'wishlist_items',
  'funko_collection', 'funko_wishlist',
  'user_collection', 'user_wishlist',
  'user_lego_sets', 'user_lego_parts', 'user_lego_set_allocations',
]);

const STORE_KEY = 'collectiq-household';
interface Scope { me: number; ids: number[] }

function readScope(): Scope | null {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Scope;
    return s && typeof s.me === 'number' && Array.isArray(s.ids) ? s : null;
  } catch { return null; }
}

/** What this page load already knows, so the scope works even when storage is unavailable. */
let mem: Scope | null = null;

/**
 * Remember who shares my collection (called after login and after any change to the group).
 * Returns true only when the members CHANGED and the new value was really saved: that is the one case
 * where reloading helps. If it could not be saved, a reload would find the old value again and loop.
 */
export function setHouseholdScope(me: number, memberIds: number[]): boolean {
  const ids = Array.from(new Set([me, ...memberIds])).sort((a, b) => a - b);
  const prev = readScope();
  const before = prev && prev.me === me ? prev.ids : [me]; // nothing stored == just me
  const next: Scope = { me, ids };
  mem = next;
  let saved = false;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    saved = localStorage.getItem(STORE_KEY) === JSON.stringify(next);
  } catch { /* private mode: works for this page load only */ }
  return saved && before.join(',') !== ids.join(',');
}

/** Only on an explicit sign-out. NEVER at startup: before the session loads there is no user yet. */
export function clearHouseholdScope(): void {
  mem = null;
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
  tokenCache = null;
}

/**
 * Reload so every page re-reads with the new scope, at most once a minute: whatever else goes wrong, the app
 * can never end up reloading in a loop. Without sessionStorage we cannot guard, so we do not reload.
 */
export function reloadForNewScope(): void {
  const KEY = 'collectiq-household-reload';
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { return; }
  window.location.reload();
}

/** Pure: rewrite one PostgREST URL for the household. Returns the same string when nothing applies. */
export function widenUrl(url: string, scope: Scope | null, restBase: string, method = 'GET'): string {
  if (!scope || scope.ids.length < 2 || !url.startsWith(restBase)) return url;
  const u = new URL(url);
  // Reads cover the whole household. Edits/deletes only when they target one row by `id` (a member may fix a
  // card another member added); a filter by (user, part, ...) must keep hitting the caller's own rows only.
  const m = method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && !u.searchParams.has('id')) return url;
  const table = u.pathname.split('/').pop() ?? '';
  if (!SHARED_TABLES.has(table)) return url;
  const mine = `eq.${scope.me}`;
  let changed = false;
  const params = new URLSearchParams();
  u.searchParams.forEach((v, k) => {
    if (k === 'telegram_user_id' && v === mine) { params.append(k, `in.(${scope.ids.join(',')})`); changed = true; }
    else params.append(k, v);
  });
  if (!changed) return url;
  u.search = params.toString();
  return u.toString();
}

// ── JWT for the database (minted by the Worker) ──────────────────────────────
let tokenCache: { jwt: string; exp: number } | null = null;
let tokenInflight: Promise<string | null> | null = null;
let tokenUnavailableUntil = 0;

async function dbToken(): Promise<string | null> {
  if (!getSessionToken()) return null;
  const now = Date.now();
  if (tokenCache && tokenCache.exp - 300_000 > now) return tokenCache.jwt;
  if (now < tokenUnavailableUntil) return null;
  if (!tokenInflight) {
    tokenInflight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth-token`, { headers: authHeaders() });
        if (!res.ok) { tokenUnavailableUntil = Date.now() + 10 * 60_000; return null; }
        const body = (await res.json()) as { token?: string; expires_at?: number };
        if (!body.token) { tokenUnavailableUntil = Date.now() + 10 * 60_000; return null; }
        tokenCache = { jwt: body.token, exp: (body.expires_at ?? 0) * 1000 };
        return body.token;
      } catch {
        tokenUnavailableUntil = Date.now() + 60_000;
        return null;
      } finally { tokenInflight = null; }
    })();
  }
  return tokenInflight;
}

/** `fetch` handed to the Supabase client. */
export function makeScopedFetch(supabaseUrl: string): typeof fetch {
  const restBase = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/`;
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : null;
    if (!url || !url.startsWith(restBase)) return fetch(input, init);
    const widened = widenUrl(url, readScope(), restBase, init?.method ?? 'GET');
    const jwt = await dbToken();
    if (!jwt) return fetch(widened, init);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${jwt}`);
    return fetch(widened, { ...init, headers });
  };
}

/** Ids of the other people sharing my collection (empty when alone). */
export function otherMemberIds(): number[] {
  const s = readScope();
  return s ? s.ids.filter((i) => i !== s.me) : [];
}

/** Load my household from the Worker and remember it. Returns true when the scope changed. */
export async function syncHouseholdScope(me: number): Promise<boolean> {
  if (!getSessionToken()) return false;
  try {
    const res = await fetch(`${API_BASE}/household`, { headers: authHeaders() });
    if (!res.ok) return false;
    const s = (await res.json()) as { members?: { telegram_user_id: number }[] };
    return setHouseholdScope(me, (s.members ?? []).map((m) => m.telegram_user_id));
  } catch { return false; }
}
