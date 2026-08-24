// api/collection.ts
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

  // Auth — mismo patrón que el resto de tu app
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

  let telegram_user_id: number;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    telegram_user_id = payload.telegram_user_id;
    if (!telegram_user_id) throw new Error('No user id');
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // GET — obtener colección (filtrable por tcg)
  if (req.method === 'GET') {
    const { tcg, limit = '200', offset = '0', search } = req.query;

    let query = supabase
      .from('user_collection')
      .select('*')
      .eq('telegram_user_id', telegram_user_id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (tcg) query = query.eq('tcg', tcg);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data, count: data?.length ?? 0 });
  }

  // POST — añadir item a la colección
  if (req.method === 'POST') {
    const body = req.body;
    if (!body.tcg || !body.name) {
      return res.status(400).json({ error: 'tcg y name son obligatorios' });
    }

    // Comprobar duplicado
    const { data: existing } = await supabase
      .from('user_collection')
      .select('id, quantity')
      .eq('telegram_user_id', telegram_user_id)
      .eq('tcg', body.tcg)
      .eq('external_card_id', body.external_card_id ?? '')
      .maybeSingle();

    if (existing) {
      // Si ya existe, suma cantidad
      const { data, error } = await supabase
        .from('user_collection')
        .update({
          quantity: existing.quantity + (body.quantity ?? 1),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ item: data, action: 'quantity_updated' });
    }

    // Item nuevo
    const { data, error } = await supabase
      .from('user_collection')
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
        quantity: body.quantity ?? 1,
        condition: body.condition ?? 'NM',
        purchase_price: body.purchase_price ?? null,
        purchase_date: body.purchase_date ?? null,
        purchase_source: body.purchase_source ?? null,
        market_value: body.market_value ?? null,
        currency: body.currency ?? 'EUR',
        notes: body.notes ?? null,
        location: body.location ?? null,
        folder: body.folder ?? null,
        is_favorite: body.is_favorite ?? false,
        is_for_sale: body.is_for_sale ?? false,
        is_for_trade: body.is_for_trade ?? false,
        in_sleeve: body.in_sleeve ?? false,
        sleeve_type: body.sleeve_type ?? null,
        in_binder: body.in_binder ?? false,
        grading_company: body.grading_company ?? null,
        grading_score: body.grading_score ?? null,
        grading_certificate: body.grading_certificate ?? null,
        grade_centering: body.grade_centering ?? null,
        grade_corners: body.grade_corners ?? null,
        grade_edges: body.grade_edges ?? null,
        grade_surface: body.grade_surface ?? null,
        box_condition: body.box_condition ?? null,
        custom_photo: body.custom_photo ?? null,
        metadata: body.metadata ?? {}
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ item: data, action: 'created' });
  }

  // PUT — editar item
  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es obligatorio' });

    const body = req.body;
    const allowed = [
      'name', 'set_name', 'number', 'image_url', 'rarity', 'variant', 'language',
      'quantity', 'condition', 'purchase_price', 'purchase_date', 'purchase_source',
      'market_value', 'currency', 'notes', 'location', 'folder',
      'is_favorite', 'is_for_sale', 'is_for_trade',
      'in_sleeve', 'sleeve_type', 'in_binder',
      'grading_company', 'grading_score', 'grading_certificate',
      'grade_centering', 'grade_corners', 'grade_edges', 'grade_surface',
      'box_condition', 'custom_photo', 'metadata'
    ];

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const { data, error } = await supabase
      .from('user_collection')
      .update(updates)
      .eq('id', id)
      .eq('telegram_user_id', telegram_user_id) // seguridad: solo puede editar lo suyo
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Item no encontrado' });
    return res.status(200).json({ item: data });
  }

  // DELETE — eliminar item
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id es obligatorio' });

    const { error } = await supabase
      .from('user_collection')
      .delete()
      .eq('id', id)
      .eq('telegram_user_id', telegram_user_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}