export const config = { runtime: 'nodejs' };

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';

async function validateWithPokemonTCG(
  name: string,
  number: string | null,
  set_code: string | null
): Promise<{ id: string; name: string; number: string; set: { name: string } } | null> {
  const apiKey = process.env.VITE_POKEMONTCG_API_KEY ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Api-Key'] = apiKey;

  // Intento 1: búsqueda exacta por número + set_code (más precisa)
  if (number && set_code) {
    try {
      const cleanNumber = number.split('/')[0]; // "044/198" → "044"
      const q = `number:"${cleanNumber}" set.id:"${set_code}"`;
      const res = await fetch(`${POKEMON_API_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=5`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.length > 0) return json.data[0];
      }
    } catch { /* continuar con fallbacks */ }
  }

  // Intento 2: número + nombre (sin set_code porque Gemini lo puede inventar)
  if (number && name) {
    try {
      const cleanNumber = number.split('/')[0];
      const q = `name:"${name}" number:"${cleanNumber}"`;
      const res = await fetch(`${POKEMON_API_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=5&orderBy=-set.releaseDate`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.length > 0) return json.data[0];
      }
    } catch { /* continuar */ }
  }

  // Intento 3: solo nombre (fallback amplio, devuelve la carta más reciente)
  if (name) {
    try {
      const q = `name:"${name}"`;
      const res = await fetch(`${POKEMON_API_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=10&orderBy=-set.releaseDate`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.length > 0) return json.data[0];
      }
    } catch { /* nada */ }
  }

  return null;
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) { res.status(500).json({ error: 'Missing GEMINI_API_KEY' }); return; }

    const { image } = req.body;
    if (!image) { res.status(400).json({ error: 'Missing image field' }); return; }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are an expert Pokémon TCG card identifier. Analyze this card image carefully and return a JSON object with the following fields:

- "name": The Pokémon or card name in ENGLISH, regardless of the card's language. If the card is Japanese, Korean, Chinese, French, German, Spanish, Italian or any other language, translate/transliterate the name to English. For example, if you see "ピカチュウ" return "Pikachu".
- "number": The collector number printed on the card (e.g. "044/198", "025", "TG17"). Look at the bottom of the card.
- "set_code": The expansion set code or symbol if visible (e.g. "sv3pt5", "swsh12"). Look at the bottom of the card. If you are not 100% certain, return null.
- "language": The language of the card. One of: "en", "ja", "ko", "zh", "fr", "de", "es", "it", "pt", "other".
- "variant": The physical variant of the card. Analyze the card's finish carefully. One of: "normal", "holo", "reverse_holo", "full_art", "secret_rare", "promo", "first_edition". Look for holographic patterns, foil effects, and special treatments.
- "name_confidence": A number 0-100 indicating how confident you are in the name identification.
- "variant_confidence": A number 0-100 indicating how confident you are in the variant identification.
- "is_pokemon_card": true or false — whether this is actually a Pokémon TCG card.

IMPORTANT: For set_code, only return a value if you can read it clearly from the card. Do NOT guess or invent set codes. Return null if uncertain.

Return ONLY the JSON object, no markdown, no explanation, nothing else.

Example response:
{"name":"Pikachu","number":"044/198","set_code":"sv3pt5","language":"en","variant":"reverse_holo","name_confidence":98,"variant_confidence":85,"is_pokemon_card":true}`
              },
              { inline_data: { mime_type: 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 256 },
        }),
      }
    );

    const rawText = await geminiRes.text();
    let geminiData;
    try { geminiData = JSON.parse(rawText); } catch {
      res.status(500).json({ error: 'Parse error: ' + rawText.slice(0, 200) }); return;
    }

    if (!geminiRes.ok) {
      res.status(500).json({ error: geminiData?.error?.message ?? 'Gemini error ' + geminiRes.status }); return;
    }

    const rawContent: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: any = {};
    try {
      const clean = rawContent.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      res.status(200).json({ text: rawContent.trim() });
      return;
    }

    if (!parsed.is_pokemon_card) {
      res.status(200).json({ text: '', error: 'No es una carta Pokémon' });
      return;
    }

    const geminiName: string = (parsed.name ?? '').trim();
    const geminiNumber: string | null = parsed.number ?? null;
    const geminiSetCode: string | null = parsed.set_code ?? null;

    // Validar contra pokemontcg.io — esto evita que se guarden sets inventados
    const validated = await validateWithPokemonTCG(geminiName, geminiNumber, geminiSetCode);

    res.status(200).json({
      // Nombre validado (o el de Gemini si no hay match, para que el usuario pueda buscar manualmente)
      text: validated?.name ?? geminiName,
      number: validated?.number ?? geminiNumber,
      set_code: validated ? null : geminiSetCode, // solo pasamos set_code si fue validado
      validated_card_id: validated?.id ?? null,   // ID oficial de pokemontcg.io si encontramos match exacto
      validated_set_name: validated?.set?.name ?? null,
      language: parsed.language ?? 'en',
      variant: parsed.variant ?? 'normal',
      name_confidence: parsed.name_confidence ?? 0,
      variant_confidence: parsed.variant_confidence ?? 0,
      was_validated: validated !== null,
    });

  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}
