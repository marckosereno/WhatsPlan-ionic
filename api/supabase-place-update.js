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

  try {
    const {
      place_id,
      place_name, category, lat, lng,
      formatted_address, phone, website,
      photo_url, photos_urls, rating, user_ratings_total,
      subcategory_tags, types,
      reviews, editorial_summary, opening_hours, description,
      featured, hidden,
    } = req.body;

    if (!place_id) {
      return res.status(400).json({ success: false, message: 'place_id es requerido' });
    }

    const fields = { updated_at: new Date().toISOString() };

    if (place_name         !== undefined) fields.place_name              = place_name;
    if (category           !== undefined) fields.category                = category;
    if (lat                !== undefined) fields.lat                     = parseFloat(lat);
    if (lng                !== undefined) fields.lng                     = parseFloat(lng);
    if (formatted_address  !== undefined) fields.formatted_address       = formatted_address || '';
    if (rating             !== undefined) fields.rating                  = rating ? parseFloat(rating) : null;
    if (photo_url          !== undefined) fields.photo_url               = photo_url || null;
    if (website            !== undefined) fields.website                 = website || null;
    if (types              !== undefined) fields.types                   = types || null;
    if (hidden             !== undefined) fields.hidden                  = Boolean(hidden);
    if (phone              !== undefined) fields.formatted_phone_number  = phone || null;
    if (user_ratings_total !== undefined) fields.user_ratings_total      = user_ratings_total ? parseInt(user_ratings_total) : null;
    if (reviews            !== undefined) fields.reviews                 = reviews?.length ? reviews : null;
    if (editorial_summary  !== undefined) fields.editorial_summary       = editorial_summary || null;
    if (description        !== undefined) fields.description             = description || null;
    if (opening_hours      !== undefined) fields.opening_hours           = opening_hours || null;

    if (photos_urls !== undefined) {
      fields.photos_urls = Array.isArray(photos_urls) ? photos_urls : null;
    }

    if (subcategory_tags !== undefined) {
      const arr = Array.isArray(subcategory_tags)
        ? subcategory_tags
        : (subcategory_tags || '').split(',').map(s => s.trim()).filter(Boolean);
      fields.subcategory_tags = arr.join(',') || null;
    }

    if (featured !== undefined) {
      // Guardar string directamente: 'featured', 'verified', 'premium', o null
      fields.featured = featured || null;
    }

    // Actualizar en Supabase por place_id
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/places?place_id=eq.${encodeURIComponent(place_id)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=representation',
        },
        body: JSON.stringify(fields),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Supabase error ${response.status}: ${err}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: `No se encontró lugar con place_id: ${place_id}` });
    }

    return res.status(200).json({ success: true, record: data[0] });

  } catch (err) {
    console.error('supabase-place-update error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
