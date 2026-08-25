// @ts-nocheck
// api/onepiece-cards.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q = '', set = '', page = '1' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const pageSize = 20;
  const from = (pageNum - 1) * pageSize;

  let query = supabase
    .from('onepiece_cards')
    .select('*', { count: 'exact' })
    .range(from, from + pageSize - 1)
    .order('number');

  if (q) query = query.ilike('name', `%${q}%`);
  if (set) query = query.eq('set_id', (set as string).toUpperCase());

  const { data, count, error } = await query;

  if (error) return res.status(500).json({ cards: [], total: 0, error: error.message });

  return res.status(200).json({ cards: data ?? [], total: count ?? 0 });
}