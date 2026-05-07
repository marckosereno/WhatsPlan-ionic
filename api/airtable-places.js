// ====================================================================
// API ENDPOINT: Obtener Lugares desde Airtable (con paginación)
// ====================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

// Cache en memoria por categoría (5 minutos)
const cache = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchAllRecords(url, headers) {
  let allRecords = [];
  let offset = null;

  do {
    const pageUrl = offset ? `${url}&offset=${offset}` : url;
    const response = await fetch(pageUrl, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;

    console.log(`📄 Page fetched: ${data.records?.length} records, offset: ${offset || 'done'}`);
  } while (offset);

  return allRecords;
}

function transformRecord(record, includeHidden = false) {
  const f = record.fields;
  const lat = parseFloat(f.lat);
  const lng = parseFloat(f.lng);

  // Ignorar registros sin coordenadas válidas
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
  // Ignorar registros sin nombre
  if (!f.place_name) return null;
  // Ignorar registros ocultos por el superuser (salvo que se pida incluirlos)
  if (f.hidden === true && !includeHidden) return null;

  // Parsear subcategory_tags: puede ser CSV "salon,hair" o JSON array
  let subcategoryTags = [];
  if (f.subcategory_tags) {
    try {
      subcategoryTags = JSON.parse(f.subcategory_tags);
    } catch(e) {
      subcategoryTags = f.subcategory_tags.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Parsear reviews
  let reviews = [];
  if (f.reviews) {
    try { reviews = JSON.parse(f.reviews); } catch(e) { reviews = []; }
  }

  // Parsear opening_hours
  let openingHours = null;
  if (f.opening_hours) {
    try { openingHours = JSON.parse(f.opening_hours); } catch(e) { openingHours = null; }
  }


  return {
    id:               f.place_id || record.id,
    place_id:         f.place_id || record.id,
    name:             f.place_name,
    displayName:      f.place_name,
    category:         f.category || '',
    location:         { lat, lng },
    rating:           f.rating || null,
    userRatingCount:  f.user_ratings_total || null,
    formattedAddress: f.formatted_address || '',
    priceLevel:       f.price_level || null,
    types:            f.types ? f.types.split(',') : [],
    subcategoryTags,
    phone:            f.formatted_phone_number || f.phone || null,
    website:          f.website || null,
    photoUrl:         f.photo_url || null,
    photosUrls:       f.photos_urls
      ? (() => { try { return JSON.parse(f.photos_urls); } catch(e) { return []; } })()
      : [],
    description:      f.description || f.editorial_summary || null,
    editorialSummary: f.editorial_summary || null,
    reviews,
    openingHours,
    lastUpdated:      f.last_updated,
    _fromAirtable:    true,
    _hidden:          f.hidden === true,
    featured:         f.featured || f.Featured || null   // 'featured' | 'verified' | 'premium' | null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { category } = req.query;
    const includeHidden = req.query.include_hidden === 'true';

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      throw new Error('Airtable credentials not configured');
    }

    const cacheKey = category || 'all';
    const now = Date.now();
    // _t param con timestamp real invalida el cache del servidor
    const forceRefresh = !!req.query._t;

    // Verificar cache (solo si no se fuerza refresh)
    if (!forceRefresh && cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
      console.log(`💾 Cache hit: ${cacheKey}`);
      const places = cache[cacheKey].data;
      return res.status(200).json({
        success: true, places, count: places.length,
        category: cacheKey, cached: true
      });
    }

    // Construir URL con filtro opcional
    let url = `${AIRTABLE_BASE_URL}/${AIRTABLE_BASE_ID}/Places?pageSize=100`;
    if (category) {
      url += `&filterByFormula=${encodeURIComponent(`{category}="${category}"`)}`;
    }

    console.log(`📡 Fetching Airtable: ${cacheKey}...`);
    const records = await fetchAllRecords(url, {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`
    });

    console.log(`✅ Total records from Airtable: ${records.length}`);

    const places = records.map(r => transformRecord(r, includeHidden)).filter(Boolean);
    console.log(`✅ Valid places (with coords+name): ${places.length}`);

    // Guardar en cache
    cache[cacheKey] = { data: places, timestamp: now };

    res.status(200).json({
      success: true, places, count: places.length,
      category: cacheKey, cached: false,
      total_records: records.length,
      valid_places: places.length
    });

  } catch (error) {
    console.error('❌ Error fetching from Airtable:', error);
    res.status(500).json({
      success: false, error: error.message, places: [], count: 0
    });
  }
}
