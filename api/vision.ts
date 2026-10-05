export const config = { runtime: 'nodejs' };

import { DAILY_SCAN_LIMIT, bumpScans, cors, scanState, sessionUserId } from './_lib/auth';

/**
 * Reads a photographed Pokémon card: only what is PRINTED on it. Which catalog card it is gets decided in
 * the app (src/lib/card-match.ts), by comparing these facts with the catalog; asking the model to name the
 * card (or to invent a set id) is where wrong answers came from.
 *
 * Needs a session (Authorization: Bearer <token>), applies the daily scan quota and counts the scan.
 */
const PROMPT = `You are reading a photo of a trading card. Report ONLY what is printed on it; never guess.

- is_pokemon_card: true only if it is a Pokémon TCG card.
- name: the card name in ENGLISH (translate or transliterate if the card is Japanese, Korean, Chinese, French, German, Spanish, Italian...). Keep suffixes such as ex, V, VMAX, VSTAR, GX, EX, BREAK, Radiant. Example: ピカチュウ -> Pikachu.
- number: the collector number exactly as printed in the bottom corner, e.g. "044/198", "TG17/TG30", "SWSH001", "025".
- printed_total: the number AFTER the slash (198 in "044/198"), or null if there is no slash.
- set_code: the short set abbreviation printed next to the number or in the corner (e.g. "PAL", "SVI", "MEW", "OBF"), or null. Do NOT invent it and do not return catalog ids like "sv3pt5".
- regulation_mark: the single letter in the small box (D, E, F, G, H, I...), or null.
- hp: the HP number for a Pokémon card, or null.
- types: the energy type(s) of a Pokémon card in English (Grass, Fire, Water, Lightning, Psychic, Fighting, Darkness, Metal, Dragon, Fairy, Colorless). Empty for Trainer and Energy cards.
- supertype: Pokémon, Trainer or Energy.
- artist: the illustrator name after "Illus.", or null.
- language: en, ja, ko, zh, fr, de, es, it, pt or other.
- variant: the finish you see: normal, holo (holographic art box or full holo), reverse_holo (the whole card except the art is foil), full_art, secret_rare, promo, first_edition (1st Edition stamp).
- rarity_symbol: the rarity mark next to the number: circle, diamond, star, two_black_stars, two_silver_stars, gold_star, two_gold_stars, three_gold_stars, none (the card has none), unreadable.
- name_confidence, number_confidence, variant_confidence: 0-100, how sure you are of each reading. Lower them when the text is blurry, cut off or covered by glare.`;

const STRING_OR_NULL = { type: 'STRING', nullable: true };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_pokemon_card: { type: 'BOOLEAN' },
    name: { type: 'STRING' },
    number: STRING_OR_NULL,
    printed_total: { type: 'INTEGER', nullable: true },
    set_code: STRING_OR_NULL,
    regulation_mark: STRING_OR_NULL,
    hp: { type: 'INTEGER', nullable: true },
    types: { type: 'ARRAY', items: { type: 'STRING' } },
    supertype: { type: 'STRING' },
    artist: STRING_OR_NULL,
    language: { type: 'STRING' },
    variant: { type: 'STRING', enum: ['normal', 'holo', 'reverse_holo', 'full_art', 'secret_rare', 'promo', 'first_edition'] },
    rarity_symbol: { type: 'STRING', enum: ['circle', 'diamond', 'star', 'two_black_stars', 'two_silver_stars', 'gold_star', 'two_gold_stars', 'three_gold_stars', 'none', 'unreadable'] },
    name_confidence: { type: 'INTEGER' },
    number_confidence: { type: 'INTEGER' },
    variant_confidence: { type: 'INTEGER' },
  },
  required: ['is_pokemon_card', 'name', 'number', 'language', 'variant', 'name_confidence'],
};

const MAX_IMAGE_B64 = 4_000_000; // ~3 MB of JPEG; the app sends ~0.5 MB

function clean(parsed: any) {
  const num = (v: any) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
  const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    is_pokemon_card: !!parsed.is_pokemon_card,
    name: str(parsed.name) ?? '',
    number: str(parsed.number),
    printed_total: num(parsed.printed_total),
    set_code: str(parsed.set_code),
    regulation_mark: str(parsed.regulation_mark),
    hp: num(parsed.hp),
    types: Array.isArray(parsed.types) ? parsed.types.map(String) : [],
    artist: str(parsed.artist),
    language: str(parsed.language)?.toLowerCase() ?? 'en',
    variant: str(parsed.variant) ?? 'normal',
    rarity_symbol: str(parsed.rarity_symbol),
    name_confidence: num(parsed.name_confidence) ?? 0,
    number_confidence: num(parsed.number_confidence) ?? 0,
    variant_confidence: num(parsed.variant_confidence) ?? 0,
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  cors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // 1) who is it, and does the quota allow another scan (before spending any Gemini call)
  const uid = await sessionUserId(req);
  if (!uid) { res.status(401).json({ error: 'unauthorized' }); return; }
  const before = await scanState(uid);
  if (!before.premium && before.used >= before.limit) {
    res.status(429).json({ error: 'daily_limit', limit: before.limit, used: before.used, dailyLimit: DAILY_SCAN_LIMIT });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) { res.status(500).json({ error: 'Missing GEMINI_API_KEY' }); return; }

    const image = req.body?.image;
    if (typeof image !== 'string' || !image) { res.status(400).json({ error: 'Missing image field' }); return; }
    if (image.length > MAX_IMAGE_B64) { res.status(413).json({ error: 'image_too_large' }); return; }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: image } }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: 'application/json', responseSchema: SCHEMA },
        }),
      }
    );

    const rawText = await geminiRes.text();
    let geminiData: any;
    try { geminiData = JSON.parse(rawText); } catch { res.status(502).json({ error: 'gemini_unreadable' }); return; }
    if (!geminiRes.ok) { res.status(502).json({ error: geminiData?.error?.message ?? 'Gemini error ' + geminiRes.status }); return; }

    const rawContent: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parsed: any;
    try { parsed = JSON.parse(rawContent.replace(/```json|```/g, '').trim()); }
    catch { res.status(502).json({ error: 'gemini_unreadable' }); return; }

    const read = clean(parsed);
    // 2) count it only when the model answered (errors above cost the user nothing)
    const after = before.premium ? before : await bumpScans(uid, 1);
    res.status(200).json({
      read,
      quota: { used: after.used, accumulated: after.accumulated, limit: DAILY_SCAN_LIMIT + after.accumulated, premium: after.premium },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}
