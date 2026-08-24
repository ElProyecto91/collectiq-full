// api/scanner.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_PROMPT = `Analiza esta imagen de un coleccionable y devuelve SOLO un objeto JSON con estos campos:
{
  "tcg": "pokemon|funko|magic|yugioh|onepiece|lorcana|digimon|unknown",
  "name": "nombre del item",
  "set_name": "nombre del set o serie (si aplica)",
  "number": "número de carta o figura (si aplica)",
  "rarity": "rareza (si aplica)",
  "variant": "variante como Holo, Reverse Holo, 1st Edition (si aplica)",
  "language": "en|es|ja|fr|de|it|pt",
  "external_card_id": "ID de la carta en su API oficial si lo conoces (ej: sv3pt5-200)",
  "confidence": 0.0-1.0
}
Sin texto adicional, solo el JSON.`;

async function validatePokemon(name: string, number: string, setName: string): Promise<any> {
  const attempts = [
    `number:${number} set.name:"${setName}"`,
    `number:${number} name:"${name}"`,
    `name:"${name}"`
  ];
  for (const q of attempts) {
    try {
      const r = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`,
        { headers: { 'X-Api-Key': process.env.VITE_POKEMONTCG_API_KEY! } }
      );
      const d = await r.json();
      if (d?.data?.[0]) return d.data[0];
    } catch {}
  }
  return null;
}

async function validateFunko(name: string): Promise<any> {
  const { data } = await supabase
    .from('catalog_items')
    .select('id, name, image_url, price_eur, series, franchise')
    .eq('tcg', 'funko')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return data;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  // Verificar límite de escaneos (reutiliza tabla user_scans existente)
  const today = new Date().toISOString().split('T')[0];
  const { data: scanData } = await supabase
    .from('user_scans')
    .select('scans_today, last_scan_date, bonus_scans')
    .eq('telegram_user_id', telegram_user_id)
    .maybeSingle();

  const { data: userGo } = await supabase
    .from('users')
    .select('is_premium, premium_until')
    .eq('telegram_user_id', telegram_user_id)
    .maybeSingle();

  const isPremium = userGo?.is_premium &&
    userGo?.premium_until &&
    new Date(userGo.premium_until) > new Date();

  if (!isPremium) {
    const scansToday = scanData?.last_scan_date === today ? (scanData?.scans_today ?? 0) : 0;
    const bonusScans = scanData?.bonus_scans ?? 0;
    const limit = 5 + bonusScans;
    if (scansToday >= limit) {
      return res.status(429).json({ error: 'Límite de escaneos alcanzado', limit, scans_today: scansToday });
    }
  }

  const { image_base64, tcg_hint } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'image_base64 es obligatorio' });

  // Llamada a Gemini
  let geminiResult: any = null;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: tcg_hint ? `El usuario indica que es un item de tipo: ${tcg_hint}. ${GEMINI_PROMPT}` : GEMINI_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: image_base64 } }
            ]
          }]
        })
      }
    );
    const gd = await geminiRes.json();
    const text = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    geminiResult = JSON.parse(clean);
  } catch {
    return res.status(500).json({ error: 'Error procesando imagen con IA' });
  }

  // Validar contra API oficial según TCG detectado
  let validated: any = null;
  const tcg = tcg_hint ?? geminiResult.tcg;

  if (tcg === 'pokemon') {
    const card = await validatePokemon(geminiResult.name, geminiResult.number, geminiResult.set_name);
    if (card) {
      validated = {
        tcg: 'pokemon',
        external_card_id: card.id,
        name: card.name,
        set_name: card.set?.name,
        number: card.number,
        image_url: card.images?.large ?? card.images?.small,
        rarity: card.rarity,
        market_value: card.tcgplayer?.prices?.holofoil?.market
          ?? card.tcgplayer?.prices?.normal?.market
          ?? null,
        variant: geminiResult.variant,
        language: geminiResult.language,
        confidence: geminiResult.confidence
      };
    }
  } else if (tcg === 'funko') {
    const funko = await validateFunko(geminiResult.name);
    if (funko) {
      validated = {
        tcg: 'funko',
        catalog_item_id: funko.id,
        external_card_id: null,
        name: funko.name,
        image_url: funko.image_url,
        market_value: funko.price_eur,
        confidence: geminiResult.confidence
      };
    }
  }

  // Si no se validó, devolver lo que detectó Gemini sin validar
  const result = validated ?? {
    tcg,
    external_card_id: geminiResult.external_card_id ?? null,
    name: geminiResult.name,
    set_name: geminiResult.set_name ?? null,
    number: geminiResult.number ?? null,
    rarity: geminiResult.rarity ?? null,
    variant: geminiResult.variant ?? null,
    language: geminiResult.language ?? 'en',
    market_value: null,
    confidence: (geminiResult.confidence ?? 0.5) * 0.7 // penalizar si no validó
  };

  // Actualizar contador de escaneos
  const newScansToday = scanData?.last_scan_date === today ? (scanData?.scans_today ?? 0) + 1 : 1;
  await supabase.from('user_scans').upsert({
    telegram_user_id,
    scans_today: newScansToday,
    last_scan_date: today,
    updated_at: new Date().toISOString()
  }, { onConflict: 'telegram_user_id' });

  return res.status(200).json({
    result,
    validated: !!validated,
    scans_remaining: isPremium ? 999 : Math.max(0, 5 + (scanData?.bonus_scans ?? 0) - newScansToday)
  });
}