// ═════════════════════════════════════════════════
// WHATSPLAN — google-card/google-card.js
// "Fotos y reseñas de Google" con el Places UI Kit oficial (<gmp-place-details>).
// Google dibuja la tarjeta en el celular del usuario: WhatsPlan NO guarda fotos, reseñas ni horarios de
// Google (solo el place_id, que sí se puede guardar). Se cobra una solicitud cada vez que se abre, por eso
// solo carga cuando la persona toca el botón. La atribución de Google viene incluida: no se esconde.
//
// Apagado por defecto: si /api/config no trae googleBrowserKey, canShowGoogleCard() es false.
//
// Uso:
//   await googleCardReady()            → true si hay llave (se pide una sola vez)
//   isGooglePlaceId(place)             → true si el lugar tiene place_id de Google (ChIJ…)
//   openGoogleCard(place)              → abre la hoja con la tarjeta de Google
// Estilos: /styles/google-card.css
// ═════════════════════════════════════════════════
import { openSheetPage } from '/src/components/place-plans/step-sheet.js';
import { ensureCss } from '/src/components/tabs/tab-screen.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let keyP = null;
function getKey() {
  if (!keyP) keyP = fetch('/api/config').then((r) => r.json()).then((c) => c.googleBrowserKey || '').catch(() => '');
  return keyP;
}
export async function googleCardReady() { return !!(await getKey()); }

// Lugares de Google traen su ID en place_id; los de DENUE lo traen ligado en googlePlaceId (SQL 49)
export function googlePlaceId(place) {
  for (const v of [place?.googlePlaceId, place?.google_place_id, place?.place_id, place?.placeId, place?.gid]) {
    const id = String(v || '');
    if (/^ChIJ[\w-]{10,}$/.test(id)) return id;
  }
  return '';
}
export const isGooglePlaceId = (place) => !!googlePlaceId(place);

// Carga de Google con el "inline bootstrap loader" oficial (Google pide este método para el Places UI Kit)
let libP = null;
function loadPlacesLib(key) {
  if (libP) return libP;
  libP = (async () => {
    if (!window.google?.maps?.importLibrary) {
      ((g) => { var h, a, k, p = 'The Google Maps JavaScript API', c = 'google', l = 'importLibrary', q = '__ib__', m = document, b = window;
        b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
        u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement('script'));
          e.set('libraries', [...r] + '');
          for (k in g) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), g[k]);
          e.set('callback', c + '.maps.' + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f; a.onerror = () => (h = n(Error(p + ' could not load.'))); a.nonce = m.querySelector('script[nonce]')?.nonce || ''; m.head.append(a); }));
        d[l] ? console.warn(p + ' only loads once. Ignoring:', g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
      })({ key, v: 'weekly', language: 'es' });
    }
    return window.google.maps.importLibrary('places');
  })().catch((e) => { libP = null; throw e; });
  return libP;
}

// Monta la tarjeta de Google dentro de un contenedor (la ficha). Devuelve true si la montó.
// isCurrent() permite cancelar si la persona ya cambió de lugar mientras cargaba Google.
export async function mountGoogleCard(box, place, isCurrent = () => true) {
  const pid = googlePlaceId(place);
  const key = pid ? await getKey() : '';
  if (!pid || !key || !isCurrent()) return false;
  ensureCss('wp-gcard-css', '/styles/google-card.css');
  box.innerHTML = '<div class="wp-gc-skel"><i></i><i></i><i></i></div>';
  try {
    await loadPlacesLib(key);
    if (!isCurrent()) return false;
    const el = document.createElement('gmp-place-details');
    el.innerHTML = `<gmp-place-details-place-request place="${esc(pid)}"></gmp-place-details-place-request><gmp-place-all-content></gmp-place-all-content>`;
    el.addEventListener('gmp-error', () => { if (isCurrent()) box.innerHTML = '<div class="wp-gc-load">Google no tiene más datos de este lugar.</div>'; });
    box.innerHTML = '';
    box.appendChild(el);
    return true;
  } catch (e) {
    console.warn('[GoogleCard]', e);
    if (isCurrent()) box.innerHTML = '<div class="wp-gc-load">No se pudo cargar lo de Google.</div>';
    return false;
  }
}

export async function openGoogleCard(place) {
  if (!googlePlaceId(place) || !(await getKey())) return null;
  ensureCss('wp-tokens-css', '/styles/tokens.css');
  ensureCss('wp-pm2-steps-css', '/styles/plan-steps.css');
  const name = place.name || place.displayName || 'Este lugar';
  const sheet = openSheetPage({
    title: 'Fotos y reseñas',
    html: `<div class="wp-gc"><h2>${esc(name)}</h2><p class="wp-gc-note">Esta información viene de Google y se muestra tal cual. WhatsPlan no la guarda.</p><div class="wp-gc-box"></div></div>`,
    theme: 'explore',
  });
  setTimeout(() => sheet.relayout(), 150);
  await mountGoogleCard(sheet.root.querySelector('.wp-gc-box'), place);
  return sheet;
}
