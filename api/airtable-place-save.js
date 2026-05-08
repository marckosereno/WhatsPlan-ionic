// ====================================================================
// API ENDPOINT: Guardar un lugar en Airtable (superuser)
// POST /api/airtable-place-save
// ====================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ success: false, message: 'Airtable credentials no configuradas' });
  }

  try {
    const {
      place_name, category, lat, lng, formatted_address,
      phone, website, photo_url, photos_urls,
      rating, user_ratings_total, place_id, subcategory_tags, types,
      reviews, editorial_summary, opening_hours, description,
    } = req.body;

    if (!place_name || !category || !lat || !lng) {
      return res.status(400).json({ success: false, message: 'place_name, category, lat y lng son requeridos' });
    }

    const fields = {
      place_id:               place_id || ('custom_' + Date.now()),
      place_name,
      category,
      lat:                    parseFloat(lat),
      lng:                    parseFloat(lng),
      formatted_address:      formatted_address || '',
      rating:                 rating ? parseFloat(rating) : undefined,
      user_ratings_total:     user_ratings_total ? parseInt(user_ratings_total) : undefined,
      photo_url:              photo_url || undefined,
      photos_urls:            photos_urls?.length ? JSON.stringify(photos_urls) : undefined,
      subcategory_tags:       Array.isArray(subcategory_tags) && subcategory_tags.length
                               ? subcategory_tags.join(',')
                               : (typeof subcategory_tags === 'string' && subcategory_tags ? subcategory_tags : undefined),
      formatted_phone_number: phone || undefined,
      website:                website || undefined,
      types:                  types || undefined,
      reviews:                reviews?.length ? JSON.stringify(reviews) : undefined,
      editorial_summary:      editorial_summary || undefined,
      // description es el campo manual editable — si no viene, usar editorial_summary
      description:            description || editorial_summary || undefined,
      opening_hours:          opening_hours ? JSON.stringify(opening_hours) : undefined,
      last_updated:           new Date().toISOString(),
    };

    // Limpiar campos undefined
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);

    const url = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/Places`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Airtable error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return res.status(200).json({ success: true, record: data });

  } catch (err) {
    console.error('airtable-place-save error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
