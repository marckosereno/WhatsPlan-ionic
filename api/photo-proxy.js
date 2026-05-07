// ====================================================================
// PHOTO PROXY — Sirve fotos de Google Places
// Si la foto es de Google, la descarga, la sube a Supabase Storage,
// actualiza Airtable con la URL permanente, y la sirve.
// La próxima vez Airtable ya tiene la URL de Supabase → no pasa por aquí.
// ====================================================================

const GOOGLE_KEY       = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';
const SUPABASE_URL     = process.env.SUPABASE_URL || '';
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const AIRTABLE_KEY     = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE    = process.env.AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
const BUCKET           = 'place-photos';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  let { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let decodedUrl;
  try { decodedUrl = decodeURIComponent(url); }
  catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }

  // Solo dominios de Google
  const allowed = ['places.googleapis.com', 'maps.googleapis.com', 'lh3.googleusercontent.com'];
  if (!allowed.some(d => decodedUrl.includes(d))) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  // Arreglar key si está mal
  if (!decodedUrl.includes('key=') || decodedUrl.includes('key=undefined') || decodedUrl.includes('key=null')) {
    decodedUrl = decodedUrl.replace(/key=[^&]*/, '').replace(/[?&]$/, '');
    const sep = decodedUrl.includes('?') ? '&' : '?';
    decodedUrl += `${sep}key=${GOOGLE_KEY}`;
  }

  // Agregar maxWidthPx si falta (requerido por la API nueva)
  if (decodedUrl.includes('/v1/places/') && !decodedUrl.includes('maxWidthPx') && !decodedUrl.includes('maxHeightPx')) {
    decodedUrl += '&maxWidthPx=800';
  }

  try {
    // Fetch de Google — usar header X-Goog-Api-Key para la API nueva
    const isNewApi = decodedUrl.includes('/v1/places/');
    const keyMatch = decodedUrl.match(/[?&]key=([^&]+)/);
    const apiKey   = keyMatch ? keyMatch[1] : GOOGLE_KEY;

    const googleRes = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HiMarcoBot/1.0)',
        ...(isNewApi && { 'X-Goog-Api-Key': apiKey })
      },
      redirect: 'follow'
    });

    if (!googleRes.ok) {
      console.error('❌ Google fetch failed:', googleRes.status, decodedUrl.substring(0, 100));
      return res.status(googleRes.status).json({ error: `Google: ${googleRes.status}` });
    }

    const contentType = googleRes.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Not an image', contentType });
    }

    const buffer = Buffer.from(await googleRes.arrayBuffer());
    console.log(`✅ Foto descargada: ${Math.round(buffer.length / 1024)}KB`);

    // ── Subir a Supabase Storage en background (no bloquea la respuesta) ──
    if (SUPABASE_URL && SUPABASE_KEY) {
      const placeIdMatch = decodedUrl.match(/places\/([^/]+)\/photos/);
      if (placeIdMatch) {
        const placeId   = placeIdMatch[1].replace(/[^a-zA-Z0-9_-]/g, '_');
        const photoHash = Buffer.from(decodedUrl).toString('base64').substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
        const ext       = contentType.includes('png') ? 'png' : 'jpg';
        const path      = `${placeId}/${photoHash}.${ext}`;

        // Fire and forget — no await para no retrasar la respuesta
        uploadToSupabase(buffer, contentType, path, placeId, decodedUrl)
          .catch(e => console.warn('⚠️ Supabase upload failed (non-critical):', e.message));
      }
    }

    // Servir la imagen inmediatamente
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (error) {
    console.error('❌ Proxy error:', error.message);
    res.status(500).json({ error: 'Failed to fetch photo', detail: error.message });
  }
}

// ── Sube foto a Supabase y actualiza Airtable con la URL permanente ──
async function uploadToSupabase(buffer, contentType, path, placeId, originalGoogleUrl) {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Supabase upload: ${err}`);
  }

  const supabaseUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  console.log(`☁️ Subido a Supabase: ${supabaseUrl}`);

  // Actualizar Airtable: buscar el registro que tiene esta URL de Google
  if (!AIRTABLE_KEY || !AIRTABLE_BASE) return;

  // Buscar por photo_url
  const searchRes = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/Places?filterByFormula=FIND("${placeId}",{photo_url})&maxRecords=1`,
    { headers: { 'Authorization': `Bearer ${AIRTABLE_KEY}` } }
  );

  const searchData = await searchRes.json();
  if (!searchData.records?.length) return;

  const record = searchData.records[0];
  const f      = record.fields;

  // Reemplazar en photo_url si coincide
  const newPhotoUrl = f.photo_url?.includes(placeId) ? supabaseUrl : f.photo_url;

  // Reemplazar en photos_urls array
  let newPhotosUrls = f.photos_urls;
  try {
    const arr = JSON.parse(f.photos_urls || '[]');
    const updated = arr.map(u => u.includes(placeId) && u === originalGoogleUrl.split('&key=')[0] + '&key=' + (u.match(/key=([^&]+)/)?.[1] || '') ? supabaseUrl : u);
    // Si alguna cambió, actualizar todo el array
    if (JSON.stringify(updated) !== JSON.stringify(arr)) {
      newPhotosUrls = JSON.stringify(updated);
    }
  } catch(e) {}

  await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Places/${record.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: {
      photo_url: newPhotoUrl,
      photos_urls: newPhotosUrls
    }})
  });

  console.log(`✅ Airtable actualizado con URL de Supabase para placeId: ${placeId}`);
}
