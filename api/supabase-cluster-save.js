// ====================================================================
// WHATSPLAN — /api/supabase-cluster-save.js
// POST /api/supabase-cluster-save
// Crea (sin `id`) o actualiza (con `id`) un cluster de pines personalizado.
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
    const {
      id, label, sticker_emoji, sticker_image_url,
      stack_style, badge_color, border_color, border_width,
      pin_size, place_ids,
    } = req.body || {};

    if (!Array.isArray(place_ids) || place_ids.length < 1) {
      return res.status(400).json({ success: false, message: 'place_ids es requerido (mínimo 1 lugar)' });
    }

    const record = {
      label:             label || null,
      sticker_emoji:     sticker_emoji || null,
      sticker_image_url: sticker_image_url || null,
      stack_style:       stack_style || 'fan-drift',
      badge_color:       badge_color || '#1a5cf5',
      border_color:      border_color || '#ffffff',
      border_width:      border_width != null ? parseInt(border_width, 10) : 2,
      pin_size:          pin_size || 'med',
      place_ids,
      updated_at:        new Date().toISOString(),
    };

    const isUpdate = !!id;
    const url = isUpdate
      ? `${SUPABASE_URL}/rest/v1/pin_clusters?id=eq.${encodeURIComponent(id)}`
      : `${SUPABASE_URL}/rest/v1/pin_clusters`;

    const response = await fetch(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json({ success: true, cluster: data[0] || data });
  } catch (err) {
    console.error('supabase-cluster-save error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
