// ====================================================================
// WHATSPLAN — /api/supabase-cluster-delete.js
// POST /api/supabase-cluster-delete   body: { id }
// Borra un cluster personalizado — los lugares vuelven a agruparse solo
// con el clustering automático por cercanía.
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'id es requerido' });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('supabase-cluster-delete error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
