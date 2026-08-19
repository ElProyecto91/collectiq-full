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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `This is a Pokemon trading card. The card name is always printed in large bold text at the TOP of the card, above the card illustration. It is the Pokemon's name (like Pikachu, Charizard, Octillery, etc). Return ONLY the Pokemon name, nothing else. Do not return attack names, ability names, or any other text.`
              },
              { inline_data: { mime_type: 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 32 },
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

    const text: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.status(200).json({ text });

  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
}