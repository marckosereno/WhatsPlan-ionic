// ====================================================================
// API ENDPOINT: Obtener detalles de un lugar de Google Places
// Solo para uso del superusuario — importar lugares al mapa
// ====================================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ success: false, message: 'place_id requerido' });

  const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY
                  || process.env.GOOGLE_MAPS_API_KEY
                  || process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
                  || process.env.VITE_GOOGLE_PLACES_API_KEY
                  || '';
  if (!GOOGLE_KEY) {
    return res.status(500).json({ success: false, message: 'Google API key no encontrada.' });
  }

  try {
    const fields = [
      'place_id','name','formatted_address','geometry',
      'rating','user_ratings_total','formatted_phone_number','website',
      'photos','price_level','types',
      'reviews',           // hasta 5 reseñas
      'editorial_summary', // descripción corta de Google
      'opening_hours',     // horarios por día
    ].join(',');

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&key=${GOOGLE_KEY}&language=es&reviews_sort=newest`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(404).json({
        success: false,
        message: `Google: ${data.status}${data.error_message ? ' — ' + data.error_message : ''}`
      });
    }

    const r = data.result;

    // Hasta 5 fotos
    const photos = (r.photos || []).slice(0, 5).map(p =>
      'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=' + p.photo_reference + '&key=' + GOOGLE_KEY
    );

    // Reseñas — hasta 5
    const reviews = (r.reviews || []).slice(0, 5).map(rv => ({
      author_name:   rv.author_name || 'Anónimo',
      rating:        rv.rating || 0,
      text:          rv.text || '',
      time:          rv.time || null,
      relative_time: rv.relative_time_description || '',
    }));

    // Horarios — objeto {monday, tuesday, ...} con texto legible
    let opening_hours = null;
    if (r.opening_hours?.weekday_text?.length) {
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      opening_hours = {};
      r.opening_hours.weekday_text.forEach((text, i) => {
        // Formato Google: "lunes: 9:00 a.m. – 9:00 p.m."
        const parts = text.split(': ');
        opening_hours[days[i]] = parts.length > 1 ? parts.slice(1).join(': ') : text;
      });
    }

    return res.status(200).json({
      success: true,
      place: {
        place_id:          r.place_id,
        name:              r.name,
        formatted_address: r.formatted_address || '',
        lat:               r.geometry?.location?.lat,
        lng:               r.geometry?.location?.lng,
        rating:            r.rating || null,
        user_ratings_total: r.user_ratings_total || null,
        phone:             r.formatted_phone_number || null,
        website:           r.website || null,
        photo_url:         photos[0] || null,
        photos_urls:       photos,
        price_level:       r.price_level || null,
        types:             (r.types || []).join(','),
        reviews,
        editorial_summary: r.editorial_summary?.overview || null,
        opening_hours,
      }
    });
  } catch (err) {
    console.error('google-place-details error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
