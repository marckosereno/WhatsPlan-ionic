// ====================================================================
// WHATSPLAN — AvatarService.js
// Avatar por defecto (quien no ha subido foto): ilustración de Humation
// (línea negra, fondo pastel; MIT — https://github.com/humation-labs/humation).
// Se genera EN EL TELÉFONO desde el nombre: el mismo nombre siempre da el
// mismo avatar. Ya no depende de Tapback (internet externo).
//
// La librería (src/vendor/humation.js) se carga aparte al iniciar. Si
// alguien pide un avatar antes, recibe una silueta que lleva el nombre
// "escondido"; cuando la librería termina de cargar, TODAS esas siluetas
// que estén en pantalla se cambian solas por su avatar.
// ====================================================================
import { defaultAvatarSync, preloadHumation } from '/src/utils/humation-avatar.js';

const SEED_TAG = 'wpseed:';
const fallbackFor = (name) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><!--${SEED_TAG}${String(name).replace(/--/g, '-')}:end-->` +
  '<rect width="88" height="88" fill="#FFF1C9"/>' +
  '<circle cx="44" cy="38" r="15" fill="#fff" stroke="#000" stroke-width="3.5"/>' +
  '<path d="M18 88c2-17 12-27 26-27s24 10 26 27" fill="#fff" stroke="#000" stroke-width="3.5" stroke-linecap="round"/></svg>'
).replace(/'/g, '%27');

let fallbacks = 0;

/**
 * Avatar por defecto para un nombre (siempre el mismo para el mismo nombre).
 * Devuelve un data URI (SVG); sirve en <img src> y en background-image.
 */
export function getAvatarUrl(fullName) {
  const name = fullName || 'user';
  const uri = defaultAvatarSync(name);
  if (uri) return uri;
  fallbacks++;
  return fallbackFor(name);
}

// Al cargar la librería: cambia las siluetas que ya están en pantalla
const TAG_ENC = encodeURIComponent(SEED_TAG);
const seedOf = (s) => {
  const i = s.indexOf(TAG_ENC); if (i < 0) return null;
  const j = s.indexOf(encodeURIComponent(':end'), i);
  try { return decodeURIComponent(s.slice(i + TAG_ENC.length, j)); } catch (_) { return null; }
};
function upgradeOnScreen() {
  let n = 0;
  document.querySelectorAll('img[src^="data:image/svg+xml"]').forEach(img => {
    const seed = seedOf(img.getAttribute('src') || '');
    const uri = seed && defaultAvatarSync(seed);
    if (uri) { img.src = uri; n++; }
  });
  document.querySelectorAll('[style*="data:image/svg+xml"]').forEach(el => {
    const bg = el.style.backgroundImage || '';
    const seed = seedOf(bg);
    const uri = seed && defaultAvatarSync(seed);
    if (uri) { el.style.backgroundImage = `url('${uri}')`; n++; }
  });
  console.log(`[DIAG-AVATAR] Humation listo · siluetas pedidas antes: ${fallbacks} · cambiadas en pantalla: ${n}`);
}
document.addEventListener('wp:humation-ready', upgradeOnScreen, { once: true });
const t0 = performance.now();
preloadHumation().then(m => console.log(m ? `[DIAG-AVATAR] librería cargada en ${Math.round(performance.now() - t0)} ms` : '[DIAG-AVATAR] la librería NO cargó (revisa src/vendor/humation.js)'));

// ¿Es un avatar viejo de Tapback guardado en el perfil? (ya no se usa)
export const isLegacyAvatar = (url) => typeof url === 'string' && url.includes('tapback.co');

/**
 * Avatar de un usuario autenticado:
 * - Si tiene foto real (subida / Google) → esa.
 * - Si no (o tenía un Memoji de Tapback) → el de Humation, que NO se
 *   guarda en la base de datos (se genera cada vez, es instantáneo).
 */
export function getOrGenerateAvatar(displayName, existingAvatarUrl) {
  if (existingAvatarUrl && !isLegacyAvatar(existingAvatarUrl)) {
    return { url: existingAvatarUrl, isNew: false };
  }
  return { url: getAvatarUrl(displayName), isNew: false };
}
