// ====================================================================
// WHATSPLAN — /api/supabase-place-delete.js
// DELETE /api/supabase-place-delete?place_id=xxx
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ error: 'place_id requerido' });

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`,
      {
        method: 'DELETE',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=representation',
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }

    return res.status(200).json({ success: true, deleted: place_id });

  } catch (err) {
    console.error('supabase-place-delete error:', err);
    return res.status(500).json({ error: err.message });
  }
}
