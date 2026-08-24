// api/reputation.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id es obligatorio' });

  const { data, error } = await supabase
    .from('user_reputation')
    .select('*')
    .eq('telegram_user_id', user_id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  // Si no existe aún, devolver valores por defecto
  if (!data) {
    return res.status(200).json({
      reputation: {
        telegram_user_id: Number(user_id),
        score: 5.0,
        transactions_completed: 0,
        items_verified: 0,
        badges: []
      }
    });
  }

  return res.status(200).json({ reputation: data });
}