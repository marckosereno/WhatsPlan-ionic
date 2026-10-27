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
  console.log(`[DIAG-PHOTO] subida ${Math.round(full.size / 1024)} KB + miniatura ${Math.round(thumb.size / 1024)} KB (${ext})`);
  return bucket.getPublicUrl(pFull).data.publicUrl;
}
