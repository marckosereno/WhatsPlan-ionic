// ====================================================================
// WHATSPLAN — humation-avatar.js
// Avatar por defecto (quien no ha subido foto): ilustración de línea
// negra de Humation (MIT), sobre un fondo pastel. Se genera EN EL
// TELÉFONO a partir de un texto (semilla): la misma semilla siempre da el
// mismo avatar. Sin internet, sin costos.
//
// La librería pesa ~700 KB (216 KB comprimida), así que se carga una sola
// vez y aparte (preloadHumation al iniciar la app). Mientras no ha
// cargado, defaultAvatarSync() devuelve null y se usa el avatar de antes.
//
// Archivo de la librería: src/vendor/humation.js
// ====================================================================

const BG = ['FFF1C9', 'EDE7FF', 'DDF5E8', 'FFE3D3', 'E3EEFF', 'FDE2EC']; // crema, lila, menta, durazno, cielo, rosa
const cache = new Map(); // semilla → data URI
let lib = null, loading = null;

const hash = (s) => [...String(s)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>>0, 2166136261);

export function preloadHumation() {
  if (lib) return Promise.resolve(lib);
  if (!loading) {
    loading = import('/src/vendor/humation.js')
      .then(m => { lib = m; document.dispatchEvent(new CustomEvent('wp:humation-ready')); return m; })
      .catch(e => { console.warn('[DIAG-AVATAR] no cargó Humation:', e.message || e); loading = null; return null; });
  }
  return loading;
}

function render(seed) {
  const key = String(seed || 'user').trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  // %27: sin comillas sueltas, para que sirva dentro de url('…') en estilos
  const uri = lib.createAvatar(lib.humation1, { seed: key, background: BG[hash(key) % BG.length] }).toDataUri().replace(/'/g, '%27');
  cache.set(key, uri);
  return uri;
}

// Data URI del avatar, o null si la librería aún no carga (la pide)
export function defaultAvatarSync(seed) {
  if (!lib) { preloadHumation(); return null; }
  try { return render(seed); } catch (e) { console.warn('[DIAG-AVATAR]', e.message || e); return null; }
}

// Igual, pero espera a que cargue
export async function defaultAvatar(seed) {
  await preloadHumation();
  return lib ? defaultAvatarSync(seed) : null;
}

// ¿Es uno de estos avatares generados? (no es foto subida)
export const isDefaultAvatar = (url) => typeof url === 'string' && url.startsWith('data:image/svg+xml');
