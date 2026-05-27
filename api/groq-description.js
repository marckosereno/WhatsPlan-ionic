// /api/groq-description.js
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY     = process.env.GROQ_API_KEY;
const SB = {
  'apikey': SUPABASE_SERVICE,
  'Authorization': `Bearer ${SUPABASE_SERVICE}`,
  'Content-Type': 'application/json',
};

async function getPlace(place_id) {
  // Use select=* to avoid errors from missing columns
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}&select=*&limit=1`;
  const r   = await fetch(url, { headers: SB });
  const txt = await r.text();
  console.log('[groq] supabase raw:', r.status, txt.slice(0, 300));
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${txt}`);
  const data = JSON.parse(txt);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function saveDescriptions(place_id, descriptions) {
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...SB, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ai_descriptions: descriptions }),
  });
  if (!r.ok) console.warn('[groq] save failed:', r.status, await r.text());
}

async function generateGroq(place, index) {
  const name    = place.place_name || place.name || 'este lugar';
  const reviews = (Array.isArray(place.reviews) ? place.reviews : [])
    .slice(0, 8)
    .map(r => `"${(r.text || r.comment || '').slice(0, 200)}" (${r.rating}★)`)
    .filter(r => r.length > 15)
    .join('\n');

  const tones = [
    'cálido y acogedor, como si lo recomendaras a un amigo',
    'informativo y concreto, destacando lo más útil para el visitante',
    'evocador y sensorial, que haga sentir el ambiente del lugar',
  ];

  const parts = [
    `Escribe UNA descripción breve (máximo 70 palabras) en español de "${name}".`,
    place.category   ? `Categoría: ${place.category}.`                : '',
    place.subcategory_tags ? `Especialidad: ${place.subcategory_tags}.` : '',
    place.rating     ? `Rating: ${place.rating}/5.`                   : '',
    reviews          ? `Reseñas de clientes:\n${reviews}`             : '',
    place.editorial_summary ? `Resumen: ${place.editorial_summary}`   : '',
    `Tono: ${tones[index % 3]}.`,
    `Responde ÚNICAMENTE con la descripción. Sin comillas ni prefijos.`,
  ].filter(Boolean).join('\n');

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        { role: 'system', content: 'Eres un experto en turismo local de México. Respondes solo en español.' },
        { role: 'user',   content: parts },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Groq empty response');
  return text;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'place_id required' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

  try {
    const place = await getPlace(place_id);
    if (!place) return res.status(404).json({ error: `Place not found: ${place_id}` });

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];

    if (existing.length >= 3) {
      return res.status(200).json({
        description: existing[Math.floor(Math.random() * existing.length)],
        cached: true, total: existing.length,
      });
    }

    const desc    = await generateGroq(place, existing.length);
    const updated = [...existing, desc];
    await saveDescriptions(place_id, updated);

    return res.status(200).json({ description: desc, cached: false, total: updated.length });

  } catch (err) {
    console.error('[groq-description]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
