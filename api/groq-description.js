// ====================================================================
// WHATSPLAN — /api/groq-description.js
// Genera descripción AI de un lugar usando Groq + reviews de Supabase
// GET  /api/groq-description?place_id=xxx   → devuelve descripción
// POST /api/groq-description                 → genera y guarda si no existe
// ====================================================================

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GROQ_API_KEY     = process.env.GROQ_API_KEY;

const SUPABASE_HEADERS = {
  'apikey':        SUPABASE_SERVICE,
  'Authorization': `Bearer ${SUPABASE_SERVICE}`,
  'Content-Type':  'application/json',
};

// ── Helpers ──────────────────────────────────────────────────────────

async function getPlace(place_id) {
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}&select=place_id,name,category,subcategory_tags,rating,reviews,ai_descriptions,description,editorialSummary&limit=1`;
  const r = await fetch(url, { headers: SUPABASE_HEADERS });
  const data = await r.json();
  return data?.[0] || null;
}

async function saveDescription(place_id, descriptions) {
  const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ai_descriptions: descriptions }),
  });
}

async function generateWithGroq(place, existingCount) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

  // Build context from reviews
  const reviews = (place.reviews || []).slice(0, 8).map(r =>
    `- "${r.text || r.comment || ''}" (${r.rating}★)`
  ).filter(r => r.length > 10).join('\n');

  const tones = ['entusiasta y cálido', 'informativo y directo', 'poético y evocador'];
  const tone  = tones[existingCount % 3];

  const prompt = `Eres un experto local en ${place.category || 'lugares'}.
Escribe una descripción breve (máx 2 oraciones, 60-80 palabras) de "${place.name}" en español.
Tono: ${tone}.
Categoría: ${place.category || ''} ${place.subcategory_tags ? '/ ' + place.subcategory_tags : ''}.
Rating: ${place.rating || 'sin rating'}.
${reviews ? `Reseñas de clientes:\n${reviews}` : ''}
${place.editorialSummary ? `Resumen editorial: ${place.editorialSummary}` : ''}

Responde SOLO con la descripción, sin comillas, sin prefijos.`;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'llama3-8b-8192',
      max_tokens:  120,
      temperature: 0.75,
      messages: [
        { role: 'system', content: 'Eres un experto local. Responde solo en español con descripciones concisas y atractivas.' },
        { role: 'user',   content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const place_id = req.query.place_id || req.body?.place_id;
  if (!place_id) return res.status(400).json({ error: 'place_id required' });

  try {
    const place = await getPlace(place_id);
    if (!place) return res.status(404).json({ error: 'Place not found' });

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];

    // ── GET: devolver descripción aleatoria de las existentes ──
    if (req.method === 'GET') {
      if (existing.length > 0) {
        const pick = existing[Math.floor(Math.random() * existing.length)];
        return res.status(200).json({ description: pick, cached: true, total: existing.length });
      }
      return res.status(200).json({ description: null, cached: false, total: 0 });
    }

    // ── POST: generar nueva si hay menos de 3 ──
    if (req.method === 'POST') {
      // Ya tenemos 3 — devolver una aleatoria
      if (existing.length >= 3) {
        const pick = existing[Math.floor(Math.random() * existing.length)];
        return res.status(200).json({ description: pick, cached: true, total: existing.length });
      }

      // Generar nueva
      const newDesc = await generateWithGroq(place, existing.length);
      if (!newDesc) return res.status(500).json({ error: 'Generation failed' });

      // Guardar
      const updated = [...existing, newDesc];
      await saveDescription(place_id, updated);

      return res.status(200).json({
        description: newDesc,
        cached: false,
        total: updated.length,
        remaining: Math.max(0, 3 - updated.length),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[groq-description]', err);
    return res.status(500).json({ error: err.message });
  }
}
