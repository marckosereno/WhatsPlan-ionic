// ====================================================================
// WHATSPLAN — /api/groq-description.js
// POST { place_id } → genera descripción AI con Groq y cachea en Supabase
// GET  ?place_id=   → devuelve descripción existente
// ====================================================================

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY     = process.env.GROQ_API_KEY;

const SB = {
  'apikey':        SUPABASE_SERVICE,
  'Authorization': `Bearer ${SUPABASE_SERVICE}`,
  'Content-Type':  'application/json',
};

async function getPlace(place_id) {
  const url = `${SUPABASE_URL}/rest/v1/places`
    + `?place_id=eq.${encodeURIComponent(place_id)}`
    + `&select=place_id,name,category,subcategory_tags,rating,reviews,ai_descriptions,editorialSummary`
    + `&limit=1`;
  const r    = await fetch(url, { headers: SB });
  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

async function saveDescriptions(place_id, descriptions) {
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
  const r = await fetch(url, {
    method:  'PATCH',
    headers: { ...SB, 'Prefer': 'return=minimal' },
    body:    JSON.stringify({ ai_descriptions: descriptions }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Supabase PATCH failed: ${r.status} ${txt}`);
  }
}

async function generateGroq(place, index) {
  const reviews = (place.reviews || [])
    .slice(0, 10)
    .map(r => `"${(r.text || r.comment || '').slice(0, 200)}" (${r.rating}★)`)
    .filter(r => r.length > 15)
    .join('\n');

  const tones = [
    'cálido y acogedor, como si lo recomendaras a un amigo',
    'informativo y concreto, destacando lo más útil para el visitante',
    'evocador y sensorial, que haga sentir el ambiente del lugar',
  ];

  const prompt = [
    `Escribe UNA descripción breve (máximo 70 palabras) en español de "${place.name}".`,
    `Categoría: ${place.category || 'lugar'}.`,
    place.subcategory_tags ? `Especialidad: ${place.subcategory_tags}.` : '',
    place.rating ? `Rating: ${place.rating}/5.` : '',
    reviews ? `Basándote en estas reseñas de clientes:\n${reviews}` : '',
    place.editorialSummary ? `Resumen: ${place.editorialSummary}` : '',
    `\nTono: ${tones[index % 3]}.`,
    `Responde ÚNICAMENTE con la descripción. Sin comillas, sin título, sin intro.`,
  ].filter(Boolean).join('\n');

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:       'llama3-8b-8192',
      max_tokens:  150,
      temperature: 0.8,
      messages: [
        { role: 'system', content: 'Eres un experto en turismo local de México. Respondes solo en español con descripciones concisas y atractivas.' },
        { role: 'user',   content: prompt },
      ],
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Groq error ${r.status}: ${txt}`);
  }
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq returned empty content');
  return text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Parse place_id from query or body
  let place_id = req.query?.place_id;
  if (!place_id && req.method === 'POST') {
    // Vercel parses JSON body automatically if Content-Type is application/json
    place_id = req.body?.place_id;
  }

  if (!place_id) {
    return res.status(400).json({ error: 'place_id is required' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
  }

  try {
    const place = await getPlace(place_id);
    if (!place) return res.status(404).json({ error: `Place not found: ${place_id}` });

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];

    // ── GET: return existing ──
    if (req.method === 'GET') {
      if (existing.length > 0) {
        const desc = existing[Math.floor(Math.random() * existing.length)];
        return res.status(200).json({ description: desc, cached: true, total: existing.length });
      }
      return res.status(200).json({ description: null, cached: false, total: 0 });
    }

    // ── POST: generate if < 3 ──
    if (req.method === 'POST') {
      // Already have 3 — return random
      if (existing.length >= 3) {
        const desc = existing[Math.floor(Math.random() * existing.length)];
        return res.status(200).json({ description: desc, cached: true, total: existing.length });
      }

      // Generate new
      const desc    = await generateGroq(place, existing.length);
      const updated = [...existing, desc];
      await saveDescriptions(place_id, updated);

      return res.status(200).json({
        description: desc,
        cached:      false,
        total:       updated.length,
        remaining:   3 - updated.length,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[groq-description]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
