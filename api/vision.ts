export const config = { runtime: 'nodejs' };

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
- "set_code": The expansion set code or symbol if visible (e.g. "sv3pt5", "swsh12"). Look at the bottom of the card.
- "language": The language of the card. One of: "en", "ja", "ko", "zh", "fr", "de", "es", "it", "pt", "other".
- "variant": The physical variant of the card. Analyze the card's finish carefully. One of: "normal", "holo", "reverse_holo", "full_art", "secret_rare", "promo", "first_edition". Look for holographic patterns, foil effects, and special treatments.
- "name_confidence": A number 0-100 indicating how confident you are in the name identification.
- "variant_confidence": A number 0-100 indicating how confident you are in the variant identification.
- "is_pokemon_card": true or false — whether this is actually a Pokémon TCG card.

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
      // Si no puede parsear el JSON, devuelve el texto como nombre
      res.status(200).json({ text: rawContent.trim() });
      return;
    }

    if (!parsed.is_pokemon_card) {
      res.status(200).json({ text: '', error: 'No es una carta Pokémon' });
      return;
    }

    res.status(200).json({
      text: parsed.name ?? '',
      number: parsed.number ?? null,
      set_code: parsed.set_code ?? null,
      language: parsed.language ?? 'en',
      variant: parsed.variant ?? 'normal',
      name_confidence: parsed.name_confidence ?? 0,
      variant_confidence: parsed.variant_confidence ?? 0,
    });

  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}