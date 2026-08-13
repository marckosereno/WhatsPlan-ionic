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

    // Construir solo los campos que vienen en el body.
    // OJO: se usa "'campo' in body" (no "!= null") a propósito — el frontend
    // manda explícitamente null cuando el usuario quiere LIMPIAR un campo
    // (ej: sacar "Destacado"), y con "!= null" ese null se ignoraba, dejando
    // el valor viejo pegado en la base. "in" sí distingue bien "no vino en
    // el body" de "vino explícitamente como null".
    const fields = { updated_at: new Date().toISOString() };

    if ('place_name'         in body) fields.place_name              = body.place_name;
    if ('category'           in body) fields.category                = body.category;
    if ('lat'                in body) fields.lat                     = parseFloat(body.lat);
    if ('lng'                in body) fields.lng                     = parseFloat(body.lng);
    if ('formatted_address'  in body) fields.formatted_address       = body.formatted_address;
    if ('rating'             in body) fields.rating                  = body.rating ? parseFloat(body.rating) : null;
    if ('photo_url'          in body) fields.photo_url               = body.photo_url || null;
    if ('website'            in body) fields.website                 = body.website || null;
    if ('types'              in body) fields.types                   = body.types || null;
    if ('hidden'             in body) fields.hidden                  = Boolean(body.hidden);
    if ('phone'              in body) fields.formatted_phone_number  = body.phone || null;
    if ('user_ratings_total' in body) fields.user_ratings_total      = body.user_ratings_total ? parseInt(body.user_ratings_total) : null;
    if ('reviews'            in body) fields.reviews                 = body.reviews?.length ? body.reviews : null;
    if ('editorial_summary'  in body) fields.editorial_summary       = body.editorial_summary || null;
    if ('description'        in body) fields.description             = body.description || null;
    if ('opening_hours'      in body) fields.opening_hours           = body.opening_hours || null;
    if ('featured'           in body) fields.featured                = body.featured || null;
    if ('pin_style'          in body) fields.pin_style               = body.pin_style || null;
    if ('pin_emoji'          in body) fields.pin_emoji                = body.pin_emoji || null;
    if ('pin_icon_url'       in body) fields.pin_icon_url            = body.pin_icon_url || null;
    if ('pin_size'           in body) fields.pin_size                = body.pin_size || null;
    if ('pin_stroke_color'   in body) fields.pin_stroke_color        = body.pin_stroke_color || null;
    if ('pin_stroke_width'   in body) fields.pin_stroke_width        = body.pin_stroke_width ? parseFloat(body.pin_stroke_width) : null;
    if ('pin_badge_color'    in body) fields.pin_badge_color         = body.pin_badge_color || null;
    if ('pin_event_mode'     in body) fields.pin_event_mode          = Boolean(body.pin_event_mode);
    if ('pin_event_label'    in body) fields.pin_event_label         = body.pin_event_label || null;
    if ('pin_event_badge_style' in body) fields.pin_event_badge_style = body.pin_event_badge_style || null;
    if ('pin_event_photo_shape' in body) fields.pin_event_photo_shape = body.pin_event_photo_shape || null;

    if ('photos_urls' in body) {
      fields.photos_urls = Array.isArray(body.photos_urls) ? body.photos_urls : null;
    }

    if ('subcategory_tags' in body) {
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
