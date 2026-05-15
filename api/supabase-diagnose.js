// ====================================================================
// /api/supabase-diagnose.js — Diagnóstico temporal
// GET /api/supabase-diagnose?place_id=ChIJMa_gTQ17ZYYR6-SjjGZ4ePw
// ====================================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  const { place_id } = req.query;

  // 1. Verificar credenciales
  const creds = {
    has_url:          !!SUPABASE_URL,
    has_service_key:  !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_anon_key:     !!process.env.SUPABASE_ANON_KEY,
    key_prefix:       SUPABASE_KEY ? SUPABASE_KEY.slice(0,20) + '...' : 'MISSING',
    url_prefix:       SUPABASE_URL ? SUPABASE_URL.slice(0,30) + '...' : 'MISSING',
  };

  if (!place_id) return res.json({ creds });

  // 2. Intentar un PATCH real
  try {
    const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({ description: 'test_' + Date.now() }),
    });
    const text = await response.text();
    return res.json({
      creds,
      patch_status: response.status,
      patch_response: text.slice(0, 500),
      success: response.ok,
    });
  } catch(e) {
    return res.json({ creds, error: e.message });
  }
}
