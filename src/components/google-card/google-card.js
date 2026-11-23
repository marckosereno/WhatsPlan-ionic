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

let cfgP = null;
function getCfg() {
  if (!cfgP) cfgP = fetch('/api/config').then((r) => r.json()).then((c) => ({ key: c.googleBrowserKey || '', mini: !!c.googleMini, live: !!c.googleLive })).catch(() => ({ key: '', mini: false, live: false }));
  return cfgP;
}
const getKey = async () => (await getCfg()).key;
// Con GOOGLE_LIVE=1 se usa foto + descripción propias (API en vivo) y las tarjetas del UI Kit se apagan
export async function googleMiniReady() { const c = await getCfg(); return !!(c.key && c.mini && !c.live); }
export async function googleCardReady() { const c = await getCfg(); return !!(c.key && !c.live); }
export async function googleLiveReady() { return !!(await getCfg()).live; }

// Foto y/o descripción de Google pedidas en vivo (se paga por llamada; no se guarda nada). Solo se recuerda en memoria
// mientras la app está abierta para no repetir la llamada al volver a abrir el mismo lugar.
const _live = new Map();
export function loadGoogleLive(place, parts = 'full') {
  const gid = googlePlaceId(place);
  if (!gid) return Promise.resolve(null);
  const key = `${gid}|${parts}`;
  if (_live.has(key)) return _live.get(key);
  const have = _live.get(`${gid}|photo`);
  const q = new URLSearchParams({ mode: 'google', gid, parts });
  const name = place.place_name || place.name; if (name) q.set('name', name);
  if (place.category) q.set('cat', place.category);
  const t0 = Date.now();
  const p = fetch(`/api/groq-description?${q}`)
    .then(async (r) => { const j = await r.json().catch(() => null); liveTag(`${parts} ${gid.slice(0, 10)}… HTTP ${r.status} ${Date.now() - t0}ms\n` + (j ? (j.error ? 'ERROR: ' + j.error : 'foto:' + (j.photo ? 'sí' : 'no') + ' desc:' + (j.description ? 'sí' : 'no') + (j.basedOn ? ' (' + j.basedOn + ' reseñas)' : '')) : 'sin JSON')); return r.ok ? j : null; })
    .catch((e) => { liveTag(`${parts} falló la petición: ${e?.message || e}`); return null; })
    .then((d) => { if (!d) _live.delete(key); return d; });
  _live.set(key, p);
  return p;
}

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

// Minimodal: dentro de la burbuja del pin, cambia foto+texto por la tarjeta COMPACTA de Google, pero solo cuando
// Google ya cargó (si tarda o falla, la burbuja de siempre se queda tal cual). `card` = .minicard-marker-content.
// Los dos primeros hijos de la burbuja son la foto y los textos; el último es la flechita (se conserva).
// Pruebas desde el celular (se guardan): ?gcori=vertical|horizontal  ?gcw=344 (ancho en px)  ?gctrunc=0|1  ?gcreset=1 las borra
function miniOpts() {
  const o = { ori: 'vertical', w: 200, trunc: true, rating: true };   // la vertical es la que dibuja la foto
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('gcreset') === '1') ['wpGcOri', 'wpGcW', 'wpGcTrunc', 'wpGcRating'].forEach((k) => localStorage.removeItem(k));
    if (q.get('gcori')) localStorage.setItem('wpGcOri', q.get('gcori'));
    if (q.get('gcw')) localStorage.setItem('wpGcW', q.get('gcw'));
    if (q.get('gctrunc')) localStorage.setItem('wpGcTrunc', q.get('gctrunc'));
    if (q.get('gcrating')) localStorage.setItem('wpGcRating', q.get('gcrating'));
    const ori = localStorage.getItem('wpGcOri'), w = parseInt(localStorage.getItem('wpGcW') || '', 10), t = localStorage.getItem('wpGcTrunc');
    if (ori === 'vertical' || ori === 'horizontal') o.ori = ori;
    if (w >= 100 && w <= 600) o.w = w;
    if (t === '0') o.trunc = false;
    if (localStorage.getItem('wpGcRating') === '1') o.rating = true;
  } catch (e) { /* sin almacenamiento: valores por defecto */ }
  return o;
}

export async function mountGoogleMini(card, place, isCurrent = () => true) {
  const pid = googlePlaceId(place);
  if (!pid || !(await googleMiniReady()) || !isCurrent()) return false;
  const key = await getKey();
  try {
    await loadPlacesLib(key);
    if (!isCurrent()) return false;
    const host = document.createElement('div');
    host.className = 'wp-mc-g';
    // Se monta VISIBLE pero transparente (opacity:0), no con visibility:hidden ni fuera de pantalla: las imágenes que
    // Google carga "perezosas" no se piden si el elemento está oculto o fuera de vista, y la foto quedaba sin salir.
    const mo = miniOpts();
    const WID = mo.w ? `min(${mo.w}px,calc(100vw - 16px))` : 'min(340px,86vw)';
    host.style.cssText = `flex:1;min-width:0;position:absolute;opacity:0;pointer-events:none;width:${WID};left:0;top:0;z-index:-1`;
    const el = document.createElement('gmp-place-details-compact');
    el.setAttribute('orientation', mo.ori);
    if (mo.trunc && mo.ori === 'horizontal') el.setAttribute('truncation-preferred', '');
    // Contenido mínimo, como la burbuja de WhatsPlan: foto y nombre (+ la atribución de Google, que no se quita). Calificación solo con ?gcrating=1 (lightbox-preferred como en el ejemplo oficial; el toque en la tarjeta abre la ficha)
    el.innerHTML = `<gmp-place-details-place-request place="${esc(pid)}"></gmp-place-details-place-request>
      <gmp-place-content-config>
        <gmp-place-media></gmp-place-media>
        ${mo.rating ? '<gmp-place-rating></gmp-place-rating>' : ''}
        <gmp-place-attribution light-scheme-color="gray" dark-scheme-color="white"></gmp-place-attribution>
      </gmp-place-content-config>`;
    host.appendChild(el);
    card.appendChild(host);
    let done = false;
    const swap = () => {
      if (done || !isCurrent() || !card.isConnected) return;
      if (el.offsetHeight < 30) return;              // aún vacío: no cambiar
      done = true;
      // Se ve NATIVA: la burbuja de WhatsPlan se vuelve un contenedor sin fondo, borde, relleno ni flechita,
      // y la tarjeta de Google ocupa todo el ancho (hasta 340 px) con su propio fondo blanco y esquinas
      [...card.children].forEach((c) => { if (c !== host) c.style.display = 'none'; });
      card.style.cssText += ';display:block;padding:0;gap:0;background:transparent;border:0;box-shadow:none;' +
        '-webkit-backdrop-filter:none;backdrop-filter:none;max-width:none;min-width:0;border-radius:28px;overflow:visible;' +
        'filter:drop-shadow(0 8px 20px rgba(0,0,0,0.20))';
      host.style.cssText = `position:relative;width:${WID};max-width:none;min-width:0`;
      el.style.cssText += ';width:100%;border-radius:28px;' +
        '--gmp-mat-color-surface:#fff;--gmp-mat-color-outline-decorative:transparent;--gmp-mat-font-family:var(--wp-font,inherit)';
      // La tarjeta es más alta que la burbuja de antes: se sube para que su borde inferior quede justo arriba del
      // punto del pin (antes lo tapaba), el puntito negro baja a ese punto y se dibuja una colita blanca
      const wrapper = card.parentElement;
      requestAnimationFrame(() => {
        if (!wrapper || !card.isConnected) return;
        const H = card.offsetHeight;
        if (H < 30) return;
        wrapper.style.marginTop = `-${Math.round(H / 2 + 14)}px`;
        card.dispatchEvent(new CustomEvent('wp-mc-resized', { detail: { H } }));   // el mapa baja el pin para que la tarjeta alta no tape la barra de arriba
        const dot = wrapper.querySelector('.wp-mc-shadow-dot');
        if (dot) dot.style.top = `calc(50% + ${Math.round(H / 2 + 14)}px)`;
        card.style.position = 'relative';
        // Si la tarjeta (más ancha que la burbuja de antes) se sale de la pantalla, se corre para que quepa entera
        // (la foto de la compacta horizontal queda en un extremo y se perdía fuera de la pantalla); la colita sigue al pin
        const vw = window.innerWidth, r = card.getBoundingClientRect();
        let shift = 0;
        if (r.right > vw - 8) shift = vw - 8 - r.right;
        if (r.left + shift < 8) shift = 8 - r.left;
        if (shift) card.style.left = `${Math.round(shift)}px`;
        if (!card.querySelector('.wp-mc-tail')) {
          const tail = document.createElement('i');
          tail.className = 'wp-mc-tail';
          tail.style.cssText = 'position:absolute;left:calc(50% - ' + Math.round(shift) + 'px);bottom:-9px;transform:translateX(-50%);width:0;height:0;' +
            'border-left:10px solid transparent;border-right:10px solid transparent;border-top:10px solid #fff;pointer-events:none';
          card.appendChild(tail);
        }
      });
    };
    el.addEventListener('gmp-load', () => setTimeout(swap, 700));   // da tiempo a que llegue la foto antes de mostrarla
    el.addEventListener('gmp-error', () => host.remove());
    setTimeout(swap, 2500);                           // por si el evento no llega pero ya se dibujó
    setTimeout(() => { if (!done) host.remove(); }, 6000);
    gcDebug(el, pid, mo);
    return true;
  } catch (e) { console.warn('[GoogleMini]', e); return false; }
}


// Diagnóstico opcional del minimodal: abrir la app con ?gcdebug=1 (queda guardado) y se ve una etiqueta con lo que
// dibujó Google y el estado de sus peticiones de foto (403 = llave sin permiso; 200 = sí llegó). ?gcdebug=0 lo apaga.
function gcDebug(el, pid, mo) {
  try {
    const q = new URLSearchParams(location.search).get('gcdebug');
    if (q === '1') localStorage.setItem('wpGcDebug', '1');
    if (q === '0') localStorage.removeItem('wpGcDebug');
    if (localStorage.getItem('wpGcDebug') !== '1') return;
    const tag = document.createElement('div');
    tag.style.cssText = 'position:fixed;left:6px;right:6px;bottom:90px;z-index:99999;' +
      'background:rgba(0,0,0,.82);color:#9f9;font:11px/1.35 monospace;padding:6px 8px;border-radius:8px;pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(tag);
    const ev = [];
    el.addEventListener('gmp-load', () => ev.push('load'));
    el.addEventListener('gmp-error', (e) => ev.push('ERROR ' + (e?.error?.message || e?.message || '')));
    setTimeout(() => {
      const media = el.querySelector('gmp-place-media');
      const sr = el.shadowRoot, msr = media?.shadowRoot;
      const imgs = (sr ? sr.querySelectorAll('img').length : -1) + '/' + (msr ? msr.querySelectorAll('img').length : -1);
      const res = performance.getEntriesByType('resource')
        .filter((r) => /places\.googleapis|googleusercontent|gstatic.*photo|maps\.googleapis/.test(r.name))
        .slice(-4).map((r) => (r.responseStatus || '?') + ' ' + r.name.replace(/^https?:\/\//, '').slice(0, 58));
      tag.textContent = 'gc ' + pid.slice(0, 12) + ' ' + mo.ori + (mo.w ? ' w' + mo.w : '') + (mo.trunc ? '' : ' sintrunc') + (mo.rating ? ' rating' : '') + ' | ev: ' + (ev.join(',') || 'ninguno') + ' | h=' + el.offsetHeight +
        ' w=' + el.offsetWidth + ' | img(el/media)=' + imgs + ' | rect=' + Math.round(el.getBoundingClientRect().left) + '..' + Math.round(el.getBoundingClientRect().right) + ' de ' + innerWidth +
        '\n' + (res.join('\n') || 'sin peticiones a Google');
      setTimeout(() => tag.remove(), 15000);
    }, 3500);
  } catch (e) { /* diagnóstico: nunca debe romper */ }
}


// Con ?gcdebug=1: etiqueta con el resultado de cada petición de Google en vivo (si hay foto/descripción o el error)
function liveTag(msg) {
  try {
    if (localStorage.getItem('wpGcDebug') !== '1') return;
    const tag = document.createElement('div');
    tag.style.cssText = 'position:fixed;left:6px;right:6px;top:calc(env(safe-area-inset-top) + 70px);z-index:99999;background:rgba(0,0,0,.82);color:#ff9;font:11px/1.35 monospace;padding:6px 8px;border-radius:8px;pointer-events:none;white-space:pre-wrap';
    tag.textContent = 'live ' + msg;
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 12000);
  } catch (e) { /* diagnóstico */ }
}
