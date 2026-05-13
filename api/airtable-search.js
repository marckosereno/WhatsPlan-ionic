// ====================================================================
// WHATSPLAN — /api/airtable-search.js
// Búsqueda de lugares por nombre en Airtable
// GET /api/airtable-search?q=tacos&category=RESTAURANTS&limit=8
// ====================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, category, limit = '8' } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const query = q.trim();

    // Búsqueda parcial por nombre (case-insensitive)
    let formula = `SEARCH(LOWER("${query}"), LOWER({place_name})) > 0`;

    // Filtro de hidden
    formula = `AND(${formula}, {hidden} != TRUE())`;

    // Filtro de categoría si se especifica
    if (category && category !== 'ALL') {
      formula = `AND(${formula}, {category} = "${category}")`;
    }

    const params = new URLSearchParams({
      filterByFormula: formula,
      maxRecords: String(parseInt(limit, 10) || 8),
    });
    params.append('sort[0][field]', 'featured');
    params.append('sort[0][direction]', 'desc');
    params.append('sort[1][field]', 'rating');
    params.append('sort[1][direction]', 'desc');
    params.append('fields[]', 'place_name');
    params.append('fields[]', 'category');
    params.append('fields[]', 'formatted_address');
    params.append('fields[]', 'lat');
    params.append('fields[]', 'lng');
    params.append('fields[]', 'rating');
    params.append('fields[]', 'photo_url');
    params.append('fields[]', 'place_id');
    params.append('fields[]', 'featured');

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Places?${params}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });

    if (!response.ok) {
      throw new Error(`Airtable error: ${response.status}`);
    }

    const data = await response.json();

    const results = (data.records || []).map(record => {
      const f = record.fields;
      return {
        place_id:  f.place_id  || '',
        name:      f.place_name || '',
        address:   f.formatted_address || '',
        category:  f.category  || '',
        lat:       parseFloat(f.lat) || 0,
        lng:       parseFloat(f.lng) || 0,
        rating:    f.rating    || null,
        photo_url: f.photo_url || null,
        featured:  f.featured  || false,
      };
    }).filter(r => r.lat && r.lng);

    // Cache 10 minutos
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).json({ success: true, results });

  } catch (error) {
    console.error('❌ Search error:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
}
