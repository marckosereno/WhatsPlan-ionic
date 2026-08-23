// ====================================================================
// WHATSPLAN — /api/supabase-clusters.js
// GET /api/supabase-clusters
// Lista los clusters de pines personalizados por el SuperUser (ver
// add_pin_clusters_table.sql). Sin caché — son pocas filas y cambian
// poco, no vale la pena la complejidad de invalidación.
// ====================================================================

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pin_clusters?select=*`, {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
      },
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }
    const rows = await response.json();

    const clusters = rows.map(r => ({
      id:               r.id,
      label:            r.label || '',
      stickerEmoji:     r.sticker_emoji || '',
      stickerImageUrl:  r.sticker_image_url || '',
      stackStyle:       r.stack_style || 'fan-drift',
      badgeColor:       r.badge_color || '#1a5cf5',
      borderColor:      r.border_color || '#ffffff',
      borderWidth:      r.border_width ?? 2,
      pinSize:          r.pin_size || 'med',
      placeIds:         r.place_ids || [],
    }));

    return res.status(200).json({ success: true, clusters });
  } catch (err) {
    console.error('supabase-clusters error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
