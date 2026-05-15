// /api/supabase-diagnose.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  // Test PATCH directo
  try {
    const testId = 'ChIJMa_gTQ17ZYYR6-SjjGZ4ePw';
    const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${testId}`;
    
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ description: 'diagnose_' + Date.now() }),
    });

    const text = await r.text();
    return res.json({
      status: r.status,
      ok: r.ok,
      response: text.slice(0, 500),
      key_type: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
      url_set: !!SUPABASE_URL,
    });
  } catch(e) {
    return res.json({ error: e.message });
  }
}
