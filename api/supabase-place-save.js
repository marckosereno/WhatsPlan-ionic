// ====================================================================
// WHATSPLAN — /api/supabase-place-save.js
// POST /api/supabase-place-save
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
      place_name, category, lat, lng, formatted_address,
      phone, website, photo_url, photos_urls,
      rating, user_ratings_total, place_id, subcategory_tags, types,
      reviews, editorial_summary, opening_hours, description, featured, hidden,
      pin_style, pin_emoji, pin_icon_url, pin_size,
      pin_stroke_color, pin_stroke_width,
      pin_badge_color, pin_event_mode, pin_event_label,
      pin_event_badge_style, pin_event_photo_shape,
    } = req.body;

    if (!place_name || !category || !lat || !lng) {
      return res.status(400).json({ success: false, message: 'place_name, category, lat y lng son requeridos' });
    }

    const record = {
      place_id:                   place_id || ('custom_' + Date.now()),
      place_name,
      category,
      lat:                        parseFloat(lat),
      lng:                        parseFloat(lng),
      formatted_address:          formatted_address || '',
      rating:                     rating ? parseFloat(rating) : null,
      user_ratings_total:         user_ratings_total ? parseInt(user_ratings_total) : null,
      photo_url:                  photo_url || null,
      photos_urls:                photos_urls?.length ? photos_urls : null,
      subcategory_tags:           Array.isArray(subcategory_tags)
                                    ? subcategory_tags.join(',')
                                    : (subcategory_tags || null),
      formatted_phone_number:     phone || null,
      website:                    website || null,
      types:                      types || null,
      reviews:                    reviews?.length ? reviews : null,
      editorial_summary:          editorial_summary || null,
      description:                description || editorial_summary || null,
      opening_hours:              opening_hours || null,
      featured:                   featured || null, // string: 'featured', 'verified', 'premium'
      hidden:                     hidden === true || hidden === 'true' || false,
      business_status:            'OPERATIONAL',
      pin_style:                  pin_style || null,   // 'photo' | 'sticker'
      pin_emoji:                  pin_emoji || null,
      pin_icon_url:               pin_icon_url || null, // sticker/imagen custom
      pin_size:                   pin_size || 'normal', // 'mini' | 'normal' | 'grande'
      pin_stroke_color:           pin_stroke_color || null,
      pin_stroke_width:           pin_stroke_width ? parseFloat(pin_stroke_width) : null,
      pin_badge_color:            pin_badge_color || null,
      pin_event_mode:             Boolean(pin_event_mode),
      pin_event_label:            pin_event_label || null,
      pin_event_badge_style:      pin_event_badge_style || 'icon',
      pin_event_photo_shape:      pin_event_photo_shape || 'portrait',
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/places`, {
      method: 'POST',
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
    return res.status(200).json({ success: true, record: data[0] || data });

  } catch (err) {
    console.error('supabase-place-save error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
