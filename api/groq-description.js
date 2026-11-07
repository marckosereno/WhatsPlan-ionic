// /api/groq-description.js
// · ?place_id=…                   → descripción de un lugar (como siempre)
// · ?mode=plan&activity_id=…      → resumen de un plan (con el token del usuario)
// (un solo archivo: Vercel Hobby permite 12 funciones y ya están las 12)
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

  return callGroq([
    { role: 'system', content: 'Eres un experto en turismo local de México. Respondes solo en español.' },
    { role: 'user',   content: parts },
  ], 0.8, 700);
}

// Llama a Groq probando modelos en orden; devuelve el texto limpio
async function callGroq(messages, temperature = 0.8, maxTokens = 700) {

  // Groq dio de baja llama-3.1-8b-instant (16 ago 2026 → error 404
  // "model_not_found"). Su reemplazo oficial es openai/gpt-oss-20b. Si algún
  // día también lo retiran, se prueba el siguiente de la lista, y se puede
  // fijar otro sin tocar código con la variable GROQ_MODEL en Vercel.
  const models = [process.env.GROQ_MODEL, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']
    .filter((m, i, a) => m && a.indexOf(m) === i);

  let lastErr = null;
  for (const model of models) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        // gpt-oss "piensa" antes de responder: esfuerzo bajo (es una
        // descripción corta) y margen de tokens para que el razonamiento
        // no se coma la respuesta. include_reasoning:false → solo el texto.
        reasoning_effort: 'low',
        include_reasoning: false,
        max_completion_tokens: maxTokens,
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      lastErr = new Error(`Groq ${r.status} (${model}): ${body}`);
      // Modelo inexistente/retirado → probar el siguiente; otro error → cortar
      if (r.status === 404 || /model_not_found|decommissioned/i.test(body)) {
        console.warn('[groq] modelo no disponible, se prueba el siguiente:', model);
        continue;
      }
      throw lastErr;
    }
    const data = await r.json();
    let text = data.choices?.[0]?.message?.content?.trim();
    if (!text) { lastErr = new Error(`Groq empty response (${model})`); continue; }
    text = text.replace(/^["“'«]+|["”'»]+$/g, '').trim(); // sin comillas alrededor
    return text;
  }
  throw lastErr || new Error('Groq: ningún modelo disponible');
}

// ── Resumen de un plan (?mode=plan&activity_id=…) ─────────────────────
// Habla de los lugares del plan (descripción o reseñas de cada uno), de
// lo que se puede hacer ahí (discreto) y de qué tal pinta el plan. Se
// guarda en activities.ai_summary con una firma (lugares + hora); si el
// plan cambia, se vuelve a generar. Solo para quien puede ver el plan.
// Para cobrarlo después: PLAN_SUMMARY_PAID_ONLY=1 en Vercel (y la
// columna profiles.is_pro) → solo usuarios de pago.
const sbGet = async (path) => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
};

async function whoIs(req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${tok}` } });
  return r.ok ? (await r.json())?.id || null : null;
}

async function canSee(a, uid) {
  if (!uid) return false;
  if (a.creator_id === uid || (a.participants || []).includes(uid) || (a.invited || []).includes(uid)) return true;
  if ((a.visibility || 'public') === 'public') return true;
  if (a.visibility !== 'followers') return false;
  const f = await sbGet(`follows?follower_id=eq.${uid}&following_id=eq.${a.creator_id}&select=follower_id&limit=1`);
  return f.length > 0;
}

function placeBrief(p, fallbackName) {
  if (!p) return `- ${fallbackName}`;
  const name = p.place_name || p.name || fallbackName;
  const desc = (Array.isArray(p.ai_descriptions) && p.ai_descriptions[0]) || p.editorial_summary || '';
  const revs = (Array.isArray(p.reviews) ? p.reviews : []).slice(0, 4)
    .map(r => (r.text || r.comment || '').slice(0, 140)).filter(t => t.length > 15);
  return [`- ${name}${p.category ? ` (${p.category}${p.subcategory_tags ? ', ' + p.subcategory_tags : ''})` : ''}${p.rating ? `, ${p.rating}/5` : ''}`,
    desc ? `  Descripción: ${String(desc).slice(0, 280)}` : '',
    revs.length ? `  Reseñas: ${revs.map(t => `"${t}"`).join(' · ')}` : ''].filter(Boolean).join('\n');
}

async function planSummary(req, res) {
  const { activity_id } = req.query;
  if (!activity_id) return res.status(400).json({ error: 'activity_id required' });
  const uid = await whoIs(req);
  const [a] = await sbGet(`activities?id=eq.${encodeURIComponent(activity_id)}&select=*&limit=1`);
  if (!a || !(await canSee(a, uid))) return res.status(404).json({ error: 'Plan no encontrado' });
  if (process.env.PLAN_SUMMARY_PAID_ONLY === '1') {
    const [me] = await sbGet(`profiles?id=eq.${uid}&select=is_pro&limit=1`).catch(() => []);
    if (!me?.is_pro) return res.status(402).json({ error: 'El resumen del plan es parte de la versión Pro', pro: true });
  }
  const stops = Array.isArray(a.stops) ? a.stops : [];
  const sig = [a.place_id, ...stops.map(x => x.place_id), a.scheduled_at, a.ends_at, a.title].join('|');
  if (a.ai_summary && a.ai_summary_sig === sig) return res.status(200).json({ summary: a.ai_summary, cached: true });

  const ids = [a.place_id, ...stops.map(x => x.place_id)].filter(id => id && !String(id).startsWith('custom:'));
  const places = ids.length ? await sbGet(`places?place_id=in.(${ids.map(encodeURIComponent).join(',')})&select=*`) : [];
  const byId = (id) => places.find(p => String(p.place_id) === String(id));
  const t0 = new Date(a.scheduled_at);
  const hh = (d) => d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' });
  const route = [`1. ${a.place_name} a las ${hh(t0)}`, ...stops.map((x, i) => `${i + 2}. ${x.name} a las ${hh(new Date(t0.getTime() + (x.after || 0) * 60000))}${x.note ? ` (${x.note})` : ''}`)];
  const prompt = [
    `Escribe un resumen breve (70 a 100 palabras) en español del plan "${a.title}".`,
    `Ruta del plan:\n${route.join('\n')}`,
    a.ends_at ? `Termina a las ${hh(new Date(a.ends_at))}` : '',
    a.note ? `Nota de quien organiza: ${a.note}` : '',
    `Lugares:\n${[byId(a.place_id) ? placeBrief(byId(a.place_id), a.place_name) : `- ${a.place_name}`, ...stops.map(x => placeBrief(byId(x.place_id), x.name))].join('\n')}`,
    'Habla de los lugares (qué tienen de especial según su descripción o reseñas), menciona de forma discreta lo que se puede hacer ahí y termina con una frase de qué tal pinta el plan.',
    'Tono cálido y natural, como un amigo que conoce la zona. Sin emojis, sin listas, sin comillas, sin inventar datos (precios, horarios). Responde solo con el resumen.',
  ].filter(Boolean).join('\n\n');
  const summary = await callGroq([
    { role: 'system', content: 'Eres un experto en planes y lugares de México. Respondes solo en español.' },
    { role: 'user', content: prompt },
  ], 0.7, 900);
  await fetch(`${SUPABASE_URL}/rest/v1/activities?id=eq.${encodeURIComponent(a.id)}`, {
    method: 'PATCH', headers: { ...SB, Prefer: 'return=minimal' },
    body: JSON.stringify({ ai_summary: summary, ai_summary_sig: sig, ai_summary_at: new Date().toISOString() }),
  }).catch(e => console.warn('[groq] no se guardó el resumen:', e.message));
  return res.status(200).json({ summary, cached: false });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY not set' });
  if (req.query.mode === 'plan') {
    try { return await planSummary(req, res); }
    catch (err) { console.error('[groq-plan]', err.message); return res.status(500).json({ error: err.message }); }
  }
  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'place_id required' });

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
