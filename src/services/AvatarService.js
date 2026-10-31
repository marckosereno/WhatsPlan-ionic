// ====================================================================
// WHATSPLAN — AvatarService.js
// Avatar por defecto (quien no ha subido foto): ilustración de Humation
// (línea negra, fondo pastel; MIT — https://github.com/humation-labs/humation).
// Se genera EN EL TELÉFONO desde el nombre: el mismo nombre siempre da el
// mismo avatar. Ya no depende de Tapback (internet externo).
//
// La librería se precarga al iniciar la app (app.js → preloadHumation).
// Si alguien pide un avatar antes de que cargue, recibe una silueta
// sencilla del mismo estilo (no se ve un hueco).
// ====================================================================
import { defaultAvatarSync, preloadHumation } from '/src/utils/humation-avatar.js';

// Silueta de respaldo (mientras carga la librería): cabeza de línea negra
// sobre crema. Pequeña y del mismo estilo que Humation.
const FALLBACK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" fill="#FFF1C9"/>' +
  '<circle cx="44" cy="38" r="15" fill="#fff" stroke="#000" stroke-width="3.5"/>' +
  '<path d="M18 88c2-17 12-27 26-27s24 10 26 27" fill="#fff" stroke="#000" stroke-width="3.5" stroke-linecap="round"/></svg>'
).replace(/'/g, '%27');

preloadHumation();

/**
 * Avatar por defecto para un nombre (siempre el mismo para el mismo nombre).
 * Devuelve un data URI (SVG); sirve en <img src> y en background-image.
 */
export function getAvatarUrl(fullName) {
  return defaultAvatarSync(fullName || 'user') || FALLBACK;
}

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
