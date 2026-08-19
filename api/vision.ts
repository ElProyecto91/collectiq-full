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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Read the Pokemon card name in this image. Return only the card name, nothing else.' },
              { inline_data: { mime_type: 'image/jpeg', data: image } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 64 },
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