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

export const BG = ['FFF1C9', 'EDE7FF', 'DDF5E8', 'FFE3D3', 'E3EEFF', 'FDE2EC']; // crema, lila, menta, durazno, cielo, rosa
const cache = new Map(); // semilla → data URI
let lib = null, loading = null;

export const hash = (s) => [...String(s)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>>0, 2166136261);

export function preloadHumation() {
  if (lib) return Promise.resolve(lib);
  if (!loading) {
    // 1º el archivo local; si falla (p. ej. quedó cortado al copiarlo),
    // la misma versión desde esm.sh (necesita internet esa vez)
    loading = import('/src/vendor/humation.js')
      .catch(e => {
        console.warn('[DIAG-AVATAR] no cargó src/vendor/humation.js:', e.message || e, '→ probando esm.sh');
        return Promise.all([
          import('https://esm.sh/@humation/core@1.0.3'),
          import('https://esm.sh/@humation/assets-humation-1@1.0.3'),
        ]).then(([core, assets]) => ({ createAvatar: core.createAvatar, createPartPreview: core.createPartPreview, getPartsForSlot: core.getPartsForSlot, humation1: assets.humation1 }));
      })
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

// Estado inicial del creador: el avatar por defecto de esa semilla
// ({ selections, colors, background }), para empezar desde el que ya tienes
export async function defaultAvatarState(seed) {
  const m = await preloadHumation();
  if (!m) return null;
  const key = String(seed || 'user').trim().toLowerCase();
  const j = m.createAvatar(m.humation1, { seed: key, background: BG[hash(key) % BG.length] }).toJSON();
  return { selections: j.selections, colors: j.colors, background: j.background };
}
