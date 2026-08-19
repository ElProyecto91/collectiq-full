export const config = { 
  runtime: 'nodejs',
  maxDuration: 15,
};

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
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY - key: ' + Object.keys(process.env).join(',') }), { status: 500, headers });
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
      return new Response(JSON.stringify({ error: 'Parse error: ' + rawText.slice(0, 200) }), { status: 500, headers });
    }

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: geminiData?.error?.message ?? 'Gemini error ' + geminiRes.status }), { status: 500, headers });
    }

    const text: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500, headers });
  }
}export const config = { 
  runtime: 'nodejs',
  maxDuration: 15,
};

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
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY - key: ' + Object.keys(process.env).join(',') }), { status: 500, headers });
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
      return new Response(JSON.stringify({ error: 'Parse error: ' + rawText.slice(0, 200) }), { status: 500, headers });
    }

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: geminiData?.error?.message ?? 'Gemini error ' + geminiRes.status }), { status: 500, headers });
    }

    const text: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return new Response(JSON.stringify({ text }), { status: 200, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), { status: 500, headers });
  }
}