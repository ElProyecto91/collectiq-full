// api/wishlist.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  let telegram_user_id: number;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    telegram_user_id = payload.telegram_user_id;
    if (!telegram_user_id) throw new Error();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (req.method === 'GET') {
    const { tcg } = req.query;
    let query = supabase
      .from('user_wishlist')
      .select('*')
      .eq('telegram_user_id', telegram_user_id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false });

    if (tcg) query = query.eq('tcg', tcg);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data });
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (!body.tcg || !body.name) {
      return res.status(400).json({ error: 'tcg y name son obligatorios' });
    }

    // Evitar duplicados en wishlist
    const { data: existing } = await supabase
      .from('user_wishlist')
      .select('id')
      .eq('telegram_user_id', telegram_user_id)
      .eq('tcg', body.tcg)
      .eq('external_card_id', body.external_card_id ?? '')
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ item: existing, action: 'already_exists' });
    }

    const { data, error } = await supabase
      .from('user_wishlist')
      .insert({
        telegram_user_id,
        tcg: body.tcg,
        catalog_item_id: body.catalog_item_id ?? null,
        external_card_id: body.external_card_id ?? null,
        name: body.name,
        set_name: body.set_name ?? null,
        number: body.number ?? null,
        image_url: body.image_url ?? null,
        rarity: body.rarity ?? null,
        variant: body.variant ?? null,
        language: body.language ?? 'en',
        max_price: body.max_price ?? null,
        condition: body.condition ?? 'NM',
        priority: body.priority ?? 2,
        notes: body.notes ?? null,
        alert_enabled: body.alert_enabled ?? false,
        metadata: body.metadata ?? {}
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data, action: 'created' });
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es obligatorio' });

    const body = req.body;
    const allowed = [
      'name', 'set_name', 'number', 'image_url', 'rarity', 'variant', 'language',
      'max_price', 'condition', 'priority', 'notes', 'alert_enabled', 'metadata'
    ];

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await supabase
      .from('user_wishlist')
      .update(updates)
      .eq('id', id)
      .eq('telegram_user_id', telegram_user_id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Item no encontrado' });
    return res.status(200).json({ item: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es obligatorio' });

    const { error } = await supabase
      .from('user_wishlist')
      .delete()
      .eq('id', id)
      .eq('telegram_user_id', telegram_user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}