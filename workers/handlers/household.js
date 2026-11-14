// ── HOUSEHOLD: several people sharing one CollectIQ collection, by invitation ──
// Tables: households, household_members, household_invites (RLS on, no anon policy:
// only this Worker, with the service role, can touch them). See
// supabase/migrations/20261101090000_households.sql
import { jsonResponse } from '../lib/cors.js';
import { sbFetch, sbGet } from '../lib/supabase.js';
import { sessionUserId } from '../lib/session.js';

var INVITE_TTL_HOURS = 48;
var MAX_ACTIVE_INVITES = 5;
var MAX_MEMBERS = 8;
// no 0/O/1/I/L: the code is read aloud or typed from a chat message
var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode() {
  var bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  var out = '';
  for (var i = 0; i < bytes.length; i++) out += CODE_ALPHABET.charAt(bytes[i] % CODE_ALPHABET.length);
  return out;
}

function cleanCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function nowIso() { return new Date().toISOString(); }

// "Nombre" shown to the other members, taken from the session (Telegram profile), never from the client.
async function displayNameOf(request, userId) {
  try {
    var auth = request.headers.get('Authorization') || '';
    var token = auth.slice(7).trim();
    var rows = await sbGet('user_sessions', 'token=eq.' + encodeURIComponent(token) + '&select=user_data&limit=1');
    var d = Array.isArray(rows) && rows[0] ? rows[0].user_data : null;
    if (d) return String(d.first_name || d.username || userId).slice(0, 60);
  } catch (e) { /* fall through */ }
  return String(userId);
}

async function membershipOf(userId) {
  var r = await sbFetch('/household_members?telegram_user_id=eq.' + userId + '&select=household_id,role&limit=1');
  if (!r.ok || !Array.isArray(r.data)) return null;
  return r.data[0] || null;
}

async function membersOf(householdId) {
  var r = await sbFetch('/household_members?household_id=eq.' + householdId + '&select=telegram_user_id,role,display_name,joined_at&order=joined_at.asc');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

async function state(userId) {
  var m = await membershipOf(userId);
  if (!m) return { household: null };
  var h = await sbFetch('/households?id=eq.' + m.household_id + '&select=id,name&limit=1');
  var household = h.ok && Array.isArray(h.data) ? h.data[0] : null;
  if (!household) return { household: null };
  var members = await membersOf(m.household_id);
  var out = {
    household: { id: household.id, name: household.name },
    role: m.role,
    members: members.map(function (x) {
      return { telegram_user_id: x.telegram_user_id, role: x.role, display_name: x.display_name, joined_at: x.joined_at, is_me: String(x.telegram_user_id) === String(userId) };
    }),
    invites: [],
  };
  var inv = await sbFetch('/household_invites?household_id=eq.' + m.household_id + '&used_at=is.null&expires_at=gt.' + encodeURIComponent(nowIso()) + '&select=code,expires_at&order=created_at.desc');
  if (inv.ok && Array.isArray(inv.data)) out.invites = inv.data;
  return out;
}

// Creates a household with the user as owner, unless they already belong to one.
async function ensureHousehold(request, userId) {
  var m = await membershipOf(userId);
  if (m) return m.household_id;
  var created = await sbFetch('/households', { method: 'POST', prefer: 'return=representation', body: { created_by: userId } });
  var h = created.ok && Array.isArray(created.data) ? created.data[0] : null;
  if (!h) return null;
  var name = await displayNameOf(request, userId);
  var mem = await sbFetch('/household_members', { method: 'POST', body: { household_id: h.id, telegram_user_id: userId, role: 'owner', display_name: name } });
  if (!mem.ok) {
    await sbFetch('/households?id=eq.' + h.id, { method: 'DELETE' });
    return null;
  }
  return h.id;
}

async function actionInvite(request, userId) {
  var hid = await ensureHousehold(request, userId);
  if (!hid) return jsonResponse({ error: 'household_failed' }, 500);
  var members = await membersOf(hid);
  if (members.length >= MAX_MEMBERS) return jsonResponse({ error: 'household_full' }, 409);
  var active = await sbFetch('/household_invites?household_id=eq.' + hid + '&used_at=is.null&expires_at=gt.' + encodeURIComponent(nowIso()) + '&select=code');
  if (active.ok && Array.isArray(active.data) && active.data.length >= MAX_ACTIVE_INVITES) {
    return jsonResponse({ error: 'too_many_invites' }, 429);
  }
  var expires = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();
  for (var attempt = 0; attempt < 3; attempt++) {
    var code = makeCode();
    var ins = await sbFetch('/household_invites', { method: 'POST', body: { code: code, household_id: hid, created_by: userId, expires_at: expires } });
    if (ins.ok) return jsonResponse({ ok: true, code: code, expires_at: expires });
  }
  return jsonResponse({ error: 'invite_failed' }, 500);
}

async function actionJoin(request, userId, body) {
  var code = cleanCode(body.code);
  if (code.length !== 8) return jsonResponse({ error: 'bad_code' }, 400);

  var mine = await membershipOf(userId);
  if (mine) {
    var mine_members = await membersOf(mine.household_id);
    if (mine_members.length > 1) return jsonResponse({ error: 'already_in_household' }, 409);
  }

  // Burn the invite first, atomically: only one caller can flip used_at from null.
  var claim = await sbFetch(
    '/household_invites?code=eq.' + code + '&used_at=is.null&expires_at=gt.' + encodeURIComponent(nowIso()),
    { method: 'PATCH', prefer: 'return=representation', body: { used_by: userId, used_at: nowIso() } }
  );
  var inv = claim.ok && Array.isArray(claim.data) ? claim.data[0] : null;
  if (!inv) return jsonResponse({ error: 'invalid_code' }, 404);

  async function release() {
    await sbFetch('/household_invites?code=eq.' + code, { method: 'PATCH', body: { used_by: null, used_at: null } });
  }

  if (mine && String(mine.household_id) === String(inv.household_id)) {
    await release();
    return jsonResponse({ error: 'same_household' }, 409);
  }
  var target = await membersOf(inv.household_id);
  if (target.length >= MAX_MEMBERS) { await release(); return jsonResponse({ error: 'household_full' }, 409); }

  // Alone in a household of their own: drop it (their data stays: rows keep their telegram_user_id).
  if (mine) await sbFetch('/households?id=eq.' + mine.household_id, { method: 'DELETE' });

  var name = await displayNameOf(request, userId);
  var mem = await sbFetch('/household_members', { method: 'POST', body: { household_id: inv.household_id, telegram_user_id: userId, role: 'member', display_name: name } });
  if (!mem.ok) { await release(); return jsonResponse({ error: 'join_failed' }, 500); }
  return jsonResponse(Object.assign({ ok: true }, await state(userId)));
}

async function actionLeave(userId) {
  var m = await membershipOf(userId);
  if (!m) return jsonResponse({ error: 'not_in_household' }, 404);
  await sbFetch('/household_members?telegram_user_id=eq.' + userId, { method: 'DELETE' });
  var rest = await membersOf(m.household_id);
  if (!rest.length) {
    await sbFetch('/households?id=eq.' + m.household_id, { method: 'DELETE' });
  } else if (m.role === 'owner') {
    // the oldest remaining member becomes the owner
    await sbFetch('/household_members?household_id=eq.' + m.household_id + '&telegram_user_id=eq.' + rest[0].telegram_user_id, { method: 'PATCH', body: { role: 'owner' } });
  }
  return jsonResponse({ ok: true, household: null });
}

async function actionRemove(userId, body) {
  var target = parseInt(body.userId, 10);
  if (!target || String(target) === String(userId)) return jsonResponse({ error: 'bad_user' }, 400);
  var m = await membershipOf(userId);
  if (!m || m.role !== 'owner') return jsonResponse({ error: 'not_owner' }, 403);
  var del = await sbFetch('/household_members?household_id=eq.' + m.household_id + '&telegram_user_id=eq.' + target, { method: 'DELETE', prefer: 'return=representation' });
  if (!del.ok || !Array.isArray(del.data) || !del.data.length) return jsonResponse({ error: 'not_found' }, 404);
  return jsonResponse(Object.assign({ ok: true }, await state(userId)));
}

async function actionRevoke(userId, body) {
  var code = cleanCode(body.code);
  var m = await membershipOf(userId);
  if (!m) return jsonResponse({ error: 'not_in_household' }, 404);
  await sbFetch('/household_invites?code=eq.' + code + '&household_id=eq.' + m.household_id + '&used_at=is.null', { method: 'DELETE' });
  return jsonResponse(Object.assign({ ok: true }, await state(userId)));
}

async function actionRename(userId, body) {
  var name = String(body.name || '').trim().slice(0, 60);
  if (!name) return jsonResponse({ error: 'bad_name' }, 400);
  var m = await membershipOf(userId);
  if (!m || m.role !== 'owner') return jsonResponse({ error: 'not_owner' }, 403);
  await sbFetch('/households?id=eq.' + m.household_id, { method: 'PATCH', body: { name: name } });
  return jsonResponse(Object.assign({ ok: true }, await state(userId)));
}

export async function handleHousehold(request) {
  var userId = await sessionUserId(request);
  if (!userId) return jsonResponse({ error: 'unauthorized' }, 401);

  if (request.method === 'GET') return jsonResponse(await state(userId));
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  var body = {};
  try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'bad_json' }, 400); }
  var action = body && body.action;

  if (action === 'invite') return actionInvite(request, userId);
  if (action === 'join')   return actionJoin(request, userId, body);
  if (action === 'leave')  return actionLeave(userId);
  if (action === 'remove') return actionRemove(userId, body);
  if (action === 'revoke') return actionRevoke(userId, body);
  if (action === 'rename') return actionRename(userId, body);
  return jsonResponse({ error: 'bad_action' }, 400);
}
