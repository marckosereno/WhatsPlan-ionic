// ====================================================================
// WHATSPLAN — /api/supabase-place-update.js
// PATCH /api/supabase-place-update
// ====================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ success: false, message: 'Supabase credentials no configuradas. Verificar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
  }

  try {
    const body = req.body;
    const place_id = body.place_id;

    if (!place_id) {
      return res.status(400).json({ success: false, message: 'place_id es requerido' });
    }

    // Construir solo los campos que vienen en el body
    const fields = { updated_at: new Date().toISOString() };

    if (body.place_name         != null) fields.place_name              = body.place_name;
    if (body.category           != null) fields.category                = body.category;
    if (body.lat                != null) fields.lat                     = parseFloat(body.lat);
    if (body.lng                != null) fields.lng                     = parseFloat(body.lng);
    if (body.formatted_address  != null) fields.formatted_address       = body.formatted_address;
    if (body.rating             != null) fields.rating                  = body.rating ? parseFloat(body.rating) : null;
    if (body.photo_url          != null) fields.photo_url               = body.photo_url || null;
    if (body.website            != null) fields.website                 = body.website || null;
    if (body.types              != null) fields.types                   = body.types || null;
    if (body.hidden             != null) fields.hidden                  = Boolean(body.hidden);
    if (body.phone              != null) fields.formatted_phone_number  = body.phone || null;
    if (body.user_ratings_total != null) fields.user_ratings_total      = body.user_ratings_total ? parseInt(body.user_ratings_total) : null;
    if (body.reviews            != null) fields.reviews                 = body.reviews?.length ? body.reviews : null;
    if (body.editorial_summary  != null) fields.editorial_summary       = body.editorial_summary || null;
    if (body.description        != null) fields.description             = body.description || null;
    if (body.opening_hours      != null) fields.opening_hours           = body.opening_hours || null;
    if (body.featured           != null) fields.featured                = body.featured || null;
    if (body.pin_style          != null) fields.pin_style               = body.pin_style || null;
    if (body.pin_emoji          != null) fields.pin_emoji                = body.pin_emoji || null;
    if (body.pin_icon_url       != null) fields.pin_icon_url            = body.pin_icon_url || null;
    if (body.pin_size           != null) fields.pin_size                = body.pin_size || null;

    if (body.photos_urls != null) {
      fields.photos_urls = Array.isArray(body.photos_urls) ? body.photos_urls : null;
    }

    if (body.subcategory_tags != null) {
      const arr = Array.isArray(body.subcategory_tags)
        ? body.subcategory_tags
        : (body.subcategory_tags || '').split(',').map(s => s.trim()).filter(Boolean);
      fields.subcategory_tags = arr.join(',') || null;
    }

    console.log(`📝 Updating place_id: ${place_id}`, Object.keys(fields));

    const url = `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(fields),
    });

    const responseText = await response.text();
    console.log(`📝 Supabase response ${response.status}:`, responseText.slice(0, 200));

    if (!response.ok) {
      throw new Error(`Supabase error ${response.status}: ${responseText}`);
    }

    let data;
    try { data = JSON.parse(responseText); } catch(e) { data = []; }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: `No se encontró lugar con place_id: ${place_id}` });
    }

    return res.status(200).json({ success: true, record: data[0] });

  } catch (err) {
    console.error('supabase-place-update error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
