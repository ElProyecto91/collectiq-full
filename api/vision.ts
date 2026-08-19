export const config = { runtime: 'nodejs' };

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), { status: 500, headers });
    }

    const body = await req.json();
    const image = body?.image;

    if (!image) {
      return new Response(JSON.stringify({ error: 'Missing image field' }), { status: 400, headers });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: 'Extract all text visible in this Pokemon card image. Return only the raw text, one piece per line, no explanations.',
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: image,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 256,
          },
        }),
      }
    );

    const rawText = await geminiRes.text();

    let geminiData;
    try {
      geminiData = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({ error: 'Gemini response parse error: ' + rawText.slice(0, 100) }), { status: 500, headers });
    }

    if (!geminiRes.ok) {
      const msg = geminiData?.error?.message ?? `Gemini API error ${geminiRes.status}`;
      return new Response(JSON.stringify({ error: msg }), { status: geminiRes.status, headers });
    }

    const text: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500, headers });
  }
}