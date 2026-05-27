// ====================================================================
// WHATSPLAN — /api/groq-description.js
// GET /api/groq-description?place_id=xxx
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
  // First: try with ai_descriptions column
  let url  = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}&select=place_id,place_name,name,category,subcategory_tags,rating,reviews,ai_descriptions,editorial_summary&limit=1`;
  let r    = await fetch(url, { headers: SB });
  let data = await r.json();

  // If column doesn't exist Supabase returns error object
  if (!Array.isArray(data) || data.length === 0) {
    // Fallback without ai_descriptions
    url  = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}&select=place_id,place_name,name,category,subcategory_tags,rating,reviews,editorial_summary&limit=1`;
    r    = await fetch(url, { headers: SB });
    data = await r.json();
  }

  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0];
  // Normalize name field
  if (!row.name) row.name = row.place_name || '';
  if (!row.editorialSummary) row.editorialSummary = row.editorial_summary || '';
  return row;
}

async function saveDescriptions(place_id, descriptions) {
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
  await fetch(url, {
    method:  'PATCH',
    headers: { ...SB, 'Prefer': 'return=minimal' },
    body:    JSON.stringify({ ai_descriptions: descriptions }),
  });
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
    reviews ? `Basándote en estas reseñas:\n${reviews}` : '',
    place.editorialSummary ? `Resumen: ${place.editorialSummary}` : '',
    `Tono: ${tones[index % 3]}.`,
    `Responde ÚNICAMENTE con la descripción. Sin comillas ni prefijos.`,
  ].filter(Boolean).join('\n');

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'llama3-8b-8192',
      max_tokens:  150,
      temperature: 0.8,
      messages: [
        { role: 'system', content: 'Eres un experto en turismo local de México. Respondes solo en español.' },
        { role: 'user',   content: prompt },
      ],
    }),
  });

  if (!r.ok) throw new Error(`Groq ${r.status}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq empty response');
  return text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'place_id required' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  try {
    const place = await getPlace(place_id);
    console.log('[groq] getPlace result:', place ? 'FOUND: ' + place.name : 'NOT FOUND for: ' + place_id);
    if (!place) return res.status(404).json({ error: `Place not found: ${place_id}` });

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];

    // Already have 3 — return random
    if (existing.length >= 3) {
      return res.status(200).json({
        description: existing[Math.floor(Math.random() * existing.length)],
        cached: true, total: existing.length,
      });
    }

    // Generate new one
    const desc    = await generateGroq(place, existing.length);
    const updated = [...existing, desc];
    await saveDescriptions(place_id, updated);

    return res.status(200).json({
      description: desc,
      cached:      false,
      total:       updated.length,
      remaining:   3 - updated.length,
    });

  } catch (err) {
    console.error('[groq-description]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
