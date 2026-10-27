// ====================================================================
// WHATSPLAN — photo-url.js
// Qué versión de cada foto pedir, y cómo prepararlas al subirlas.
//
// Fotos de lugares NUEVAS (desde ahora): se suben DOS archivos WebP a
// place-photos/places/ con prefijo "v2_":
//   v2_<id>.webp    → grande (1280 px)  → hero / galería de la ficha
//   v2_<id>_t.webp  → miniatura (400 px) → pines, minicard, listas
// Las dos con caché de 1 año: el nombre nunca se repite, así que si la
// foto es la misma el teléfono la toma de su memoria, y si cambia es
// otro archivo (otra dirección) y se descarga una sola vez.
//
// Fotos VIEJAS (sin "v2_"): no tienen miniatura → cada quien usa lo que
// usaba antes. Nada se rompe.
// ====================================================================

export const PHOTO_CACHE = '31536000'; // 1 año, en segundos

const SB_PUBLIC = /supabase\.co\/storage\/v1\/object\/public\//;

export function isSupabasePhoto(url) {
  return !!url && SB_PUBLIC.test(url);
}

// ¿Es una foto nueva que trae miniatura hermana?
export function hasThumb(url) {
  return isSupabasePhoto(url) && url.includes('/place-photos/places/v2_') && !/_t\.(webp|jpg)(\?|$)/.test(url);
}

// Miniatura de 400 px, o null si la foto es vieja (sin miniatura)
export function photoThumb(url) {
  if (!hasThumb(url)) return null;
  return url.replace(/\.(webp|jpg)(\?|$)/, '_t.$1$2');
}

// Foto grande. Las de Supabase van DIRECTO (antes pasaban por
// /api/photo-proxy, que solo respondía "ve a Supabase": un viaje extra
// y una llamada a Vercel por cada foto).
export function photoFull(url) {
  if (!url) return null;
  if (/^(blob:|data:|\/api\/)/.test(url)) return url;
  if (isSupabasePhoto(url)) return url;
  return '/api/photo-proxy?url=' + encodeURIComponent(url);
}

// Para tarjetas y listas: miniatura si existe; si no, la grande
export function photoSmall(url) {
  return photoThumb(url) || photoFull(url);
}

// ── Preparar una foto de lugar para subirla ─────────────────────────
// Devuelve { full, thumb, ext } (Blobs). WebP si el teléfono lo puede
// generar; si no (algunos iPhone viejos), JPG.
function _draw(img, max, type, q) {
  return new Promise((resolve) => {
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (w > max || h > max) {
      if (w >= h) { h = Math.round(h * max / w); w = max; }
      else        { w = Math.round(w * max / h); h = max; }
    }
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, h);
    c.toBlob(resolve, type, q);
  });
}

export async function preparePlacePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    let full  = await _draw(img, 1280, 'image/webp', 0.8);
    let thumb = await _draw(img, 400,  'image/webp', 0.72);
    let ext = 'webp';
    if (!full || full.type !== 'image/webp' || !thumb || thumb.type !== 'image/webp') {
      full  = await _draw(img, 1280, 'image/jpeg', 0.82);
      thumb = await _draw(img, 400,  'image/jpeg', 0.75);
      ext = 'jpg';
    }
    return { full, thumb, ext };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Sube la pareja grande + miniatura y devuelve la URL pública de la grande
export async function uploadPlacePhoto(supabase, file) {
  const { full, thumb, ext } = await preparePlacePhoto(file);
  const id = Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  const pFull  = `places/v2_${id}.${ext}`;
  const pThumb = `places/v2_${id}_t.${ext}`;
  const bucket = supabase.storage.from('place-photos');
  const opts = { contentType: full.type, cacheControl: PHOTO_CACHE, upsert: false };
  const a = await bucket.upload(pThumb, thumb, opts); // primero la miniatura: si falla, no queda la grande sin pareja
  if (a.error) throw a.error;
  const b = await bucket.upload(pFull, full, opts);
  if (b.error) { await bucket.remove([pThumb]); throw b.error; }
  return bucket.getPublicUrl(pFull).data.publicUrl;
}

// ── Paso 3: convertir las fotos YA subidas ──────────────────────────
// Por cada lugar: descarga cada foto vieja de Supabase, crea la pareja
// v2 (WebP 1280 + miniatura 400, caché 1 año) y actualiza el lugar para
// que apunte a las nuevas. Las ORIGINALES NO se borran aquí: si algo
// sale mal, el lugar sigue con su foto de siempre.
// Devuelve { converted, skipped, failed, updated }
export async function convertPlacePhotos(supabase, place) {
  const r = { converted: 0, skipped: 0, failed: 0, updated: false };
  const pid = place.place_id || place.placeId;
  if (!pid) return r;
  const list = (Array.isArray(place.photosUrls) && place.photosUrls.length)
    ? place.photosUrls.slice()
    : (place.photoUrl ? [place.photoUrl] : []);
  const cover = place.photoUrl || list[0] || null;
  if (!list.length && !cover) return r;

  const map = new Map(); // vieja → nueva
  const todo = [...new Set([cover, ...list].filter(Boolean))];
  for (const u of todo) {
    // Ya convertida, o no está en Supabase (no se toca)
    if (!isSupabasePhoto(u) || u.includes('/place-photos/places/v2_') || u.includes('/render/image/')) { r.skipped++; continue; }
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('no es imagen');
      const nu = await uploadPlacePhoto(supabase, new File([blob], 'p', { type: blob.type }));
      map.set(u, nu);
      r.converted++;
    } catch (e) {
      r.failed++;
      console.warn('[FOTOS] no se pudo convertir', pid, u.slice(-60), e.message);
    }
  }
  if (!map.size) return r;

  const body = { place_id: pid };
  if (list.length) body.photos_urls = list.map(u => map.get(u) || u);
  if (cover) body.photo_url = map.get(cover) || cover;
  const res = await fetch('/api/supabase-place-update', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('No se pudo guardar el lugar: ' + (await res.text()).slice(0, 120));
  // Reflejarlo en memoria para no tener que recargar
  if (body.photos_urls) place.photosUrls = body.photos_urls;
  if (body.photo_url) place.photoUrl = body.photo_url;
  r.updated = true;
  return r;
}
