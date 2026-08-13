// ====================================================================
// WHATSPLAN — /api/supabase-places.js
// Reemplaza airtable-places.js — sin límite de llamadas
// GET /api/supabase-places?category=RESTAURANTS
// ====================================================================

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-side key

// Caché en memoria — por si hay cold starts frecuentes
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { category, include_hidden, _clear_cache } = req.query;
  const cacheKey = (category || 'all') + (include_hidden ? '_hidden' : '');
  const now = Date.now();

  // Limpiar caché si SuperPanel lo solicita
  if (_clear_cache || include_hidden) {
    delete cache[cacheKey];
    delete cache[cacheKey.replace('_hidden','')];
  }

  // Cache hit — solo para requests normales de usuarios
  if (!include_hidden && !_clear_cache && cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ success: true, places: cache[cacheKey].data, cached: true });
  }

try {
    // Construir query a Supabase REST API
    const hiddenFilter = include_hidden ? '' : '&hidden=eq.false';
    // featured es text: ordenar nulls al final, luego por rating
    let url = `${SUPABASE_URL}/rest/v1/places?select=*&order=featured.desc.nullslast,rating.desc` + hiddenFilter;
    if (category && category !== 'ALL') {
      url += `&category=eq.${encodeURIComponent(category)}`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey':        SUPABASE_SERVICE || process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE || process.env.SUPABASE_ANON_KEY}`,
        'Content-Type':  'application/json',
      }
    });

    if (!response.ok) throw new Error(`Supabase error: ${response.status}`);

    const records = await response.json();

    // Transformar al mismo formato que airtable-places.js
    const places = records.map(function(r) {
      let photosUrls = [];
      try { photosUrls = typeof r.photos_urls === 'string' ? JSON.parse(r.photos_urls) : (r.photos_urls || []); } catch(e) {}

      let reviews = [];
      try { reviews = typeof r.reviews === 'string' ? JSON.parse(r.reviews) : (r.reviews || []); } catch(e) {}

      let openingHours = null;
      try { openingHours = typeof r.opening_hours === 'string' ? JSON.parse(r.opening_hours) : r.opening_hours; } catch(e) {}

      return {
        place_id:                  r.place_id,
        name:                      r.place_name,
        displayName:               r.place_name,
        featured:                  r.featured || null, // string: 'featured', 'verified', 'premium'
        category:                  r.category,
        description:               r.description || '',
        subcategory_tags:          r.subcategory_tags || '',
        // subcategoryTags como array para filterBySubcat
        subcategoryTags:           r.subcategory_tags
          ? r.subcategory_tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
          : [],
        rating:                    r.rating ? parseFloat(r.rating) : null,
        userRatingCount:           r.user_ratings_total || 0,
        formattedAddress:          r.formatted_address || '',
        lat:                       r.lat ? parseFloat(r.lat) : null,
        lng:                       r.lng ? parseFloat(r.lng) : null,
        location:                  r.lat && r.lng ? { lat: parseFloat(r.lat), lng: parseFloat(r.lng) } : null,
        priceLevel:                r.price_level || null,
        photoUrl:                  r.photo_url || (photosUrls[0] || null),
        photosUrls:                photosUrls,
        reviews:                   reviews,
        openingHoursText:          openingHours,
        regularOpeningHours:       openingHours ? _buildOpeningHours(openingHours) : null,
        phone:                     r.formatted_phone_number || '',
        internationalPhoneNumber:  r.international_phone_number || '',
        website:                   r.website || '',
        googleMapsUri:             r.google_maps_uri || '',
        primaryType:               r.primary_type || '',
        editorialSummary:          r.editorial_summary || '',
        businessStatus:            r.business_status || 'OPERATIONAL',
        dineIn:                    r.dine_in,
        takeout:                   r.takeout,
        delivery:                  r.delivery,
        pinStyle:                  r.pin_style || 'photo', // 'photo' | 'sticker'
        pinEmoji:                  r.pin_emoji || null,
        pinIconUrl:                r.pin_icon_url || null,
        pinSize:                   r.pin_size || 'normal', // 'mini' | 'normal' | 'grande'
        pinStrokeColor:            r.pin_stroke_color || null,
        pinStrokeWidth:            r.pin_stroke_width ?? null,
        pinBadgeColor:             r.pin_badge_color || null,
        pinEventMode:              r.pin_event_mode || false,
        pinEventLabel:             r.pin_event_label || null,
        pinEventBadgeStyle:        r.pin_event_badge_style || 'icon',
        pinEventPhotoShape:        r.pin_event_photo_shape || 'portrait',
      };
    }).filter(function(p) { return p.lat && p.lng && p.name; });

    // Solo cachear requests normales — no SuperPanel ni _clear_cache
    if (!_clear_cache && !include_hidden) {
      cache[cacheKey] = { data: places, timestamp: now };
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
    res.status(200).json({ success: true, places, count: places.length, category: cacheKey, cached: false });

  } catch(error) {
    console.error('❌ supabase-places error:', error);
    res.status(500).json({ success: false, error: error.message, places: [], count: 0 });
  }
}

// Convertir opening_hours object a regularOpeningHours para compatibilidad
function _buildOpeningHours(hoursObj) {
  if (!hoursObj || typeof hoursObj !== 'object') return null;
  const dayMap = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  const periods = [];
  Object.entries(hoursObj).forEach(function([day, text]) {
    const dayNum = dayMap[day];
    if (dayNum === undefined || !text || text === 'Cerrado' || text === 'Closed') return;
    // Acepta "AM"/"PM" con o sin puntos (a.m., p.m., AM, PM...) — el
    // placeholder del formulario sugiere el formato con puntos, y el
    // regex viejo (solo "AM|PM" sin puntos) nunca lo matcheaba, dejando
    // el día sin período y rompiendo el cálculo de abierto/cerrado
    const match = text.match(/(\d+):(\d+)\s*([AP])\.?M\.?.*?(\d+):(\d+)\s*([AP])\.?M\.?/i);
    if (!match) return;
    let oh = parseInt(match[1]), om = parseInt(match[2]), oa = match[3].toUpperCase();
    let ch = parseInt(match[4]), cm = parseInt(match[5]), ca = match[6].toUpperCase();
    if (oa === 'P' && oh !== 12) oh += 12;
    if (oa === 'A' && oh === 12) oh = 0;
    if (ca === 'P' && ch !== 12) ch += 12;
    if (ca === 'A' && ch === 12) ch = 0;
    periods.push({ open: { day: dayNum, hour: oh, minute: om }, close: { day: dayNum, hour: ch, minute: cm } });
  });
  return periods.length > 0 ? { periods } : null;
}
