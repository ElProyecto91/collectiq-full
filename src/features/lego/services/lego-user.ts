import { getSupabase } from '@/lib/supabase';
import type { LegoPartItem, UserLegoAllocation, UserLegoPart, UserLegoSet, UserLegoSetInput } from '../types';

/**
 * LEGO data that belongs to the user (Supabase). Every query is scoped with
 * telegram_user_id on the client, like the rest of the app (see the security note in
 * supabase/migrations/20261004090000_lego_user_inventory.sql).
 */
const PAGE = 1000;        // Supabase caps a response at 1000 rows
const RPC_CHUNK = 500;    // items per add/remove call

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Aggregates duplicated (part, color) entries and drops empty ones. */
export function mergeItems(items: LegoPartItem[]): LegoPartItem[] {
  const map = new Map<string, LegoPartItem>();
  for (const it of items) {
    if (!(it.quantity > 0)) continue;
    const key = `${it.part_num}|${it.color_id}`;
    const cur = map.get(key);
    if (cur) cur.quantity += it.quantity;
    else map.set(key, { part_num: it.part_num, color_id: it.color_id, quantity: it.quantity });
  }
  return [...map.values()];
}

export async function listUserParts(telegramId: number): Promise<UserLegoPart[]> {
  const all: UserLegoPart[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from('user_lego_parts')
      .select('part_num,color_id,quantity,updated_at')
      .eq('telegram_user_id', telegramId)
      .order('part_num')
      .order('color_id')
      .range(from, from + PAGE - 1);
    fail(error);
    const rows = (data ?? []) as UserLegoPart[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

async function callInChunks(fn: 'add_lego_parts' | 'remove_lego_parts', telegramId: number, items: LegoPartItem[]): Promise<number> {
  const merged = mergeItems(items);
  let touched = 0;
  for (let i = 0; i < merged.length; i += RPC_CHUNK) {
    const { data, error } = await getSupabase().rpc(fn, {
      p_telegram_user_id: telegramId,
      p_items: merged.slice(i, i + RPC_CHUNK),
    });
    fail(error);
    touched += Number(data ?? 0);
  }
  return touched;
}

/** Adds quantities to the inventory, creating rows as needed. */
export const addUserParts = (telegramId: number, items: LegoPartItem[]) =>
  callInChunks('add_lego_parts', telegramId, items);

/** Subtracts quantities; rows that reach zero are deleted. */
export const removeUserParts = (telegramId: number, items: LegoPartItem[]) =>
  callInChunks('remove_lego_parts', telegramId, items);

/** Sets an exact quantity (0 removes the row). */
export async function setUserPartQuantity(telegramId: number, part: string, color: number, quantity: number): Promise<void> {
  const db = getSupabase();
  if (quantity <= 0) {
    const { error } = await db.from('user_lego_parts').delete()
      .eq('telegram_user_id', telegramId).eq('part_num', part).eq('color_id', color);
    fail(error);
    return;
  }
  const { error } = await db.from('user_lego_parts').upsert(
    { telegram_user_id: telegramId, part_num: part, color_id: color, quantity, updated_at: new Date().toISOString() },
    { onConflict: 'telegram_user_id,part_num,color_id' }
  );
  fail(error);
}

export async function listUserSets(telegramId: number): Promise<UserLegoSet[]> {
  const all: UserLegoSet[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from('user_lego_sets')
      .select('id,set_num,status,price_paid,rrp,notes,created_at')
      .eq('telegram_user_id', telegramId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    fail(error);
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map(toUserSet);
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toUserSet(r: Record<string, unknown>): UserLegoSet {
  return {
    id: String(r.id), set_num: String(r.set_num), status: r.status as UserLegoSet['status'],
    price_paid: numOrNull(r.price_paid), rrp: numOrNull(r.rrp),
    notes: r.notes == null ? null : String(r.notes), created_at: String(r.created_at),
  };
}

/** Adds an owned copy of a set and returns its id. */
export async function addUserSet(telegramId: number, input: UserLegoSetInput): Promise<string> {
  const { data, error } = await getSupabase().from('user_lego_sets')
    .insert({ telegram_user_id: telegramId, ...input }).select('id').single();
  fail(error);
  return String((data as { id: string }).id);
}

export async function updateUserSet(telegramId: number, id: string, patch: Partial<UserLegoSetInput>): Promise<void> {
  const { error } = await getSupabase().from('user_lego_sets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id).eq('telegram_user_id', telegramId);
  fail(error);
}

export async function deleteUserSet(telegramId: number, id: string): Promise<void> {
  const { error } = await getSupabase().from('user_lego_sets').delete()
    .eq('id', id).eq('telegram_user_id', telegramId);
  fail(error);
}

/** Part scans made today (UTC), from the counter the Worker keeps in lego_scans. */
export async function countScansToday(telegramId: number): Promise<number> {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  const { count, error } = await getSupabase()
    .from('lego_scans')
    .select('id', { count: 'exact', head: true })
    .eq('telegram_user_id', telegramId)
    .gte('scanned_at', start);
  fail(error);
  return count ?? 0;
}

/** Every reservation of loose parts by owned set copies. Deleting a copy deletes its rows (cascade). */
export async function listAllocations(telegramId: number): Promise<UserLegoAllocation[]> {
  const all: UserLegoAllocation[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabase()
      .from('user_lego_set_allocations')
      .select('user_set_id,part_num,color_id,quantity')
      .eq('telegram_user_id', telegramId)
      .order('user_set_id').order('part_num').order('color_id')
      .range(from, from + PAGE - 1);
    fail(error);
    const rows = (data ?? []) as UserLegoAllocation[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

/** Replaces the reservation of one set copy; the server clamps each quantity to what is free. */
export async function assignSetParts(telegramId: number, userSetId: string, items: LegoPartItem[]): Promise<number> {
  const { data, error } = await getSupabase().rpc('assign_lego_set_parts', {
    p_telegram_user_id: telegramId,
    p_user_set_id: userSetId,
    p_items: mergeItems(items),
  });
  fail(error);
  return Number(data ?? 0);
}

export const releaseSetParts = (telegramId: number, userSetId: string) => assignSetParts(telegramId, userSetId, []);
