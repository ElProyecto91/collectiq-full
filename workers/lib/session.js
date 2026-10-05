// ── Who is calling: the app's session token (same one the LEGO scanner uses) ──
import { sbGet } from './supabase.js';

// Returns the Telegram user id of a valid, unexpired session, or null.
export async function sessionUserId(request) {
  var auth = request.headers.get('Authorization') || '';
  var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7).trim() : '';
  if (!token) return null;
  var rows = await sbGet('user_sessions', 'token=eq.' + encodeURIComponent(token) + '&select=telegram_user_id,expires_at&limit=1');
  var row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row.telegram_user_id;
}
