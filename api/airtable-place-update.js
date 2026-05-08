// ====================================================================
// API ENDPOINT: Actualizar un lugar en Airtable (todos los campos)
// PATCH /api/airtable-place-update
// Campos reales de la tabla Places (según sync-places-to-airtable.js):
//   place_id, place_name, category, lat, lng, formatted_address,
//   rating, photo_url, photos_urls, types, website,
//   formatted_phone_number, subcategory_tags, last_updated
// ====================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ success: false, message: 'Airtable credentials no configuradas' });
  }

  try {
    const {
      place_id,
      place_name, category, lat, lng,
      formatted_address, phone, website,
      photo_url, photos_urls, rating, user_ratings_total,
      subcategory_tags, types,
      reviews, editorial_summary, opening_hours, description,
      featured,
    } = req.body;

    if (!place_id) {
      return res.status(400).json({ success: false, message: 'place_id es requerido' });
    }

    // ── Buscar record ID en Airtable ──────────────────────────
    let recordId = null;

    if (place_id.startsWith('rec')) {
      // Es un Airtable record ID directo
      recordId = place_id;
    } else {
      const searchUrl = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/Places`
        + `?filterByFormula=${encodeURIComponent(`{place_id}="${place_id}"`)}&maxRecords=1`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
      });
      if (!searchRes.ok) throw new Error(`Airtable search error ${searchRes.status}`);
      const searchData = await searchRes.json();
      if (!searchData.records?.length) {
        return res.status(404).json({ success: false, message: `No se encontró lugar con place_id: ${place_id}` });
      }
      recordId = searchData.records[0].id;
    }

    // ── Construir campos con nombres exactos de Airtable ─────
    const fields = { last_updated: new Date().toISOString() };

    if (place_name         !== undefined) fields.place_name              = place_name;
    if (category           !== undefined) fields.category                = category;
    if (lat                !== undefined) fields.lat                     = parseFloat(lat);
    if (lng                !== undefined) fields.lng                     = parseFloat(lng);
    if (formatted_address  !== undefined) fields.formatted_address       = formatted_address || '';
    if (rating             !== undefined) fields.rating                  = rating ? parseFloat(rating) : null;
    if (photo_url          !== undefined) fields.photo_url               = photo_url || '';
    if (website            !== undefined) fields.website                 = website || '';
    if (types              !== undefined) fields.types                   = types || '';
    if (req.body.hidden    !== undefined) fields.hidden                  = Boolean(req.body.hidden);

    // Teléfono → campo correcto en Airtable es "formatted_phone_number"
    if (phone !== undefined) fields.formatted_phone_number = phone || '';

    // photos_urls → JSON string
    if (photos_urls !== undefined) {
      fields.photos_urls = Array.isArray(photos_urls)
        ? JSON.stringify(photos_urls)
        : (photos_urls || '');
    }

    // subcategory_tags → CSV string (campo Texto de línea única en Airtable)
    if (subcategory_tags !== undefined) {
      const tagsArr = Array.isArray(subcategory_tags)
        ? subcategory_tags
        : (subcategory_tags || '').split(',').map(s => s.trim());
      const clean = tagsArr.filter(t => t && t.length > 0);
      // Solo actualizar si hay tags — evitar enviar string vacío
      if (clean.length > 0) fields.subcategory_tags = clean.join(',');
    }

    if (user_ratings_total !== undefined) fields.user_ratings_total = user_ratings_total ? parseInt(user_ratings_total) : null;
    if (reviews       !== undefined) fields.reviews            = reviews?.length ? JSON.stringify(reviews) : '';
    if (editorial_summary !== undefined) fields.editorial_summary = editorial_summary || '';
    if (description   !== undefined) fields.description        = description || '';
    if (opening_hours !== undefined) fields.opening_hours      = opening_hours ? JSON.stringify(opening_hours) : '';
    if (featured !== undefined && featured !== null && featured !== '') fields.featured = featured;

    // ── Actualizar en Airtable ────────────────────────────────
    const updateUrl = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/Places/${recordId}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.text();
      throw new Error(`Airtable update error ${updateRes.status}: ${err}`);
    }

    const updated = await updateRes.json();
    return res.status(200).json({ success: true, record: updated });

  } catch (err) {
    console.error('airtable-place-update error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}