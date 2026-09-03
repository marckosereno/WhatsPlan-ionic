import { animateMinicardIn, animateMinicardOut } from '/src/utils/animations.js';
// ====================================================================
// WHATSPLAN — MapView.js
// Mapa Carto Positron + Blink Light + pins + labels + landmarks
// ====================================================================

import { ActivityService } from '/src/services/SupabaseService.js';
import { LandmarkService, CustomPlaceService } from '/src/services/SuperUserService.js';
import { getSubcategoriesMap } from '/src/services/CategoryService.js';

const CENTER_LNG = -97.9504;
const CENTER_LAT =  26.0520;
const ZOOM       = 15;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const BL_BG       = '#f0ece0';
const BL_LAND     = '#f0ece0';
const BL_WATER    = '#3b82f6';  // azul cielo vibrante
const BL_PARK     = '#5cb85c';  // verde juego saturado
const BL_BUILDING = '#ddd8cc';  // edificios más visibles
const BL_TEXT     = '#2d2d2d';
const BL_HALO     = 'rgba(240,237,230,0.98)';
const BENITO_LINE = '#7c6ef7';
const BENITO_TEXT = '#5a4fcf';

// CATEGORIES se carga dinámicamente desde Supabase via app.js
// Fallback mínimo por si no hay conexión
const CATEGORIES = {
  RESTAURANTS:   { icon: '🍔',  icon3d: null },
  HEALTH:        { icon: '🩺',  icon3d: null },
  SHOPPING:      { icon: '🛍️', icon3d: null },
  ENTERTAINMENT: { icon: '🎈',  icon3d: null },
  PARKS:         { icon: '🌵',  icon3d: null },
  WORKSHOPS:     { icon: '🔧',  icon3d: null },
};

// ── Buscar icon3d de la SUBCATEGORÍA del place (fallback si no hay foto) ──
// ── Caché de subcategorías (dinámico desde Supabase) ────────────────
let _subcatsMapCache   = null;
let _subcatsMapPromise = null;
function _ensureSubcatsLoaded() {
  if (_subcatsMapPromise) return _subcatsMapPromise;
  _subcatsMapPromise = getSubcategoriesMap()
    .then(map => { _subcatsMapCache = map; return map; })
    .catch(e => {
      console.warn('⚠️ subcategorías:', e.message);
      _subcatsMapCache   = {};
      _subcatsMapPromise = null; // permitir reintento (ej: Supabase aún no inicializado)
      return {};
    });
  return _subcatsMapPromise;
}
// NOTA: no se dispara aquí — se dispara desde loadCategory(), cuando Supabase
// ya está garantizado inicializado. Disparar al importar el módulo fallaría
// porque MapView.js se importa antes de que app.js llame initSupabase().

// Llamar después de crear/editar/eliminar subcategorías en SuperUserPanel
export function refreshSubcatsCache() {
  _subcatsMapCache   = null;
  _subcatsMapPromise = null;
  return _ensureSubcatsLoaded();
}

function getSubcatIcon3d(place, catId) {
  const list = (_subcatsMapCache || {})[catId];
  if (!list || !place) return null;
  let tags = place.subcategoryTags || place.subcategory_tags || '';
  if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (!Array.isArray(tags) || !tags.length) return null;
  for (const tag of tags) {
    const found = list.find(s => s.value.toLowerCase() === String(tag).toLowerCase());
    if (found && found.icon3d) return found.icon3d;
  }
  return null;
}

function buildIconHtml(icon3dUrl, fallbackEmoji, size = 20) {
  if (icon3dUrl) {
    return `<img src="${icon3dUrl}" style="width:${size}px;height:${size}px;object-fit:contain;" onerror="this.outerHTML='<span style=&quot;font-size:${Math.round(size*0.9)}px&quot;>${fallbackEmoji}</span>'">`;
  }
  return fallbackEmoji || '💎';
}

// ── Supabase resize ──────────────────────────────────────────────────
function supabaseResize(url, width = 80, quality = 75, mode = 'contain') {
  if (!url || !url.includes('supabase.co')) return url;
  if (url.includes('/render/image/')) return url;
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + `?width=${width}&quality=${quality}&resize=${mode}`;
}

function proxyPhoto(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('supabase.co')) return supabaseResize(url, 80, 75, 'contain');
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

// ── Proxy de mayor resolución para el minicard (44px CSS → necesita más detalle) ──
function proxyPhotoCard(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('supabase.co')) return supabaseResize(url, 120, 85, 'contain');
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

// ── Proxy para las tarjetas del cluster — bastante más grande que el pin
// individual (80px) porque acá cada tarjeta puede llegar a mostrarse a
// ~90-100px, y encima el pellizco del editor las escala hasta 2.2x más
// (~200px reales en pantalla) — con la resolución del pin normal se
// vería borroso. El costo de pedir una imagen más grande a Supabase es
// marginal (es solo bandwidth, no cómputo extra relevante).
//
// Importante: se mantiene 'contain' (el mismo modo que ya usaba
// proxyPhoto) — probé pasar a 'cover' para que coincida con el
// background-size:cover de la tarjeta, pero supabaseResize() solo manda
// `width` sin `height`, y 'cover' sin las dos dimensiones hace que
// Supabase recorte la imagen server-side con un criterio propio (quedó
// más "pegada"/recortada que antes). 'contain' escala proporcional sin
// recortar nada — el recorte final a la forma de la tarjeta lo sigue
// haciendo el CSS (background-size:cover) como siempre, así que el
// encuadre queda igual que antes, solo con más resolución.
function proxyPhotoCluster(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  // (Se probó bajar a 110/62 durante el diagnóstico del freeze de drag —
  // no era costo de raster/decode, la causa era el rebuild completo de
  // clusters en cada moveend, ya resuelto por reconciliación en
  // _updateClusters(). Revertido a la resolución original.)
  if (url.includes('supabase.co')) return supabaseResize(url, 220, 85, 'contain');
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

// ── Fade-in de foto en pin ───────────────────────────────────────────
function applyPhotoToPin(photoUrl, el) {
  const pi = el.querySelector('.pin-inner');
  if (!pi || pi.classList.contains('loaded')) return;
  pi.style.background = `url('${photoUrl}') center/cover no-repeat`;
  pi.innerHTML        = '';
  pi.classList.remove('loading');
  pi.classList.add('loaded');
  // No mostrar la foto si el marcador está en modo punto (state 1) —
  // el wrapper tiene overflow:hidden y opacity:0 en pi, respetarlo
  const markerEl = el.closest('.place-marker-el') || el;
  if (markerEl._wpState === 1) {
    pi.style.opacity = '0';
  } else {
    pi.style.opacity = '0';
    requestAnimationFrame(() => { pi.style.opacity = '1'; });
  }
}

function applyErrorToPin(el) {
  const pi = el.querySelector('.pin-inner');
  if (!pi) return;
  pi.classList.remove('loading');
  pi.style.background = 'transparent';
}

// ── Minicard: si la foto falla, reemplazar con ícono (subcategoría > emoji) ──
// Usa DOM APIs reales — evita anidar comillas/backticks en strings HTML.
window._wpMcImgError = function(imgEl) {
  const wrap = imgEl.parentNode;
  if (!wrap) return;
  const icon3d = imgEl.getAttribute('data-fb-icon') || '';
  const emoji  = imgEl.getAttribute('data-fb-emoji') || '💎';
  const bg     = imgEl.getAttribute('data-fb-bg') || 'rgba(0,0,0,0.05)';
  wrap.style.animation = 'none';
  wrap.style.background = bg;
  wrap.innerHTML = '';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  if (icon3d) {
    const img = document.createElement('img');
    img.src = icon3d;
    img.style.width = '26px'; img.style.height = '26px'; img.style.objectFit = 'contain';
    img.onerror = function() { wrap.textContent = emoji; wrap.style.fontSize = '22px'; };
    wrap.appendChild(img);
  } else {
    wrap.textContent = emoji;
    wrap.style.fontSize = '22px';
  }
};

// ── Estilos de animación landmarks ──────────────────────────────────
function injectLandmarkStyles() {
  if (document.getElementById('lm-styles')) return;
  const s = document.createElement('style');
  s.id = 'lm-styles';
  s.textContent = `
    @keyframes lmFloat {
      0%,100% { transform: translateY(0px); }
      50%      { transform: translateY(-5px); }
    }
    @keyframes lmPulse {
      0%,100% { transform: scaleX(1);    opacity: 0.3; }
      50%      { transform: scaleX(0.75); opacity: 0.15; }
    }
    @keyframes wp-mc-skeleton {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .lm-wrap        { display:flex;flex-direction:column;align-items:center;cursor:pointer;overflow:visible; }
    .lm-inner       { animation:lmFloat 3s ease-in-out infinite;display:flex;flex-direction:column;align-items:center; }
    .lm-inner-slow  { animation:lmFloat 2.6s ease-in-out infinite;display:flex;flex-direction:column;align-items:center; }
    .lm-shadow      { animation:lmPulse 3s ease-in-out infinite;border-radius:50%;background:rgba(0,0,0,0.3); }
    .lm-shadow-slow { animation:lmPulse 2.6s ease-in-out infinite;border-radius:50%;background:rgba(0,0,0,0.25); }
    body.map-dragging .lm-inner,
    body.map-dragging .lm-inner-slow,
    body.map-dragging .lm-shadow,
    body.map-dragging .lm-shadow-slow { animation-play-state:paused; }

    /* ── Animación al hacer drag en el mapa ──────────────────────────
       Reintroducido tras resolver el freeze de clusters (esa causa era
       el rebuild completo de clusters en cada moveend — el parallax no
       tenía nada que ver). Esta vez el JS escribe transform DIRECTO
       en el estilo inline de cada .place-pin-root visible (ver
       _applyPinParallax en el bloque de 'drag' del mapa) — compositor-only,
       nada de CSS custom properties en :root/<html> (eso forzaba
       recálculo de estilo en TODOS los pines, 6-10ms/frame, la causa
       real del "barrido" viejo). Esta transición es la que anima el
       REGRESO suave a 0 cuando el drag termina y el JS limpia el transform. */
    /* MapLibre pone touch-action:none en .maplibregl-canvas-container, pero
       los markers son HIJOS de ese contenedor y touch-action NO se hereda:
       se resuelve sobre el elemento que recibe el toque. Un marker sin
       touch-action propio queda en 'auto', así que cuando el gesto ARRANCA
       encima de uno, el navegador se reserva el gesto para su scroll/zoom
       nativo y retiene los touchmove antes de entregárselos al JS.
       MapLibre escucha touchmove con {passive:false} justo para poder
       llamar preventDefault() y quedarse con el gesto — pero ese
       preventDefault llega tarde si el navegador ya decidió, así que el
       mapa no paneá hasta soltar y volver a tocar desde otro punto.
       Con touch-action:none el navegador entrega el gesto al JS de
       inmediato y el drag arranca igual que sobre el canvas. */
    .maplibregl-marker {
      touch-action: none;
    }

    .place-marker-el > * {
      transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1);
    }
    /* Durante el drag la transición se APAGA. El parallax escribe un
       transform nuevo en cada frame; con la transición activa, cada una
       de esas escrituras arranca una animación de 0.32s por pin — en el
       primer frame del drag eso son cientos de transiciones largas
       disparadas de golpe. Justo después de un zoom-out hay muchos más
       pines en pantalla que de costumbre, y ahí el arranque del gesto se
       traba: el drag "no engancha" hasta soltar y volver a tocar.
       La transición sigue existiendo para lo único que se la quería: el
       regreso suave a 0 al soltar, cuando esta clase ya se removió. */
    body.map-dragging .place-marker-el > * {
      transition: none;
      will-change: transform; /* hint de compositor solo mientras se usa */
    }

    /* ── Transición FLIP: sticker de cluster → pantalla collage ────────
       .wp-ce-flip-piece son los CLONES reales de las tarjetas/stickers
       del mapa — arrancan en position:fixed con las coordenadas exactas
       de pantalla que tenían como sticker, y JS les anima left/top/width/
       height/transform hasta su lugar en el collage. Por eso NO llevan
       transición acá (se las pone JS recién en el segundo frame, así el
       navegador pinta primero el punto de partida). */
    .wp-ce-flip-piece { pointer-events: auto; }

    .wp-ce-collage { background: transparent; }
    .wp-ce-collage-bg {
      position: absolute; inset: 0; background: #fff;
      opacity: 0; transition: opacity 0.38s ease-out;
    }
    .wp-ce-collage.wp-ce-in .wp-ce-collage-bg { opacity: 1; }

    .wp-ce-collage-header {
      position: relative; z-index: 2; flex-shrink: 0;
      display: flex; align-items: center;
      padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px;
      opacity: 0; transform: translateY(-10px);
      transition: opacity 0.38s cubic-bezier(0.34,1.56,0.64,1), transform 0.38s cubic-bezier(0.34,1.56,0.64,1);
    }
    .wp-ce-collage.wp-ce-chrome-in .wp-ce-collage-header { opacity: 1; transform: translateY(0); }
    .wp-ce-cback, .wp-ce-cbtn {
      width: 40px; height: 40px; border-radius: 9999px; border: none; flex-shrink: 0;
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(16px) saturate(1.8); -webkit-backdrop-filter: blur(16px) saturate(1.8);
      box-shadow: 0 4px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9);
      color: #111; display: flex; align-items: center; justify-content: center;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: transform 0.15s;
    }
    .wp-ce-cback:active, .wp-ce-cbtn:active { transform: scale(0.92); }
    .wp-ce-ctitle {
      margin-left: 12px; flex: 1 1 auto; min-width: 0;
      font-family: 'Inter Tight', system-ui, sans-serif;
      font-size: 15px; font-weight: 800; color: #111; letter-spacing: -0.2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .wp-ce-cactions { margin-left: auto; display: flex; align-items: center; gap: 8px; }

    .wp-ce-cstage { position: relative; z-index: 1; flex: 1; }

    .wp-ce-ccaption {
      position: relative; z-index: 2; flex-shrink: 0;
      padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 18px);
      opacity: 0; transform: translateY(10px);
      transition: opacity 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.05s, transform 0.38s cubic-bezier(0.34,1.56,0.64,1) 0.05s;
    }
    .wp-ce-collage.wp-ce-chrome-in .wp-ce-ccaption { opacity: 1; transform: translateY(0); }
    .wp-ce-ccaption-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .wp-ce-ctag {
      font-family: 'Inter Tight', system-ui, sans-serif;
      font-size: 12.5px; font-weight: 700; color: #374151;
      background: #f3f4f6; border: none; border-radius: 999px; padding: 7px 13px;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
      transition: background 0.22s ease, color 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
    }
    .wp-ce-ctag:active { transform: scale(0.94); }
    /* Chip activo: el lugar sobre el que está posicionado el drag/parallax
       en este momento — mismo azul que el resto de la marca. */
    .wp-ce-ctag.wp-ce-ctag-active { background: #1a5cf5; color: #fff; }

    /* ── Editor de posiciones (SuperUser) ─────────────────────────────── */
    .wp-ce-cedit { color: #1a5cf5; }
    .wp-ce-editing .wp-ce-cstage { cursor: crosshair; }
    .wp-ce-editpanel {
      position: fixed; left: 12px; right: 12px;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
      z-index: 100050; /* por encima de todos los clones (100000+60 como máximo) */
      background: rgba(20,20,26,0.92); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
      border-radius: 18px; padding: 14px 16px;
      opacity: 0; transform: translateY(14px);
      transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none;
      /* Con más controles (color, stroke, capas, "aplicar a todas") el
         panel había crecido lo bastante como para taparse con las
         tarjetas detrás. Vuelve al tamaño que tenía antes — lo que no
         entra, scrollea adentro del panel en vez de estirarlo. */
      max-height: min(280px, 40vh);
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.25) transparent;
    }
    .wp-ce-editpanel::-webkit-scrollbar { width: 5px; }
    .wp-ce-editpanel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 3px; }
    .wp-ce-editpanel:empty { display: none; }
    .wp-ce-editpanel.wp-ce-editpanel-in { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .wp-ce-edithint { color: #e5e7eb; font-size: 12px; font-weight: 600; margin-bottom: 10px; font-family: 'Inter Tight', system-ui, sans-serif; }
    .wp-ce-editslider {
      display: flex; align-items: center; gap: 10px; color: #9ca3af;
      font-size: 11.5px; font-weight: 700; margin-bottom: 8px;
      font-family: 'Inter Tight', system-ui, sans-serif;
    }
    .wp-ce-editslider input[type="range"] { flex: 1; accent-color: #1a5cf5; }
    .wp-ce-editrow { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .wp-ce-editbtn {
      flex: 1; min-width: 70px; padding: 9px; border-radius: 10px; border: none;
      background: rgba(255,255,255,0.1); color: #e5e7eb;
      font-size: 11.5px; font-weight: 700; font-family: 'Inter Tight', system-ui, sans-serif;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .wp-ce-editbtn-primary { background: #1a5cf5; color: #fff; }
    /* Fila compacta de 4 botones-ícono (capas + eliminar + listo) — ahorra
       una fila entera de alto respecto a tenerlos en dos filas de texto,
       para que el panel tape lo menos posible de las tarjetas detrás. */
    .wp-ce-editrow-compact .wp-ce-editbtn-icon { flex: 1; min-width: 0; padding: 8px 0; font-size: 15px; }
    .wp-ce-editbtn:disabled { opacity: 0.5; }

    /* ── Wrapper base compartido por la pantalla collage ─────────────── */
    .wp-ce-wrap {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; flex-direction: column;
      opacity: 0; transition: opacity 0.22s ease-out;
    }
    .wp-ce-wrap.wp-ce-in { opacity: 1; }
  `;
  document.head.appendChild(s);
}

// ====================================================================
export class MapView {
  constructor() {
    // CATEGORIES accesible como propiedad de instancia para que app.js pueda actualizarla
    this.CATEGORIES = {
      RESTAURANTS:   { icon: '🍔',  icon3d: null },
      HEALTH:        { icon: '🩺',  icon3d: null },
      SHOPPING:      { icon: '🛍️', icon3d: null },
      ENTERTAINMENT: { icon: '🎈',  icon3d: null },
      PARKS:         { icon: '🌵',  icon3d: null },
      WORKSHOPS:     { icon: '🔧',  icon3d: null },
    };
    this.map             = null;
    this.markers         = [];
    this.markerEls       = [];
    this.clusterMarkers  = []; // pines "amontonados" agrupados en un solo sticker
    this._clusterByKey   = new Map(); // clave estable → marker, para reutilizar en vez de reconstruir
    this.pinClusters     = null; // clusters personalizados (SuperUser) — null = aún no cargados
    this.onClusterCustomize = null; // callback (group, existingClusterOrNull) — lo asigna SuperUserPanel al hacer long-press
    // Mientras el panel de edición de cluster está abierto (y un instante
    // después de cerrarlo), ignorar cualquier pointerdown nuevo sobre un
    // cluster — si no, un toque residual justo cuando el panel se abre o
    // cierra (el dedo seguía "apoyado" en el mapa) podía interpretarse
    // como un nuevo long-press y volver a entrar en modo edición solo,
    // o dejar el drag del mapa "trabado" a mitad de camino.
    this._clusterModalOpen = false;
    this._cancelActiveClusterPress = null; // cancela un long-press de cluster pendiente si arranca un drag real del mapa
    this.allPlaces       = [];
    this.activities      = [];
    this.landmarkMarkers = [];
    this.currentCatId    = null;
    this.currentCatData  = null;
    this.miniCardMarker  = null;
    this.miniCardIndex   = -1;
    this.miniCardPlace   = null;
    this.onPlaceSelect   = null;
    this._labelTimers    = [];
    this._initMap();
  }

  // ── Haptic — igual que PWA original ─────────────────────────────
  haptic(type = 'tap') {
    if (!navigator.vibrate) return;
    const patterns = {
      tap: 15, select: 12, snap: 25,
      action: [30, 20, 60], longpress: [40, 30, 40], light: 10
    };
    navigator.vibrate(patterns[type] ?? type);
  }

  // ── Init mapa ────────────────────────────────────────────────────
  _initMap() {
    injectLandmarkStyles();

    this.map = new maplibregl.Map({
      container:             'map-container',
      style:                 MAP_STYLE,
      center:                [CENTER_LNG, CENTER_LAT],
      zoom:                  ZOOM,
      minZoom:               12,      // no alejarse demasiado
      maxZoom:               19,
      maxBounds:             [        // restricción a Nuevo Progreso ±18km
        [-98.1310, 25.9300],          // SW
        [-97.7702, 26.1900]           // NE
      ],
      attributionControl:    false,
      keyboard:              false,
      dragRotate:            false,
      pitchWithRotate:       false,
      pitch:                 0,
      renderWorldCopies:     false,   // sin copias del mundo
      maxTileCacheSize:      20,
      fadeDuration:          0,
      preserveDrawingBuffer: false,
    });

    // Set de markers (.maplibregl-marker) con un dedo apoyado ENCIMA en
    // este momento. _destroyClusterMarker() lo consulta antes de sacar un
    // marker del DOM: si tiene un toque activo, la eliminación física se
    // pospone hasta que ese toque termine.
    //
    // Por qué hace falta: si un marker se destruye (marker.remove()) con
    // un dedo TODAVÍA apoyado encima, el navegador dejaba de entregar los
    // touchmove/touchend de ESE dedo por completo (su elemento original ya
    // no existe). Ni el JS de acá ni el reconocedor de gestos interno de
    // MapLibre se enteraban de que el toque había terminado — MapLibre
    // quedaba pensando que había un dedo fantasma activo, y el próximo
    // toque real se interpretaba como "segundo dedo" en vez de inicio de
    // drag. Confirmado con una línea de tiempo real: un cluster se
    // destruye/recrea justo en el mismo instante en que el dedo lo está
    // tocando (por un zoom que cruza el umbral de disolución), y ahí
    // arranca un freeze de varios segundos hasta soltar y tocar en otro
    // punto donde no hay ningún elemento fantasma de por medio.
    this._activeTouchMarkerEls = new Set();
    this._pendingMarkerRemovals = new Set();
    const _recalcActiveTouchMarkers = (e) => {
      this._activeTouchMarkerEls.clear();
      if (e.touches) {
        for (const t of e.touches) {
          const m = t.target?.closest?.('.maplibregl-marker');
          if (m) this._activeTouchMarkerEls.add(m);
        }
      }
      // Si algún marker pendiente de eliminar ya no tiene ningún dedo
      // encima, recién ahora se saca físicamente del DOM.
      this._pendingMarkerRemovals.forEach(marker => {
        const el = marker.getElement?.();
        if (el && this._activeTouchMarkerEls.has(el)) return; // sigue tocado, esperar
        marker.remove();
        this._pendingMarkerRemovals.delete(marker);
      });
    };
    this.map.getContainer().addEventListener('touchstart',  _recalcActiveTouchMarkers, { capture: true, passive: true });
    this.map.getContainer().addEventListener('touchend',    _recalcActiveTouchMarkers, { capture: true, passive: true });
    this.map.getContainer().addEventListener('touchcancel', _recalcActiveTouchMarkers, { capture: true, passive: true });

    // [DEBUG temporal] línea de tiempo completa de gestos — para el
    // freeze de drag justo después de un zoomout que arranca sobre un
    // cluster. Saca la duda de si el drag arranca DURANTE la inercia del
    // zoom (touchstart antes de que zoomend dispare), y muestra en qué
    // momento exacto _updateClusters()/_updatePinsByZoom() corren en
    // relación a los eventos de touch/drag. Sacar todo este bloque una
    // vez identificada la causa.
    (() => {
      const t0 = performance.now();
      window._wpGestoT0 = t0; // compartido con _updateClusters()/_updatePinsByZoom()
      const log = (label) => console.log(`[GESTO] +${(performance.now()-t0).toFixed(0)}ms  ${label}`);
      ['touchstart','touchend','touchcancel'].forEach(ev => {
        this.map.getContainer().addEventListener(ev, (e) => {
          log(`container:${ev}  touches=${e.touches ? e.touches.length : '?'}  target=${e.target?.className || e.target?.tagName}`);
        }, { capture: true, passive: true });
      });
      ['zoomstart','zoomend','movestart','moveend','dragstart','dragend'].forEach(ev => {
        this.map.on(ev, () => log(`map:${ev}  zoom=${this.map.getZoom().toFixed(2)}`));
      });
      // 'zoom'/'move'/'drag' disparan por frame — con throttle, para no
      // inundar la consola, pero sin perder la foto de "seguía animando
      // cuando pasó tal cosa".
      let lastThrottled = 0;
      ['zoom','move','drag'].forEach(ev => {
        this.map.on(ev, () => {
          const now = performance.now();
          if (now - lastThrottled < 100) return;
          lastThrottled = now;
          log(`map:${ev}  zoom=${this.map.getZoom().toFixed(2)}`);
        });
      });
    })();

    this.map.on('load', () => {
      console.log('✅ Mapa listo');

      // Placeholder transparente para iconos del sprite no disponibles
      this.map.on('styleimagemissing', (e) => {
        try { this.map.addImage(e.id, { width:1, height:1, data:new Uint8Array(4) }); } catch(_) {}
      });



      // Restaurar mapa al volver a la app (evita pantalla en blanco)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('📱 App visible, refrescando mapa...');
          setTimeout(() => {
            try {
              this.map.resize();
              // Si hay una categoría seleccionada pero no hay marcadores, recargar
              if (this.currentCatId && this.markers.length === 0) {
                console.log('🔄 Recargando categoría tras pausa:', this.currentCatId);
                this.loadCategory(this.currentCatId);
              }
            } catch(e) { console.error('Error al redimensionar mapa:', e); }
          }, 300);
        }
      });
      this._applyBlinkLight();
      this._loadLandmarks();
      this._loadActivities();

      // Drag pause para animaciones
      // ── Parallax + achique de pines al arrastrar ──────────────────────
      // Reintroducido: la causa del freeze nunca fue esto (era el rebuild
      // de clusters en cada moveend, ya resuelto). Implementado BARATO a
      // propósito, aprendiendo del intento viejo (6-10ms/frame porque
      // escribía una CSS custom property en :root/<html>, forzando
      // recálculo de estilo en TODOS los pines): acá se escribe
      // `transform` DIRECTO en el inline style de cada `.place-pin-root`
      // VISIBLE — compositor-only, sin recálculo en cascada — y se
      // saltean los pines ocultos (agrupados en un cluster).
      //
      // El "lag" se logra proyectando un punto lngLat FIJO (el centro del
      // mapa al arrancar el drag) en cada frame: como ese punto no se
      // mueve en el mundo, su posición en pantalla se desplaza exactamente
      // lo mismo que se movió la cámara — es un delta de pantalla gratis,
      // sin trackear pointermove a mano.
      let _parallaxAnchor = null, _parallaxStartPx = null;
      const PARALLAX_LAG = 0.14;   // fracción del desplazamiento — sutil a propósito
      const PIN_SHRINK    = 0.97;  // achique MÍNIMO pedido — casi imperceptible
      const _applyPinParallax = (dx, dy) => {
        const t = `translate3d(${(-dx * PARALLAX_LAG).toFixed(1)}px,${(-dy * PARALLAX_LAG).toFixed(1)}px,0) scale(${PIN_SHRINK})`;
        for (const el of this.markerEls) {
          if (el.style.display === 'none') continue; // oculto por estar agrupado en un cluster
          if (el.style.visibility === 'hidden') continue; // no revelado aún por zoom — no vale gastar en él
          const root = el.firstElementChild; // siempre .place-pin-root — ver _buildPinHtml
          if (root) root.style.transform = t;
        }
      };
      const _clearPinParallax = () => {
        for (const el of this.markerEls) {
          const root = el.firstElementChild;
          if (root && root.style.transform) root.style.transform = '';
        }
      };
      this.map.on('dragstart', () => {
        document.body.classList.add('map-dragging');
        _parallaxAnchor = this.map.getCenter();
        _parallaxStartPx = this.map.project(_parallaxAnchor);
        // Si el drag del mapa arrancó justo encima de un sticker de
        // cluster, el pointermove local de ese elemento puede no llegar a
        // dispararse (MapLibre se queda con el gesto táctil primero) — el
        // timer de long-press quedaba corriendo igual y terminaba abriendo
        // el panel de personalización a mitad de un simple pan del mapa.
        // Esta es la señal confiable de "sí hay un drag real en curso".
        if (this._cancelActiveClusterPress) {
          this._cancelActiveClusterPress();
          this._cancelActiveClusterPress = null;
        }
      });
      // Red de seguridad extra: 'move' dispara en CUALQUIER movimiento de
      // cámara, incluso el primer frame — más rápido/confiable que
      // 'dragstart', que tiene su propio reconocimiento de gesto interno
      // y a veces "llega tarde" si el dedo se queda quieto un instante
      // antes de empezar a arrastrar (justo el momento en que el timer de
      // long-press de 550ms puede alcanzar a completarse primero).
      this.map.on('move', () => {
        if (this._cancelActiveClusterPress) {
          this._cancelActiveClusterPress();
          this._cancelActiveClusterPress = null;
        }
      });
      this.map.on('drag', () => {
        if (!_parallaxAnchor) return;
        const curPx = this.map.project(_parallaxAnchor);
        _applyPinParallax(curPx.x - _parallaxStartPx.x, curPx.y - _parallaxStartPx.y);
      });

      // ── Crear un cluster nuevo desde cero, long-press en mapa VACÍO ──
      // Igual mecánica que el long-press de un pin (mismo umbral de
      // movimiento, misma cancelación por drag real), pero sobre el
      // canvas del mapa en sí — solo dispara si el toque no aterrizó
      // sobre ningún marker (target === el canvas). Arranca el panel con
      // un grupo vacío; el buscador de "agregar lugar" (mismo que usa
      // "agregar más lugares a un cluster existente") es la forma de ir
      // sumando lugares desde cero.
      let mapPressTimer = null, mapPressStartX = 0, mapPressStartY = 0;
      const mapCanvas = this.map.getCanvas();
      const clearMapPress = () => {
        if (mapPressTimer) { clearTimeout(mapPressTimer); mapPressTimer = null; }
        document.removeEventListener('pointermove', onMapPressMove);
        document.removeEventListener('pointerup', clearMapPress);
        document.removeEventListener('pointercancel', clearMapPress);
        if (this._cancelActiveClusterPress === clearMapPress) this._cancelActiveClusterPress = null;
      };
      const onMapPressMove = (e2) => {
        if (mapPressTimer && (Math.abs(e2.clientX - mapPressStartX) > 6 || Math.abs(e2.clientY - mapPressStartY) > 6)) clearMapPress();
      };
      mapCanvas.addEventListener('pointerdown', (e) => {
        if (!this.onClusterCustomize || this._clusterModalOpen) return;
        if (e.target !== mapCanvas) return; // el toque aterrizó sobre un marker, no sobre mapa vacío — que lo maneje ese marker
        if (mapPressTimer) {
          // Ya había un dedo presionado — este es un SEGUNDO dedo tocando
          // el canvas (típico de un pellizco para zoom). Sin este chequeo,
          // el segundo pointerdown pisaba la referencia a `mapPressTimer`
          // con un timer nuevo, dejando el PRIMERO corriendo sin ninguna
          // forma de cancelarlo — disparaba solo, aunque el usuario
          // estuviera pellizcando para hacer zoom, no manteniendo presionado.
          clearMapPress();
          return;
        }
        mapPressStartX = e.clientX; mapPressStartY = e.clientY;
        document.addEventListener('pointermove', onMapPressMove, { passive: true });
        document.addEventListener('pointerup', clearMapPress, { passive: true });
        document.addEventListener('pointercancel', clearMapPress, { passive: true });
        this._cancelActiveClusterPress = clearMapPress;
        mapPressTimer = setTimeout(() => {
          clearMapPress();
          this.haptic('longpress');
          this._clusterModalOpen = true;
          this.onClusterCustomize([], null); // grupo vacío = cluster nuevo, se puebla a mano con el buscador
        }, 650); // un toque más largo que el de los pines (550ms) para no confundirse con un long-press accidental mientras se navega el mapa vacío
      }, { passive: true });
      this.map.on('dragend', () => {
        document.body.classList.remove('map-dragging');
        _parallaxAnchor = null;
        _clearPinParallax(); // la transición CSS de .place-marker-el > * anima el regreso a 0
      });

      // Featured highlight — se activa al acercarse al centro, se limpia al alejar zoom
      const _featuredCheck = () => {
        if (this._clusterExpandEl) return; // idem: no tocar nada mientras el carrusel mueve la cámara
        if (this.map.getZoom() >= 17) {
          this._checkFeaturedNearCenter();
        } else if (this._featuredHighlightEl) {
          // Al hacer zoom-out por debajo de 17, limpiar highlight
          this._clearFeaturedHighlight();
        }
      };
      this.map.on('move', _featuredCheck);
      this.map.on('zoom', _featuredCheck);

      // CSS para highlight
      if (!document.getElementById('featured-highlight-styles')) {
        const fs = document.createElement('style');
        fs.id = 'featured-highlight-styles';
        fs.textContent = `
          .marker-highlighted .place-pin-wrapper {
            box-shadow: 0 0 0 2.5px #FF6D00, 0 0 0 5px rgba(255,109,0,0.25), 0 4px 18px rgba(255,109,0,0.35) !important;
            transition: box-shadow 0.2s ease;
          }
          @keyframes featuredNameIn {
            from { opacity:0; transform:translateX(-50%) translateY(4px); }
            to   { opacity:1; transform:translateX(-50%) translateY(0); }
          }
          @keyframes pinBubblePulseIn {
            0%   { transform:scale(0.3); opacity:0; }
            55%  { transform:scale(1.12); opacity:1; }
            80%  { transform:scale(0.94); }
            100% { transform:scale(1); }
          }
          .pin-bubble-pop {
            animation: pinBubblePulseIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
            transform-origin: bottom center;
          }
          /* Colita del globo como ::after del MISMO elemento de la píldora
             — no es un div aparte, así que no hay costura/borde visible en
             la unión, se siente una sola pieza de verdad. z-index:-1 para
             que quede detrás del contenido (ícono+texto) de la píldora. */
          .place-pin-bubble-inner::after {
            content: '';
            position: absolute;
            bottom: -2.5px;
            left: 50%;
            width: 7px;
            height: 7px;
            /* Color SÓLIDO idéntico al final del gradiente de la píldora
               (el punto exacto donde se tocan) — con un degradé propio la
               unión desentonaba y se leía como pieza aparte */
            background: #f2f3f5;
            transform: translateX(-50%) rotate(45deg);
            border-radius: 0 0 2px 0;
            z-index: -1;
          }
        `;
        document.head.appendChild(fs);
      }

      // Badge visible en zoom ≥ 15
      let _zt = null;
      this.map.on('zoom', () => {
        if (_zt) return;
        _zt = setTimeout(() => {
          _zt = null;
          const show = this.map.getZoom() >= 15 ? '1' : '0';
          document.querySelectorAll('.place-act-badge').forEach(b => b.style.opacity = show);
        }, 80);
      });

      // Labels: solo recalcular cuando el zoom cambia — no en cada pan/drag
      // En moveend solo actualizar visibilidad de pines (dot/full/hidden)
      this._lastLabelZoom = null;
      this.map.on('zoomend', () => {
        if (this._clusterExpandEl) return; // el carrusel expandido mueve la cámara solo — no recalcular nada mientras está abierto
        this._updatePinsByZoom();
        this._updateLabelsProgressive();
        this._updateClusters();
        this._lastLabelZoom = this.map.getZoom();
      });
      this.map.on('moveend', () => {
        if (this._clusterExpandEl) return;
        this._updatePinsByZoom();
        this._updateLabelsProgressive();
        this._updateClusters();
      });

      // ── Ghost-pan fix ────────────────────────────────────────────────
      // El hack sintetiza un TouchEvent('touchcancel') con bubbles:true
      // sobre el marker, o sea inyecta un evento táctil falso directo en
      // el reconocedor de gestos de MapLibre (burbujea marker →
      // .maplibregl-canvas-container, que es donde MapLibre escucha). Un
      // touchcancel resetea todos los handlers de MapLibre; si llega en
      // el momento equivocado, el DragPan queda creyendo que hay un gesto
      // a medias y el siguiente touchstart se interpreta como "segundo
      // dedo" en vez de como el inicio de un pan → drag fantasma o
      // movimiento brusco.
      //
      // La versión simple (sin lo de abajo) tenía tres agujeros, y los
      // tres se disparan justo cuando un cluster se desintegra (los
      // markers se destruyen y recrean en esa misma pasada):
      //  1. Solo limpiaba en 'touchend'. Si la secuencia terminaba en un
      //     'touchcancel' REAL (pasa seguido cuando un marker desaparece
      //     de debajo del dedo — exactamente lo que ocurre al
      //     desintegrarse un cluster), los listeners quedaban colgados en
      //     el contenedor PARA SIEMPRE. En el próximo touchend de
      //     CUALQUIER otro gesto, esa closure vieja despertaba y disparaba
      //     su touchcancel falso en medio de un gesto que no era el suyo
      //     — el "touch fantasma" y el salto brusco del drag reportados.
      //  2. Disparaba sobre `e.target` sin chequear que siguiera vivo —
      //     y los targets de clusters recién destruidos abundan justo en
      //     el instante de la desintegración.
      //  3. Se aplicaba también a los clusters, que ya tienen su propio
      //     manejo de press por pointer events con cancelación limpia.
      const c = this.map.getContainer();
      c.addEventListener('touchstart', (e) => {
        const marker = e.target.closest && e.target.closest('.maplibregl-marker');
        if (!marker) return;
        if (marker.classList.contains('place-cluster-el')) return; // los clusters manejan su propio gesto
        // Si hay MÁS de un dedo en pantalla en este touchstart, es un
        // pellizco (zoom con 2 dedos), no un tap — no trackear este punto
        // en absoluto. Sin este chequeo, cuando uno de los dos dedos del
        // pellizco caía sobre un marker, al soltar (touchend) ese dedo
        // solía no haberse movido mucho (es común que uno de los dos
        // dedos actúe casi como pivote), `moved` quedaba en false, y el
        // fix sintetizaba un touchcancel JUSTO al terminar un gesto de
        // dos dedos — eso es lo que confundía al reconocedor multi-touch
        // de MapLibre y dejaba el siguiente drag sin poder arrancar hasta
        // soltar y volver a tocar. Coincide con "pasa en zonas con
        // clusters": más markers en pantalla = más chance de que un dedo
        // del pellizco caiga arriba de uno.
        if (e.touches && e.touches.length > 1) return;
        let moved = false;
        const onMove = () => { moved = true; };
        const cleanup = () => {
          c.removeEventListener('touchmove',   onMove,  { capture: true });
          c.removeEventListener('touchend',    onEnd,   { capture: true });
          c.removeEventListener('touchcancel', cleanup, { capture: true });
        };
        const onEnd = (e2) => {
          cleanup();
          if (moved) return;
          // Si en el momento de soltar TODAVÍA hay otro dedo apoyado
          // (`e2.touches.length > 0`), este toque terminó siendo parte de
          // un gesto de dos dedos que arrancó con uno solo — mismo caso
          // que el chequeo de arriba, cubierto acá por si el segundo dedo
          // apareció DESPUÉS de este touchstart.
          if (e2.touches && e2.touches.length > 0) return;
          if (!marker.isConnected) return; // el marker ya fue destruido (re-cluster) — no inyectar nada
          marker.dispatchEvent(new TouchEvent('touchcancel', {
            bubbles: true, cancelable: false,
            touches: [], targetTouches: [], changedTouches: e2.changedTouches
          }));
        };
        c.addEventListener('touchmove',   onMove,  { capture: true, passive: true });
        c.addEventListener('touchend',    onEnd,   { capture: true, passive: true });
        c.addEventListener('touchcancel', cleanup, { capture: true, passive: true });
      }, { passive: true, capture: true });
    });

    this.map.on('click', (e) => {
      if (e.originalEvent.target.closest('.minicard-marker-content')) return;
      // Si el SearchBar está activo, él maneja el cierre de minicard
      // para poder re-aplicar highlights correctamente
      if (window.wpApp && window.wpApp.searchBar && window.wpApp.searchBar.isActive()) {
        window.wpApp.searchBar.onMapClick();
        return;
      }
      this._closeMiniCard();
    });
  }

  _applyBlinkLight() {
    try {
      const style = this.map.getStyle();
      if (!style?.layers) return;
      const map = this.map;

      // Id del primer layer de tipo 'symbol' (nombres de calles, POIs,
      // etc) EN EL ORDEN ORIGINAL del estilo. Se usa como `beforeId` al
      // agregar las capas de línea punteada más abajo — si no, addLayer()
      // sin beforeId las agrega arriba de TODO lo que ya existe en el
      // mapa, texto incluido, y las rayitas tapaban el nombre de las
      // calles en vez de quedar por debajo.
      const firstSymbolId = style.layers.find(l => l.type === 'symbol')?.id;

      // Quitar terrain 3D si el estilo lo trae configurado
      try { map.setTerrain(null); } catch(_){}

      style.layers.forEach(layer => {
        const id  = layer.id;
        const idL = id.toLowerCase();

        // ── Edificios 3D (building-3d, fill-extrusion) → aplanar, NO eliminar ──
        if (layer.type === 'fill-extrusion') {
          if (idL.includes('building')) {
            try {
              map.setPaintProperty(id,'fill-extrusion-height',0);
              map.setPaintProperty(id,'fill-extrusion-base',0);
              map.setPaintProperty(id,'fill-extrusion-color','#d8d2c4');
              map.setPaintProperty(id,'fill-extrusion-opacity',0.85);
            } catch(_){}
            // Outline manual — fill-extrusion no soporta line-color nativo
            const outlineId = id + '-wp-outline';
            if (!map.getLayer(outlineId)) {
              try {
                map.addLayer({
                  id: outlineId, type: 'line',
                  source: layer.source, 'source-layer': layer['source-layer'],
                  minzoom: layer.minzoom || 0,
                  paint: { 'line-color':'#c4bdaf', 'line-opacity':0.6, 'line-width':0.5 }
                });
              } catch(_){}
            }
            return;
          }
          // Otras extrusiones (terrain, etc.) que no sean building → eliminar
          try { map.removeLayer(id); } catch(_){}
          return;
        }
        if (layer.type === 'hillshade') { try { map.removeLayer(id); } catch(_){} return; }

        // ── Fondo ──────────────────────────────────────────────
        if (layer.type === 'background')
          { try { map.setPaintProperty(id,'background-color','#f2efe8'); } catch(_){} return; }

        // ── Agua ────────────────────────────────────────────────
        if (layer.type === 'fill' && (idL.includes('water') || idL.includes('ocean') || idL.includes('lake')))
          { try { map.setPaintProperty(id,'fill-color','#5bb8f5'); map.setPaintProperty(id,'fill-opacity',1); } catch(_){} return; }
        if (layer.type === 'line' && (idL.startsWith('water') || idL.includes('waterway') || idL.includes('river')))
          { try { map.setPaintProperty(id,'line-color','#5bb8f5'); } catch(_){} return; }

        // ── Parques / vegetación — tono suave ──────────────────
        if (layer.type === 'fill' && (idL.includes('park') || idL.includes('grass') || idL.includes('forest') || idL.includes('wood') || idL.includes('green') || idL.includes('scrub') || idL.includes('landcover') || idL.includes('pitch') || idL.includes('garden')))
          { try { map.setPaintProperty(id,'fill-color','#a8d5a2'); map.setPaintProperty(id,'fill-opacity',0.65); } catch(_){} return; }

        // ── Landuse / manzanas — relleno sutil tipo Apple Maps ──
        if (layer.type === 'fill' && (idL.includes('residential') || idL.includes('landuse') || idL.includes('suburb')))
          { try {
              map.setPaintProperty(id,'fill-color','#e6e1d6');
              map.setPaintProperty(id,'fill-opacity',0.5);
              map.setLayerZoomRange(id, layer.minzoom || 0, 24); // quitar maxzoom:12 del estilo original
            } catch(_){} return; }
        // Boundaries administrativos — ocultar (no son manzanas)
        if (layer.type === 'line' && idL.includes('boundary'))
          { try { map.setPaintProperty(id,'line-opacity',0); } catch(_){} return; }

        // ── Edificios fill (zoom bajo) — color + outline nativo ──
        if (layer.type === 'fill' && idL.includes('building'))
          { try {
              map.setPaintProperty(id,'fill-color','#d8d2c4');
              map.setPaintProperty(id,'fill-opacity',0.85);
              map.setPaintProperty(id,'fill-outline-color','#c4bdaf');
            } catch(_){} return; }

        // ── Calles: casing — ocultar para look plano (sin doble sombra 3D) ──
        if (layer.type === 'line' && (idL.includes('casing') || idL.includes('outline') || idL.includes('border')))
          { try { map.setPaintProperty(id,'line-opacity',0); } catch(_){} return; }

        // ── Calles: fill — cartoon gruesas y redondeadas ────────
        if (layer.type === 'line' && (idL.includes('road') || idL.includes('highway') || idL.includes('street') || idL.includes('transport') || idL.includes('tunnel'))) {
          try {
            const isMoto = idL.includes('motor') || idL.includes('motorway');
            const isPrim = idL.includes('primary') || idL.includes('trunk');
            const isSec  = idL.includes('secondary') || idL.includes('tertiary');
            map.setLayoutProperty(id,'line-cap','round');
            map.setLayoutProperty(id,'line-join','round');
            let fillWidth, dashColor;
            if (isMoto)      { map.setPaintProperty(id,'line-color','#f9a825'); fillWidth = ['interpolate',['linear'],['zoom'],10,6,14,16,16,22,18,28]; dashColor = 'rgba(255,255,255,0.85)'; }
            else if (isPrim) { map.setPaintProperty(id,'line-color','#fcd858'); fillWidth = ['interpolate',['linear'],['zoom'],11,5,14,12,16,18,18,24]; dashColor = 'rgba(255,255,255,0.85)'; }
            else if (isSec)  { map.setPaintProperty(id,'line-color','#ffffff'); fillWidth = ['interpolate',['linear'],['zoom'],12,4,14,8,16,14,18,20]; dashColor = 'rgba(180,172,156,0.7)'; }
            else             { map.setPaintProperty(id,'line-color','#ffffff'); fillWidth = ['interpolate',['linear'],['zoom'],13,2.5,14,5,16,10,18,16]; dashColor = 'rgba(180,172,156,0.7)'; }
            map.setPaintProperty(id,'line-width',fillWidth);

            // ── Línea central punteada (look Petal/Huawei Maps) ──────
            // No se puede lograr con line-dasharray en la MISMA capa: eso
            // corta el trazo entero (calle a rayas), no deja un trazo
            // sólido con una rayita fina en el medio. Hace falta una
            // segunda capa, más angosta, dibujada ENCIMA de la calle ya
            // pintada arriba — mismo patrón que ya usa este archivo para
            // el contorno manual de los edificios 3D (ver 'building-3d',
            // el companion layer 'id + "-wp-outline"" unas líneas arriba).
            // Blanca sobre asfalto naranja/amarillo (como una marca vial
            // real); gris suave sobre las calles blancas (ahí el blanco
            // sería invisible contra blanco).
            const dashId = id + '-wp-dash';
            if (!map.getLayer(dashId)) {
              try {
                map.addLayer({
                  id: dashId, type: 'line',
                  source: layer.source, 'source-layer': layer['source-layer'],
                  filter: layer.filter,
                  // maxZoom del mapa es 19 (ver _initMap) → el penúltimo
                  // es 18. Antes aparecía desde zoom 14, mucho antes de
                  // lo pedido.
                  minzoom: Math.max(layer.minzoom || 0, 18),
                  layout: { 'line-cap': 'round', 'line-join': 'round' },
                  paint: {
                    'line-color': dashColor,
                    // Más angosta que antes (0.8→2.2 pasó a 0.5→1.4)
                    'line-width': ['interpolate',['linear'],['zoom'],18,0.5,19,1.4],
                    // Rayas más largas (2,3 → 3,3.5)
                    'line-dasharray': [3, 3.5],
                  }
                }, firstSymbolId); // debajo de los nombres de calle — si no, la rayita tapaba el texto
              } catch(_){}
            } else {
              map.setPaintProperty(dashId,'line-color',dashColor);
            }
          } catch(_){} return;
        }

        // ── Texto ───────────────────────────────────────────────
        if (layer.type === 'symbol') {
          try {
            const tt = map.getLayoutProperty(id,'text-transform');
            if (tt === 'uppercase') map.setLayoutProperty(id,'text-transform','none');

            const isRoad   = idL.includes('road') || idL.includes('street') || idL.includes('transport') || idL.includes('highway');
            const isWaterL = idL.includes('water');

            if (isRoad) {
              map.setLayoutProperty(id,'text-size',9);
              map.setPaintProperty(id,'text-color','#9a9080');
              map.setPaintProperty(id,'text-halo-color','rgba(255,255,255,0.85)');
              map.setPaintProperty(id,'text-halo-width',1.2);
            } else if (isWaterL) {
              map.setLayoutProperty(id,'text-size',10);
              map.setPaintProperty(id,'text-color','#2a6db5');
              map.setPaintProperty(id,'text-halo-color','rgba(255,255,255,0.85)');
            } else {
              // Ocultar TODO lo demás: parques, ciudades (Nuevo Progreso), POIs, etc.
              map.setPaintProperty(id,'text-opacity',0);
              map.setPaintProperty(id,'icon-opacity',0);
            }
          } catch(_){}
        }
      });

      console.log('✅ WhatsPlan gamified style aplicado');
    } catch(e){ console.warn('⚠️ applyBlinkLight:',e.message); }
  }

  // ── Datos ─────────────────────────────────────────────────────────
  async _loadActivities() {
    try {
      const acts = await ActivityService.getActiveActivities();
      this.activities = acts || [];
      this.renderActivities(this.activities, window.wpApp?.currentUser?.id);
    } catch(e) { console.warn('⚠️ Actividades:', e.message); }

    // Realtime: cualquier cambio en activities → recargar y re-renderizar
    if (!this._activitiesSub) {
      console.log('🔌 Suscribiendo a Realtime de activities...');
      this._activitiesSub = ActivityService.subscribeToActivities(async (payload) => {
        console.log('🔔 Realtime activities — evento recibido:', payload?.eventType, payload);
        try {
          const acts = await ActivityService.getActiveActivities();
          this.activities = acts || [];
          this.renderActivities(this.activities, window.wpApp?.currentUser?.id);
        } catch(e) { console.warn('⚠️ Realtime actividades:', e.message); }
      });
      console.log('🔌 Suscripción registrada:', this._activitiesSub?.state || this._activitiesSub);
    }
  }

  // ── Pines de actividad: custom points → pin propio; lugar real → badge ──
  renderActivities(activities, currentUserId) {
    if (this.activityMarkers) this.activityMarkers.forEach(m => m.remove());
    this.activityMarkers = [];
    this._refreshActivityBadges(); // badges sobre pines de lugares reales (ya existente)

    if (!activities || !activities.length) return;

    // Agrupar por punto custom (mismas coords ≈ misma actividad/grupo)
    const groups = new Map();
    activities.forEach(a => {
      if (!a.lat || !a.lng) return;
      if (a.place_id) return; // lugar real → ya cubierto por el badge, no crear pin custom
      const key = `${parseFloat(a.lat).toFixed(4)},${parseFloat(a.lng).toFixed(4)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    if (!groups.size) return;

    const R3D = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';
    const TYPE_ICONS = {
      food: R3D+'Hamburger/3D/hamburger_3d.png', drinks: R3D+'Hot beverage/3D/hot_beverage_3d.png',
      explore: R3D+'Rocket/3D/rocket_3d.png', hangout: R3D+'Balloon/3D/balloon_3d.png',
      shop: R3D+'Shopping bags/3D/shopping_bags_3d.png', music: R3D+'Musical note/3D/musical_note_3d.png',
      spa: R3D+'Person getting massage/3D/person_getting_massage_3d.png',
      sport: R3D+'Person running/3D/person_running_3d.png', photo: R3D+'Camera with flash/3D/camera_with_flash_3d.png',
    };
    const TYPE_FALLBACK = { food:'🍔', drinks:'🧋', explore:'🚀', hangout:'🎈', shop:'🛍️', music:'🎵', spa:'💆', sport:'🏃', photo:'📸' };

    if (!document.getElementById('wp-act-float-keyframes')) {
      const s = document.createElement('style');
      s.id = 'wp-act-float-keyframes';
      s.textContent = `
        @keyframes wpActFloat   { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes wpActShadow  { 0%,100% { transform: scaleX(1); opacity: 0.35; } 50% { transform: scaleX(0.55); opacity: 0.15; } }
        .wp-act-pin    { animation: wpActFloat 2.4s ease-in-out infinite; }
        .wp-act-shadow { animation: wpActShadow 2.4s ease-in-out infinite; }
        body.map-dragging .wp-act-pin, body.map-dragging .wp-act-shadow { animation-play-state: paused; }
      `;
      document.head.appendChild(s);
    }

    groups.forEach(groupActs => {
      const activity = groupActs[0];
      const count    = groupActs.length;
      const hasMine  = groupActs.some(a => a.creator_id === currentUserId);
      const badgeBg  = hasMine ? '#1a5cf5' : '#7c5cf5';
      const badgeTxt = count > 1 ? `${count}` : `${activity.participants?.length || 0}/${activity.max_participants || '∞'}`;
      const fallback = TYPE_FALLBACK[activity.type] || '💎';
      const iconUrl  = activity.icon_url || TYPE_ICONS[activity.type] || (R3D+'Balloon/3D/balloon_3d.png');

      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML = `
        <div class="wp-act-pin" style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;">
          <img src="${iconUrl}" style="width:32px;height:32px;object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:26px\\'>${fallback}</span>'">
          <div style="position:absolute;top:-7px;right:-10px;background:${badgeBg};color:white;border-radius:20px;padding:1px 6px;font-size:10px;font-weight:700;border:1.5px solid white;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${badgeTxt}</div>
        </div>
        <div class="wp-act-shadow" style="width:16px;height:5px;background:rgba(0,0,0,0.4);border-radius:50%;margin-top:1px;"></div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([activity.lng, activity.lat])
        .addTo(this.map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(new CustomEvent('wp:activity-tap', { detail: { activity, group: groupActs } }));
      });

      this.activityMarkers.push(marker);
    });

    console.log(`✅ ${this.activityMarkers.length} pines de actividad en el mapa`);
  }

  async _loadLandmarks() {
    try { this._renderLandmarks(await LandmarkService.getAll()); }
    catch(e) { console.warn('⚠️ Landmarks:', e.message); }
  }

  // Clusters de pines personalizados por el SuperUser (tarjetas/stickers/
  // etiqueta fijos para un grupo curado de lugares — ver _updateClusters).
  // Se cachea en this.pinClusters; reloadPinClusters() lo refresca después
  // de guardar/borrar uno desde el panel.
  async _loadPinClusters() {
    try {
      const res  = await fetch('/api/supabase-clusters');
      const json = await res.json();
      this.pinClusters = json.success ? (json.clusters || []) : [];
    } catch (e) {
      console.warn('⚠️ pin_clusters:', e.message);
      this.pinClusters = this.pinClusters || [];
    }
  }
  async reloadPinClusters() {
    await this._loadPinClusters();
    // Los pines con pinStyle 'cluster' renderizan su diseño desde
    // this.pinClusters dentro de _buildPinHtml, así que al cambiar ese
    // dato hay que reconstruir su HTML — si no, el pin sigue mostrando el
    // diseño anterior hasta que algo más fuerce un re-render.
    this.markerEls.forEach(el => {
      if (!el || !el._place || el._place.pinStyle !== 'cluster') return;
      el.innerHTML = this._buildPinHtml(el._place, null, null);
    });
    this._updateClusters();
  }

  async loadCategory(menuKey) {
    this.currentCatId   = menuKey;
    this.currentCatData = this.CATEGORIES[menuKey] || CATEGORIES[menuKey] || CATEGORIES['RESTAURANTS'];
    this._clearPlaceMarkers();
    try {
      const _t  = Date.now();
      const [res] = await Promise.all([
        fetch(`/api/supabase-places?category=${menuKey}`),
        _ensureSubcatsLoaded(), // garantizar caché de íconos listo antes de renderizar pines
        this.pinClusters ? Promise.resolve() : this._loadPinClusters(), // solo la 1ra vez
      ]);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      let custom = [];
      try { custom = await CustomPlaceService.getByCategory(menuKey); } catch(_) {}
      this.allPlaces = [...(json.places || []), ...custom];
      this._renderPlaceMarkers(this.allPlaces);
      // Notificar al SearchBar que el conteo cambió
      document.dispatchEvent(new CustomEvent('wp:placesloaded', { detail: { count: this.allPlaces.length } }));
    } catch(e) { console.error('❌ loadCategory:', e); }
    if (this._allLandmarks) this._renderLandmarks([]);
  }

  // ── Markers ───────────────────────────────────────────────────────
  _clearPlaceMarkers() {
    if (this._labelTimers) this._labelTimers.forEach(t => clearTimeout(t));
    this._labelTimers = [];
    this.markers.forEach(m => m?.remove());
    this.markers = []; this.markerEls = [];
    this._clearClusters();
    // Reset visibility state
    document.querySelectorAll('.place-marker-el').forEach(e => { e._wpVisible = undefined; });
    this._closeMiniCard();
  }

  _renderPlaceMarkers(places) {
    const cat        = this.currentCatData;
    const catIcon3d  = cat?.icon3d || null;
    const catEmoji   = cat?.icon || '💎';

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    places.forEach((place, index) => {
      const lat = place.location?.lat ?? place.lat;
      const lng = place.location?.lng ?? place.lng;
      if (!lat || !lng) return;

      const rawPhoto = place.photoUrl || place.photo_url || place.photosUrls?.[0] || null;
      const photoUrl = proxyPhoto(rawPhoto);

      // Icono de fallback (subcategoría > categoría > emoji) — se calcula SIEMPRE,
      // así sirve de respaldo si la foto existe pero falla al cargar (ej: Google sin API key)
      const subIcon3d = getSubcatIcon3d(place, this.currentCatId);
      const catIcon    = buildIconHtml(subIcon3d || catIcon3d, catEmoji, 20);

      const el = document.createElement('div');
      el.className = 'place-marker-el';
      el.innerHTML = this._buildPinHtml(place, photoUrl, catIcon);
      el._place    = place;
      // Tier para zoom dinámico: 0=featured, 1=top rated, 2=rated, 3=all
      el._zoomTier = place.featured ? 0
        : (parseFloat(place.rating) >= 4.2) ? 1
        : (parseFloat(place.rating) >= 3.5) ? 2
        : 3;

      // ── Long-press sobre un pin normal → crear su "pin de estilo
      // cluster" ────────────────────────────────────────────────────────
      // Mismo mecanismo que el long-press de un cluster. Una vez creado,
      // el lugar pasa a renderizarse como sticker (paso 3 de
      // _updateClusters) y este wrapper queda oculto, así que a partir de
      // ahí el long-press que lo EDITA es el del sticker, no este. Este
      // solo sirve para la PRIMERA personalización.
      let pinPressTimer = null, pinLongPressFired = false, pinStartX = 0, pinStartY = 0;
      let pinDocMove = null, pinDocUp = null;
      const pinCleanupDoc = () => {
        if (pinDocMove) { document.removeEventListener('pointermove', pinDocMove); pinDocMove = null; }
        if (pinDocUp) { document.removeEventListener('pointerup', pinDocUp); document.removeEventListener('pointercancel', pinDocUp); pinDocUp = null; }
      };
      const pinClearPress = () => {
        if (pinPressTimer) { clearTimeout(pinPressTimer); pinPressTimer = null; }
        if (this._cancelActiveClusterPress === pinClearPress) this._cancelActiveClusterPress = null;
        pinCleanupDoc();
      };
      el.addEventListener('pointerdown', (e) => {
        if (!this.onClusterCustomize || this._clusterModalOpen) return;
        if (this._dragModeActive) return; // reposicionando lugares — no confundir gestos
        if (pinPressTimer) { pinClearPress(); return; } // 2do dedo (pellizco) — cancelar
        pinLongPressFired = false;
        pinStartX = e.clientX; pinStartY = e.clientY;
        pinPressTimer = setTimeout(() => {
          pinCleanupDoc();
          pinLongPressFired = true;
          this._cancelActiveClusterPress = null;
          this.haptic('longpress');
          this._clusterModalOpen = true;
          const ll = el._marker.getLngLat();
          // Si este lugar YA tiene un diseño de pin cluster guardado, hay
          // que abrir el editor en modo EDITAR (pasándole esa fila y su
          // id), no crear una fila nueva en blanco. Sin esto, cada
          // long-press abría una sesión de creación nueva: la fila vieja
          // seguía existiendo en Supabase, el guardado creaba OTRA fila
          // más, y cuál de las dos "ganaba" al dibujar el pin dependía del
          // orden en que Supabase devolviera las filas — no de cuál
          // edición era la más reciente. Por eso cambios como el badge, la
          // etiqueta o mover una tarjeta parecían no guardarse: se
          // guardaban, pero en una fila que nadie leía.
          const pid = placeIdOf(el._place);
          const existing = (this.pinClusters || []).find(
            cd => (cd.placeIds || []).length === 1 && cd.placeIds[0] === pid
          ) || null;
          this.onClusterCustomize([{ el, ll, px: this.map.project(ll) }], existing);
        }, 550);
        this._cancelActiveClusterPress = pinClearPress;
        pinDocMove = (e2) => {
          if (pinPressTimer && (Math.abs(e2.clientX - pinStartX) > 5 || Math.abs(e2.clientY - pinStartY) > 5)) pinClearPress();
        };
        pinDocUp = () => pinClearPress();
        document.addEventListener('pointermove', pinDocMove, { passive: true });
        document.addEventListener('pointerup', pinDocUp, { passive: true });
        document.addEventListener('pointercancel', pinDocUp, { passive: true });
      }, { passive: true });
      el.addEventListener('pointerup', pinClearPress, { passive: true });
      el.addEventListener('pointercancel', pinClearPress, { passive: true });
      el.addEventListener('pointerleave', pinClearPress, { passive: true });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pinLongPressFired) { pinLongPressFired = false; return; } // el long-press ya actuó
        // ── Reposicionar lugares (SuperUserPanel) ──────────────
        if (this._dragModeActive) {
          this.haptic('select');
          this._selectPlaceForReposition(place, el, index);
          return;
        }
        this.haptic('tap');

        // Antes comparaba por referencia de objeto (this.miniCardMarker ===
        // this.markers[index]), lo cual fallaba si el array de markers se
        // reconstruye (nueva búsqueda/filtro) aunque sea el mismo lugar.
        // Ahora comparamos por id estable del lugar + que el minicard siga
        // realmente abierto — así el flujo es siempre: 1er tap → minicard,
        // 2do tap en el MISMO pin (con el minicard ya abierto) → onPlaceSelect.
        // (búsqueda o mapview normal: ambos muestran el minicard primero;
        // la diferencia entre abrir la ficha directo o pasar por el minisnap
        // la decide onPlaceSelect en app.js según si hay búsqueda activa)
        const samePlaceId = this.miniCardPlace &&
          (this.miniCardPlace.place_id || this.miniCardPlace.id) === (place.place_id || place.id);
        if (this.miniCardMarker && samePlaceId) {
          if (this.onPlaceSelect) this.onPlaceSelect(place);
          return;
        }
        // Mismo protocolo que autocompletado: cerrar teclado y esperar
        const vv  = window.visualViewport;
        const kbH = vv ? Math.max(0, window.innerHeight - vv.height) : 0;
        const self = this;
        if (kbH > 50 || window._wpKeyboardWasOpen) {
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            document.activeElement.blur();
          }
          setTimeout(function() {
            self._showMiniCard(place, index, rawPhoto);
          }, 150);
        } else {
          this._showMiniCard(place, index, rawPhoto);
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);

      el._marker = marker;

      // Pre-calcular modo del label una sola vez — el elemento ya está en el DOM
      // (addTo lo insertó), invisible (opacity:0/visibility:hidden del CSS inicial),
      // pero medible. Guardamos si necesita 1 o 2 líneas en el elemento para que
      // _updateLabelsProgressive solo aplique, nunca mida.
      requestAnimationFrame(() => {
        const label = el.querySelector('.place-pin-label');
        if (!label) return;
        // Medir con nowrap — el label ya tiene max-width:90px del buildPinHtml
        const prev = label.style.cssText;
        label.style.cssText = prev + ';white-space:nowrap;display:block;visibility:hidden;opacity:0;';
        el._labelMultiline = label.scrollWidth > label.offsetWidth + 2;
        label.style.cssText = prev; // restaurar estado inicial
      });

      // Foto lazy con IntersectionObserver
      if (photoUrl) {
        if ('IntersectionObserver' in window) {
          const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              obs.disconnect();
              const img = new Image();
              img.onload  = () => applyPhotoToPin(photoUrl, el);
              img.onerror = () => applyErrorToPin(el);
              img.src = photoUrl;
            });
          }, { rootMargin: '200px' });
          obs.observe(el);
        } else {
          const img = new Image();
          img.onload  = () => applyPhotoToPin(photoUrl, el);
          img.onerror = () => applyErrorToPin(el);
          img.src = photoUrl;
        }
      }

      this.markerEls.push(el);
      this.markers.push(marker);
      bounds.extend([lng, lat]);
      hasCoords = true;
    });

    if (hasCoords) {
      this.map.fitBounds(bounds, {
        padding: { top: 70, bottom: 120, left: 50, right: 50 },
        maxZoom: 15,
        minZoom: 15
      });
    }
    this._refreshActivityBadges();
    // Asignar zoom threshold fijo por pin (una vez) y aplicar
    this._assignZoomThresholds();
    this._updatePinsByZoom();
    this._updateClusters();
    // Re-aplicar tras fitBounds (el zoom puede cambiar)
    this.map.once('moveend', () => {
      this._updatePinsByZoom();
      this._updateLabelsProgressive();
      this._updateClusters();
    });
  }

  // ── HTML del pin — con label igual que PWA original ───────────────



  // ── Pre-calcular zoom threshold por distancia mínima entre pines ──────
  _assignZoomThresholds() {
    const levels = [
      { zoom: 13, minDist: 0.0025 },
      { zoom: 14, minDist: 0.0012 },
      { zoom: 15, minDist: 0.0006 },
      { zoom: 16, minDist: 0.0003 },
      { zoom: 17, minDist: 0.00015 },
    ];

    const all = this.markerEls.map((el, i) => ({
      el, m: this.markers[i],
      prio: el._zoomTier ?? 3
    })).filter(x => x.m);
    all.sort((a, b) => a.prio - b.prio);

    const assigned = new Set();

    levels.forEach(({ zoom, minDist }) => {
      const placed = [];
      assigned.forEach(el => { if (el._m) placed.push(el._m.getLngLat()); });

      all.forEach(({ el, m }) => {
        if (assigned.has(el)) return;
        const ll = m.getLngLat();
        const tooClose = placed.some(p => {
          const dx = p.lng - ll.lng, dy = p.lat - ll.lat;
          return Math.sqrt(dx*dx + dy*dy) < minDist;
        });
        if (!tooClose) {
          el._showAtZoom = zoom;
          el._m = m;
          assigned.add(el);
          placed.push(ll);
        }
      });
    });

    // Pines que no cupieron en ningún nivel → visibles en zoom 18
    // TODOS los pines deben aparecer — ninguno se oculta permanentemente
    this.markerEls.forEach(el => {
      if (!assigned.has(el)) el._showAtZoom = 18;
    });
  }

  // ── Pines dinámicos — cuadrícula espacial tipo Apple Maps ──────────
  _updatePinsByZoom() {
    if (window._wpGestoT0) console.log(`[GESTO] +${(performance.now()-window._wpGestoT0).toFixed(0)}ms  _updatePinsByZoom() arranca`);
    const zoom = Math.floor(this.map.getZoom());

    this.markerEls.forEach(el => {
      if (!el) return;
      const threshold = el._showAtZoom ?? 13;
      // 3 estados: 0=oculto, 1=punto celeste (1 zoom antes), 2=pin completo
      let state = zoom >= threshold ? 2 : zoom >= threshold - 1 ? 1 : 0;

      // Un pin de estilo cluster nunca cae al estado 0: aunque falte zoom
      // para revelarlo, deja su punto de color (ver _buildPinHtml) como
      // señal de que ahí hay algo. Al alcanzar el zoom, el punto se apaga
      // y aparece el diseño completo del sticker.
      const isClusterStyle = el._place?.pinStyle === 'cluster';
      // Marca de "punto forzado": este pin estaría OCULTO por zoom, y solo
      // se lo deja visible como puntito de color. Es distinto del estado 1
      // natural (el que ocurre un zoom antes del umbral). La distinción
      // importa para el clustering: un punto forzado NO debe participar del
      // agrupamiento automático — si participara, estos pines quedarían
      // presentes en todos los zooms y sostendrían los grupos armados,
      // que es justo lo que hacía perder el reagrupamiento dinámico (los
      // grupos ya no se encogían ni se recombinaban al alejarse).
      el._wpForcedDot = isClusterStyle && state === 0;
      if (el._wpForcedDot) state = 1;
      if (isClusterStyle) {
        const dot     = el.querySelector('.place-pin-cluster-dot');
        const content = el.querySelector('.place-pin-cluster-content');
        if (dot)     dot.style.display     = state === 2 ? 'none' : 'block';
        if (content) content.style.display = state === 2 ? '' : 'none';
      }

      if (state === el._wpState) return;
      el._wpState   = state;
      el._wpVisible = state === 2;

      const wrapper = el.querySelector('.place-pin-wrapper');
      const bubbleInner = el.querySelector('.place-pin-bubble-inner');
      const bubbleStack = el.querySelector('.place-pin-bubble-stack');
      const bubbleDot   = el.querySelector('.place-pin-bubble-dot');
      const socialBody  = el.querySelector('.place-pin-social-body');
      const socialPop   = el.querySelector('.place-pin-social-pop');
      const socialExtra = el.querySelector('.place-pin-social-extra');
      const socialZoomDot = el.querySelector('.place-pin-social-zoomdot');

      if (state === 2) {
        el.style.visibility    = 'visible';
        el.style.pointerEvents = '';
        el.style.transition    = 'opacity 0.35s ease';
        el.style.opacity       = '1';
        if (bubbleInner) {
          // Pines tipo globo: no fade genérico, entran con un pulso
          // (scale con rebote), no de golpe — y el punto celeste se
          // esconde en cuanto aparece el globo completo. Delay aleatorio
          // por pin para que no aparezcan todos exactamente a la vez.
          if (bubbleDot) bubbleDot.style.display = 'none';
          if (bubbleStack) bubbleStack.style.display = 'flex';
          bubbleInner.classList.remove('pin-bubble-pop');
          const bDelay = Math.random() * 260;
          setTimeout(() => {
            void bubbleInner.offsetWidth; // fuerza reflow para poder re-disparar la animación
            bubbleInner.classList.add('pin-bubble-pop');
          }, bDelay);
        }
        if (socialBody) {
          // Pin social: mismo criterio — punto de color se esconde, pin
          // completo aparece con pulso escalonado (no todos a la vez).
          // El label (hermano del badge, no hijo) se muestra al mismo
          // tiempo.
          if (socialZoomDot) socialZoomDot.style.display = 'none';
          socialBody.style.display = 'block';
          if (socialExtra) socialExtra.style.display = 'flex';
          // La animación de pulso se aplica al div interno (.place-pin-social-pop),
          // NUNCA a socialBody: socialBody tiene el transform:translate(-50%,-50%)
          // inline que lo mantiene centrado en la coordenada real, y la animación
          // (que define su propio `transform:scale(...)` en el keyframe) pisaría
          // ese translate — con fill-mode:both, para siempre — corriendo el badge
          // del centro apenas termina el pulso.
          if (socialPop) {
            socialPop.classList.remove('pin-bubble-pop');
            const sDelay = Math.random() * 260;
            setTimeout(() => {
              void socialPop.offsetWidth;
              socialPop.classList.add('pin-bubble-pop');
            }, sDelay);
          }
        }
        if (wrapper) {
          wrapper.style.transition = 'width 0.3s ease, height 0.3s ease, padding 0.3s ease';
          wrapper.style.width = ''; wrapper.style.height = ''; wrapper.style.padding = '';
          wrapper.style.overflow = '';
          const inner = wrapper.querySelector('.pin-inner');
          if (inner) inner.style.opacity = '';
          wrapper.querySelectorAll('img').forEach(img => { img.style.opacity = ''; });
        }

      } else if (state === 1) {
        el.style.visibility    = 'visible';
        el.style.pointerEvents = 'none';
        el.style.transition    = 'none';
        el.style.opacity       = '1';
        // Globo: mismo estado "punto" que los pines circulares, pero con
        // su propio punto celeste (el globo no tiene .place-pin-wrapper)
        if (bubbleDot) bubbleDot.style.display = 'block';
        if (bubbleStack) bubbleStack.style.display = 'none';
        // Pin social: punto con el MISMO color que el badge elegido (no
        // celeste genérico) — el pin social tampoco tiene .place-pin-wrapper
        if (socialZoomDot) socialZoomDot.style.display = 'block';
        if (socialBody) socialBody.style.display = 'none';
        if (socialExtra) socialExtra.style.display = 'none';
        if (wrapper) {
          wrapper.style.transition = 'none';
          wrapper.style.width = '7px'; wrapper.style.height = '7px'; wrapper.style.padding = '0';
          wrapper.style.overflow = 'hidden';
          const inner = wrapper.querySelector('.pin-inner');
          if (inner) inner.style.opacity = '0';
          wrapper.querySelectorAll('img').forEach(img => { img.style.opacity = '0'; });
        }

      } else {
        el.style.transition    = 'none';
        el.style.opacity       = '0';
        el.style.visibility    = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
  }

  // ── Clusters de pines "amontonados" (calles con muchos negocios pegados) ──
  // Fase 1: agrupa por cercanía EN PANTALLA (no en grados fijos — así el
  // agrupamiento se adapta solo al zoom, sin números mágicos por nivel) los
  // pines que ya están visibles según _updatePinsByZoom, y a partir de 3
  // pines juntos los reemplaza por un solo "sticker" de fotos apiladas
  // (mismo diseño 'fan-drift' que ya armamos para el stack del pin social),
  // con un badge "+N" con el total del grupo. Por debajo de zoom 17.2 se
  // desarma solo, dejando ver los pines individuales normalmente — a esa
  // altura ya hay espacio de sobra entre ellos.
  _clearClusters() {
    // Antes de destruir los markers, forzar la limpieza de cualquier
    // long-press pendiente en ellos. Sin esto: si un dedo estaba
    // tocando un cluster justo cuando el mapa se re-renderiza (pasa en
    // CADA moveend/zoomend, o sea después de cada pan/zoom), el
    // listener de pointermove/pointerup que ese long-press había puesto
    // en `document` quedaba HUÉRFANO PARA SIEMPRE — el marker se
        // destruye, pero el listener en `document` sigue vivo, referenciando
    // una closure vieja. Como cada re-render crea una función NUEVA
    // (no reutiliza la anterior), esto se iba acumulando de a uno con
    // cada pan/zoom — cada vez más listeners de pointermove corriendo
    // en simultáneo en TODO el documento, cada vez más lento.
    (this._clusterPressCleanups || []).forEach(fn => fn());
    this._clusterPressCleanups = [];
    this.clusterMarkers.forEach(m => m?.remove());
    this.clusterMarkers = [];
    this._clusterByKey = new Map();
  }

  // Firma estable de un cluster: si no cambió, el marker de la pasada
  // anterior se REUTILIZA tal cual en vez de destruirse y volver a
  // construirse. Ver el comentario largo en _updateClusters().
  _clusterKey(group, customDef) {
    const pids = group.map(({ el }) => placeIdOf(el._place)).sort().join('|');
    if (!customDef) return `auto::${pids}`;
    // Hash barato de la definición para que una edición del SuperUser sí
    // fuerce el rebuild (cambian posiciones/stickers/badge sin cambiar los
    // place_ids, así que los pids solos no alcanzan como firma).
    const s = JSON.stringify(customDef);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return `def:${h}::${pids}`;
  }

  _destroyClusterMarker(marker) {
    const el = marker?.getElement?.();
    if (el && el._clusterClearPress) el._clusterClearPress(); // cancelar su long-press pendiente, si lo hay
    if (el && this._activeTouchMarkerEls && this._activeTouchMarkerEls.has(el)) {
      // Hay un dedo apoyado ENCIMA de este marker ahora mismo — no
      // sacarlo del DOM todavía (ver el comentario largo donde se define
      // _activeTouchMarkerEls). Se oculta visualmente y se desactiva como
      // tappeable, pero queda en el DOM hasta que ese toque termine, para
      // no perder los touchmove/touchend de ese dedo.
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      this._pendingMarkerRemovals.add(marker);
    } else {
      marker?.remove();
    }
    const i = this.clusterMarkers.indexOf(marker);
    if (i !== -1) this.clusterMarkers.splice(i, 1);
  }

  _updateClusters() {
    if (window._wpGestoT0) console.log(`[GESTO] +${(performance.now()-window._wpGestoT0).toFixed(0)}ms  _updateClusters() arranca`);
    if (!this._clusterByKey) this._clusterByKey = new Map();

    // Restaurar SIEMPRE primero los pines que un agrupamiento anterior
    // haya ocultado — si no, un pin que quedó escondido en una pasada
    // podía no volver a mostrarse nunca si el siguiente cálculo ya no lo
    // agrupaba (o si se hizo zoom-in de golpe por encima del umbral).
    this.markerEls.forEach(el => {
      if (el._clusterHiddenDisplay !== undefined) {
        el.style.display = el._clusterHiddenDisplay;
        el.style.pointerEvents = '';
        delete el._clusterHiddenDisplay;
      }
    });

    // NOTA: acá había un `if (zoom >= 17.2) { _clearClusters(); return; }`.
    // Se sacó porque los pines de ESTILO ÚNICO (paso 3) tienen que
    // renderizarse también a zoom alto — justo cuando el cluster grupal se
    // desintegra. El corte por zoom ahora es la bandera `clustersActive`,
    // que apaga solo los pasos 1 y 2 (los agrupamientos). La limpieza de
    // los clusters que dejaron de corresponder la hace la reconciliación
    // del final, que ya destruye todo lo que no esté en `wanted`.

    const CLUSTER_PX = 58;   // distancia máxima en pantalla para agrupar (auto)
    const MIN_GROUP  = 3;    // mínimo de pines juntos para volverse cluster (auto)

    const candidates = this.markerEls
      // _wpForcedDot excluido: son pines que por zoom deberían estar
      // ocultos y solo se muestran como punto de color (ver
      // _updatePinsByZoom). No cuentan para agrupar — así los grupos
      // vuelven a formarse y deshacerse con el zoom como antes.
      .filter(el => el.style.display !== 'none' && el.style.visibility !== 'hidden' && !el._wpForcedDot && el._place)
      .map(el => {
        const ll = el._marker.getLngLat();
        return { el, ll, px: this.map.project(ll) };
      });

    const usedEls = new Set();
    const wanted = [];

    // ¿Está activo el agrupamiento? Los clusters GRUPALES (curados de
    // varios lugares + automáticos por cercanía) solo existen por debajo
    // de este zoom: más cerca ya hay lugar para mostrar cada pin suelto.
    // Los pines de ESTILO ÚNICO no dependen de esto — ver paso 3.
    const clustersActive = this.map.getZoom() < 17.2;

    // PRIORIDAD entre filas que compiten por el mismo lugar. Hace falta
    // porque `usedEls` da el lugar a la PRIMERA fila que lo reclama, y en
    // la base conviven muchas filas que reclaman los mismos place_ids
    // (cada personalización de un grupo crea una fila nueva; las viejas
    // quedan). Sin un criterio explícito ganaba una cualquiera — el orden
    // en que Supabase devolviera las filas — y el cluster recién creado
    // se quedaba sin miembros y no se renderizaba nunca.
    //
    // 1º la más RECIENTE: si acabás de crear o editar un cluster, esa es
    //    la intención vigente y debe ganarle a cualquier fila anterior.
    // 2º a igualdad de fecha, la que agrupa MÁS lugares.
    const pinClustersByPriority = [...(this.pinClusters || [])]
      .sort((a, b) => {
        const ta = Date.parse(a.updatedAt || '') || 0;
        const tb = Date.parse(b.updatedAt || '') || 0;
        if (tb !== ta) return tb - ta;
        return (b.placeIds || []).length - (a.placeIds || []).length;
      });

    // 1) Clusters GRUPALES personalizados por el SuperUser — fijos por
    // place_id, sin importar la distancia real entre ellos (curados a
    // mano). Van ANTES que los pines de estilo único del paso 3: mientras
    // el cluster está activo, reclama a sus miembros primero, así que un
    // lugar con estilo propio que además pertenece a un cluster se ve
    // COMO PARTE DEL CLUSTER, no como pin suelto. Recién cuando el
    // cluster se desintegra (zoom alto → clustersActive false → este paso
    // ni corre) ese lugar queda libre y el paso 3 le devuelve su diseño
    // individual — que es exactamente el comportamiento pedido.
    //
    // placeIdOf() es la ÚNICA fuente de verdad (definida arriba en el
    // módulo, exportada, y usada acá + en _buildClusterStickerHtml +
    // en SuperUserPanel.js) — antes había copias locales ligeramente
    // distintas en cada lugar, y esa desincronización era justo lo que
    // rompía la edición para lugares sin place_id/id.
    if (clustersActive) {
      pinClustersByPriority.forEach(customDef => {
        if ((customDef.placeIds || []).length <= 1) return; // de un solo lugar → paso 3
        // Pool ESTRICTO a propósito (respeta el revelado por zoom). Con el
        // pool amplio que se probó antes, un cluster curado reclamaba a sus
        // miembros SIEMPRE, incluso a zoom bajo donde esos pines todavía no
        // se revelan — quedaba clavado en pantalla y le robaba miembros al
        // clustering automático, que es el que hace que los grupos se
        // formen, se disuelvan y se recombinen al hacer zoom. Con el pool
        // estricto vuelve ese comportamiento dinámico.
        const members = candidates.filter(c =>
          !usedEls.has(c.el) && (customDef.placeIds || []).includes(placeIdOf(c.el._place))
        );
        // .filter() preserva el orden de `candidates` (básicamente el
        // orden en que los pines se cargaron en el mapa), NO el de
        // customDef.placeIds — así que reordenar los lugares desde el
        // editor del slide, guardar, y reabrir NUNCA se veía reflejado:
        // el array `place_ids` en la base sí quedaba reordenado, pero acá
        // se reconstruía el grupo ignorando ese orden por completo. El
        // orden de placeIds es la ÚNICA fuente de verdad para "quién va
        // primero" — se reordena explícitamente para que coincida.
        const order = customDef.placeIds || [];
        members.sort((a, b) => order.indexOf(placeIdOf(a.el._place)) - order.indexOf(placeIdOf(b.el._place)));
        // Exige el grupo COMPLETO, no "al menos uno". Antes, si a un
        // cluster de 2+ lugares le faltaba alguno (por ejemplo, oculto
        // todavía por el revelado de zoom), el resto igual se renderizaba
        // — pero como "cluster de un solo lugar", que es un ESTILO DE PIN
        // (pinStyle==='cluster', tap → minicard), no un cluster grupal
        // (tap → carrusel). El resultado era un pin que abría el
        // carrusel/slide como si fuera un lugar solo declarado con estilo
        // cluster, cuando en realidad era un miembro suelto de un grupo.
        // Si falta alguno, ningún miembro se dibuja como cluster acá: cada
        // uno cae a su propio render normal (_buildPinHtml), que ya sabe
        // mostrarlo con estilo cluster individual si ESE lugar en
        // particular tiene ese estilo declarado — y si no, con lo que
        // tenga configurado.
        if (members.length < (customDef.placeIds || []).length) return;
        members.forEach(m => usedEls.add(m.el));
        wanted.push({ key: this._clusterKey(members, customDef), group: members, customDef });
      });
    }

    // 2) Clustering automático por cercanía en pantalla para el resto
    if (clustersActive) {
    // Los pines con estilo único NO se excluyen de acá a propósito: si
    // están lo bastante cerca de otros, se agrupan como cualquier otro
    // pin y se desagrupan al alejarse. Ese ir y venir con el zoom —
    // clusters que se forman, se disuelven y se recombinan — es el
    // comportamiento buscado; excluirlos los volvía fijos.
    const remaining = candidates.filter(c => !usedEls.has(c.el));
    const usedAuto = new Set();
    const groups = [];
    remaining.forEach(item => {
      if (usedAuto.has(item.el)) return;
      const group = [item];
      usedAuto.add(item.el);
      remaining.forEach(other => {
        if (usedAuto.has(other.el)) return;
        const dx = other.px.x - item.px.x, dy = other.px.y - item.px.y;
        if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_PX) {
          group.push(other);
          usedAuto.add(other.el);
        }
      });
      groups.push(group);
    });

    groups.filter(g => g.length >= MIN_GROUP)
      .forEach(group => wanted.push({ key: this._clusterKey(group, null), group, customDef: null }));
    }

    // NOTA: acá vivía un paso 3 que renderizaba los pines de estilo
    // cluster como marcadores de cluster de un solo lugar. Se eliminó:
    // ahora 'cluster' es un ESTILO DE PIN más (ver _buildPinHtml), así que
    // esos lugares se dibujan como cualquier otro pin del mapa y no
    // necesitan pasar por acá.

    // ── RECONCILIACIÓN — este es el arreglo del freeze del drag ──────────
    // Antes esta función arrancaba con _clearClusters(): en CADA moveend y
    // CADA zoomend destruía TODOS los markers de cluster y los volvía a
    // construir con innerHTML. Con N clusters en pantalla × varias tarjetas
    // cada uno, eso es un teardown + parseo de HTML + layout + decode de
    // imágenes + repintado completo, sincrónico, en el handler de moveend.
    //
    // Y moveend es exactamente el instante en que soltás el dedo. Si volvés
    // a tocar enseguida — que es justo el caso "arrastro, freno sobre un
    // cluster, y quiero seguir arrastrando" — tu touchstart aterriza en
    // medio de ese trabajo: el main thread está ocupado, MapLibre no llega
    // a procesar el inicio del gesto, y el drag no arranca. No es el
    // long-press ni el hit-testing: es que los "containers" de los clusters
    // se estaban rehaciendo enteros abajo de tu dedo.
    //
    // Clave del asunto: en un PAN puro, project() desplaza todos los pines
    // por igual, así que las distancias EN PÍXELES entre ellos no cambian —
    // los grupos resultantes son idénticos a los de la pasada anterior. O
    // sea que el 100% de ese trabajo era tirar y reconstruir algo idéntico.
    // Con la firma de _clusterKey(), un pan ahora no toca el DOM en
    // absoluto; solo un zoom (que sí reagrupa) construye lo que cambió.
    const wantedKeys = new Set(wanted.map(w => w.key));
    for (const [key, marker] of Array.from(this._clusterByKey)) {
      if (wantedKeys.has(key)) continue;
      // No destruir el sticker sobre el que está inflado el minicard: se
      // llevaría puesto el minimodal abierto a mitad de un reagrupamiento
      // (pasa al hacer zoom con el minicard abierto). Cuando se cierre,
      // _restorePin dispara un _updateClusters() que lo limpia si ya no
      // corresponde.
      if (this.miniCardMarker === marker) continue;
      this._destroyClusterMarker(marker);
      this._clusterByKey.delete(key);
    }
    wanted.forEach(w => {
      // Ocultar los pines miembros vale para TODOS los clusters vigentes,
      // sobrevivan o no — el bloque de "restaurar" del arranque de esta
      // función los volvió a mostrar a todos. El guard de display evita
      // escribir estilo (y por lo tanto invalidar layout) cuando ya estaba
      // oculto, que es el caso normal en un pan.
      w.group.forEach(({ el }) => {
        // Si este miembro es el wrapper que está mostrando el minicard
        // ABIERTO, no ocultarlo: el easeTo() de _showMiniCard dispara su
        // propio moveend a mitad del paneo y, sin este guard, la
        // reconciliación cerraba el minicard sola.
        if (el === this.miniCardMarker?.getElement()) return;
        if (el.style.display === 'none') return;
        // Mismo motivo que el guard de _destroyClusterMarker: display:none
        // sobre un elemento con un dedo apoyado encima puede cortar sus
        // touchmove/touchend en algunos navegadores, igual que sacarlo del
        // DOM. Más barato prevenirlo acá también que depurarlo de nuevo.
        if (this._activeTouchMarkerEls && this._activeTouchMarkerEls.has(el)) return;
        el._clusterHiddenDisplay = el.style.display;
        el.style.display = 'none';
        el.style.pointerEvents = 'none';
      });
      const survivor = this._clusterByKey.get(w.key);
      if (survivor) {
        // Sobrevive: no se reconstruye, pero SÍ hay que garantizar que su
        // elemento esté visible. El tap en un pin de estilo único oculta
        // el sticker a mano (display:none) para mostrar el wrapper y que
        // _showMiniCard infle la burbuja sobre él. Al cerrar el minicard,
        // esta reconciliación vuelve a ocultar el wrapper (arriba) — y si
        // además el sticker seguía oculto por ese swap, no quedaba NADA
        // visible: el pin desaparecía. Devolverle el display acá cierra
        // ese hueco, y es inocuo cuando ya estaba visible.
        const sEl = survivor.getElement?.();
        if (sEl && sEl.style.display === 'none') sEl.style.display = '';
        return;
      }
      this._renderClusterMarker(w.group, w.customDef, w.key);
    });
  }

  // Crea el marker del cluster (personalizado o automático) con doble
  // gesto: tap normal → abre el carrusel expandido (_openClusterExpand);
  // long-press (solo si SuperUserPanel dejó seteado this.onClusterCustomize)
  // → abre el panel de personalización, pasando el grupo actual y la
  // definición existente (o null si es la primera vez que se personaliza).
  _renderClusterMarker(group, customDef, key = null) {
    const centerLat = group.reduce((s, g) => s + g.ll.lat, 0) / group.length;
    const centerLng = group.reduce((s, g) => s + g.ll.lng, 0) / group.length;

    // NOTA: el ocultamiento de los pines miembros NO va acá. Vive en la
    // reconciliación de _updateClusters(), porque ahora esta función solo
    // corre para clusters NUEVOS — los que sobreviven a un pan no pasan por
    // acá, y sus pines igual tienen que seguir ocultos.

    const el = document.createElement('div');
    el.className = 'place-cluster-el';
    // De vuelta a 2x2 — agrandar este elemento (a 220x220) rompió el
    // centrado: MapLibre calcula el anchor 'center' MIDIENDO el tamaño
    // real del elemento en un momento en que puede no estar todavía
    // adjunto al DOM (offsetWidth/Height da 0 ahí), y con 2x2 ese error
    // de medición era invisible (~1px) pero con 220x220 se volvió un
    // desplazamiento de ~110px — los clusters aparecían mucho más abajo.
    // El will-change para el problema de la capa GPU va en el DIV
    // INTERNO de tamaño fijo (ver _buildClusterStickerHtml), que nunca
    // depende de que MapLibre lo mida — su tamaño lo define el CSS
    // directamente, sin ambigüedad posible.
    el.style.cssText = 'position:relative;width:2px;height:2px;overflow:visible;cursor:pointer;';
    el.innerHTML = _buildClusterStickerHtml(group, customDef);

    // Pin de ESTILO ÚNICO (un solo lugar — ver paso 3 de _updateClusters):
    // el tap NO abre el carrusel de cluster, abre el minicard normal del
    // lugar como cualquier pin. _showMiniCard trabaja sobre el wrapper "de
    // fábrica" de ese lugar (no sobre este sticker), así que se guarda la
    // referencia cruzada para poder hacer el swap en el click.
    // (el swap sticker↔wrapper se eliminó; el minicard se infla sobre el
    // propio sticker vía el marker guardado en el._clusterMarker)

    let pressTimer = null, longPressFired = false, startX = 0, startY = 0;
    let docMoveHandler = null, docUpHandler = null;
    el.addEventListener('pointerdown', (e) => {
      if (this._clusterModalOpen) return; // hay un panel de edición abierto (o recién cerrado) — ignorar
      if (pressTimer) { clearPress(); return; } // 2do dedo tocando el mismo elemento (pellizco) — cancelar, no reiniciar el timer
      longPressFired = false;
      startX = e.clientX; startY = e.clientY;
      pressTimer = setTimeout(() => {
        cleanupDocListeners();
        removeFromPendingList();
        longPressFired = true;
        this._cancelActiveClusterPress = null;
        if (this.onClusterCustomize) {
          this.haptic('longpress');
          this._clusterModalOpen = true;
          this.onClusterCustomize(group, customDef || null);
        }
      }, 550);
      this._cancelActiveClusterPress = clearPress; // ver map.on('dragstart')/('move') — cancela si arranca un drag real del mapa
      // Registrar este press como "pendiente" — _clearClusters() usa esta
      // lista para forzar la limpieza si el marker se destruye (re-cluster
      // por pan/zoom) mientras el dedo todavía está apoyado, evitando el
      // listener huérfano en `document` descrito arriba.
      if (!this._clusterPressCleanups) this._clusterPressCleanups = [];
      this._clusterPressCleanups.push(clearPress);
      // Trackear el movimiento a nivel de DOCUMENT, no solo de `el`: si el
      // dedo se corre apenas unos px fuera del contenido renderizado de
      // `el` (los huecos entre tarjetas tienen pointer-events:none), los
      // siguientes pointermove dejan de apuntarle a `el` y su propio
      // listener local deja de recibir nada — quedando el timer de
      // long-press corriendo sin ninguna forma de cancelarse a tiempo.
      // Escuchando en `document` nunca se pierde el rastro del dedo,
      // sin importar qué elemento tenga debajo en cada momento.
      docMoveHandler = (e2) => {
        if (pressTimer && (Math.abs(e2.clientX - startX) > 5 || Math.abs(e2.clientY - startY) > 5)) clearPress();
      };
      docUpHandler = () => clearPress();
      document.addEventListener('pointermove', docMoveHandler, { passive: true });
      document.addEventListener('pointerup', docUpHandler, { passive: true });
      document.addEventListener('pointercancel', docUpHandler, { passive: true });
    }, { passive: true });
    const cleanupDocListeners = () => {
      if (docMoveHandler) { document.removeEventListener('pointermove', docMoveHandler); docMoveHandler = null; }
      if (docUpHandler) { document.removeEventListener('pointerup', docUpHandler); document.removeEventListener('pointercancel', docUpHandler); docUpHandler = null; }
    };
    // Sacarse de la lista de "long-press pendientes" — solo debe quedar
    // en la lista mientras está genuinamente en curso (soltó el dedo, se
    // movió, o el long-press disparó con éxito), para que
    // _clearClusters() sepa a cuáles forzarles la limpieza si el marker
    // se destruye a mitad de un gesto realmente activo.
    const removeFromPendingList = () => {
      if (!this._clusterPressCleanups) return;
      const i = this._clusterPressCleanups.indexOf(clearPress);
      if (i !== -1) this._clusterPressCleanups.splice(i, 1);
    };
    const clearPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (this._cancelActiveClusterPress === clearPress) this._cancelActiveClusterPress = null;
      cleanupDocListeners();
      removeFromPendingList();
    };
    el.addEventListener('pointerup', clearPress, { passive: true });
    el.addEventListener('pointercancel', clearPress, { passive: true });
    el.addEventListener('pointerleave', clearPress, { passive: true });
    el._clusterClearPress = clearPress; // lo usa _destroyClusterMarker() al eliminar SOLO este cluster

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (longPressFired) { longPressFired = false; return; } // el long-press ya actuó, no abrir el carrusel también
      this.haptic('tap');
      this._openClusterExpand(group, customDef, el);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([centerLng, centerLat])
      .addTo(this.map);

    el._clusterMarker = marker; // lo usa el tap del pin de estilo único
    this.clusterMarkers.push(marker);
    if (key) {
      if (!this._clusterByKey) this._clusterByKey = new Map();
      this._clusterByKey.set(key, marker);
    }
  }

  // ── Carrusel expandido del cluster (pantalla completa, mapa de fondo) ──
  // Se abre a pantalla completa sobre el mapa real (blureado/oscurecido con
  // backdrop-filter — no es una captura, es el mapa vivo, así que sigue
  // reaccionando cuando lo paneamos). Un carrusel de tarjetas (scroll-snap
  // nativo) con una por lugar del cluster; mientras se desliza, el mapa de
  // fondo va paneando en vivo interpolando entre las coordenadas de la
  // tarjeta anterior y la siguiente según el progreso exacto del scroll
  // (no solo "salta" al soltar) — eso es lo que marca la ubicación real de
  // cada lugar a medida que se recorre el stack. Tap en una tarjeta = abre
  // la ficha completa de ese lugar (mismo _closeClusterExpand + onPlaceSelect
  // que usa el resto de la app).
  // ── Transición FLIP: del sticker del cluster a la pantalla collage ──
  // FLIP = First, Last, Invert, Play. En vez de abrir una pantalla nueva
  // con fade, se clonan las tarjetas/stickers/badge TAL COMO ESTÁN en el
  // mapa en este instante (First), se arma la pantalla final para saber
  // dónde deberían terminar (Last), y se anima cada clon desde su
  // posición real de arranque hasta ahí (Invert+Play) — el ojo lee la
  // pantalla nueva como si "creciera" del propio pin, no como un corte.
  _openClusterExpand(group, customDef, stickerEl) {
    if (this._clusterExpandEl) this._closeClusterExpand();

    // Red de seguridad: si una transición anterior falló a mitad de camino
    // (una excepción, un cierre interrumpido) y sus clones nunca se
    // sacaron del DOM, quedaban ahí para siempre — fixed, con z-index
    // altísimo, flotando sobre el mapa aunque el modal ya no exista. Eso
    // es justo el recuadro gris gigante que quedaba pegado en pantalla.
    // Antes de crear una transición nueva, se limpia cualquier resto de
    // una anterior.
    document.querySelectorAll('.wp-ce-flip-piece').forEach(n => n.remove());

    this._clusterExpandOrigCamera = { center: this.map.getCenter(), zoom: this.map.getZoom() };

    // ── First: dónde está cada pieza AHORA, en coordenadas de pantalla ──
    const pieces = [];
    if (stickerEl) {
      stickerEl.querySelectorAll('[data-card-idx]').forEach(n => pieces.push({ node: n, kind: 'card', idx: +n.getAttribute('data-card-idx'), rect: n.getBoundingClientRect() }));
      // NO se capturan badge/sticker del mapa acá a propósito — el slide
      // ya no hereda nada de eso (pedido explícito). Cada lugar arranca
      // sin decoraciones; se agregan desde el editor de esta pantalla.
      const labelN = stickerEl.querySelector('[data-label]');
      if (labelN) pieces.push({ node: labelN, kind: 'label', rect: labelN.getBoundingClientRect() });
    }
    const cardPieces = pieces.filter(p => p.kind === 'card').sort((a, b) => a.idx - b.idx);
    // Si no hay tarjeta (cluster recién creado, sin fotos todavía), no hay
    // nada que animar en FLIP — no debería pasar en uso normal, pero por
    // las dudas cae a abrir directo sin transición en vez de romper.
    const heroRect = cardPieces[0]?.rect || stickerEl?.getBoundingClientRect() || { left: innerWidth/2-1, top: innerHeight/2-1, width: 2, height: 2 };

    if (stickerEl) stickerEl.style.visibility = 'hidden'; // el clon lo reemplaza visualmente — se restaura al cerrar

    const vw = innerWidth, vh = innerHeight;

    // ── Keyframes continuos de posición según distancia al héroe ───────
    // d = idx - activeIdx. d=0 es el héroe (grande, al centro). Arrastrar
    // o tocar un chip cambia `activeIdx` de forma continua (no a saltos),
    // e interpolamos ENTRE estos puntos — así el drag es 1:1 con el dedo
    // y las tarjetas se van "pasando" el rol de héroe entre ellas en vivo,
    // en vez de tarjetas fijas con un carrusel scrolleando por encima.
    const heroW = Math.min(vw * 0.6, 290), heroH = heroW * 1.32;
    const heroX = vw / 2 - heroW / 2, heroY = vh * 0.46 - heroH / 2;
    // Antes esto tenía puntos hasta d=±3, o sea que con 4+ lugares se
    // veían varias tarjetas apiladas "por atrás" a la derecha, todas a
    // la vez. Ahora solo hay 3 posiciones visibles siempre: héroe +
    // 1 a la izquierda + 1 a la derecha. Un 4to lugar (d=2) no se ve
    // hasta que el drag lo acerca lo suficiente — recién ahí aparece
    // (fade-in) mientras el que queda atrás se pierde (fade-out) —
    // "avanzando", no una fila fija que se acumula.
    const KF = [
      { d: -1.5, x: -heroW * 0.72,               y: heroY + heroH * 0.30, w: heroW * 0.40, rot: -14, z: 5,  op: 0 },
      { d: -1,   x: -heroW * 0.62 * 0.32,        y: heroY + heroH * 0.22, w: heroW * 0.62, rot: -9,  z: 20, op: 1 },
      { d:  0,   x: heroX,                       y: heroY,                w: heroW,        rot: -2,  z: 30, op: 1 },
      { d:  1,   x: vw - heroW * 0.58 * 0.66,    y: heroY + heroH * 0.12, w: heroW * 0.58, rot: 8,   z: 20, op: 1 },
      { d:  1.5, x: vw + heroW * 0.06,           y: heroY + heroH * 0.26, w: heroW * 0.36, rot: 16,  z: 5,  op: 0 },
    ];
    const lerp = (a, b, t) => a + (b - a) * t;
    const posForDistance = (dRaw) => {
      const d = Math.max(KF[0].d, Math.min(KF[KF.length - 1].d, dRaw));
      let i = 0;
      while (i < KF.length - 2 && d > KF[i + 1].d) i++;
      const a = KF[i], b = KF[i + 1];
      const t = (b.d - a.d) === 0 ? 0 : (d - a.d) / (b.d - a.d);
      const w = lerp(a.w, b.w, t);
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w, h: w * 1.32, rot: lerp(a.rot, b.rot, t), z: lerp(a.z, b.z, t), op: lerp(a.op, b.op, t) };
    };

    // ── Overlay ────────────────────────────────────────────────────────
    const placeCount = group.length;
    const wrap = document.createElement('div');
    wrap.className = 'wp-ce-wrap wp-ce-collage';
    wrap.innerHTML = `
      <div class="wp-ce-collage-bg"></div>
      <div class="wp-ce-collage-header">
        <button type="button" class="wp-ce-cback" aria-label="Volver">
          <svg width="13" height="13" viewBox="0 0 32.75 32.75" fill="#000000"><path d="M32.75,16.377c0,2.209-1.791,4-4,4H12.646l3.754,4.42c1.431,1.684,1.224,4.207-0.46,5.638 c-0.752,0.64-1.672,0.95-2.587,0.95c-1.134,0-2.26-0.479-3.051-1.41l-9.351-11.01c-1.268-1.492-1.268-3.687,0-5.178l9.351-11.01 c1.431-1.684,3.954-1.89,5.638-0.459s1.891,3.954,0.46,5.638l-3.754,4.42H28.75C30.959,12.376,32.75,14.167,32.75,16.377z"/></svg>
        </button>
        <span class="wp-ce-ctitle">${placeCount} lugares</span>
        <div class="wp-ce-cactions">
          <button type="button" class="wp-ce-cbtn" aria-label="Compartir">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
          </button>
          <button type="button" class="wp-ce-cbtn" aria-label="Más opciones">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#000000"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM8.0002 13.3C8.71817 13.3 9.3002 12.7179 9.3002 12C9.3002 11.282 8.71817 10.7 8.0002 10.7C7.28223 10.7 6.7002 11.282 6.7002 12C6.7002 12.7179 7.28223 13.3 8.0002 13.3ZM16.0002 13.3C16.7182 13.3 17.3002 12.7179 17.3002 12C17.3002 11.282 16.7182 10.7 16.0002 10.7C15.2822 10.7 14.7002 11.282 14.7002 12C14.7002 12.7179 15.2822 13.3 16.0002 13.3ZM12.0002 13.3C12.7182 13.3 13.3002 12.7179 13.3002 12C13.3002 11.282 12.7182 10.7 12.0002 10.7C11.2822 10.7 10.7002 11.282 10.7002 12C10.7002 12.7179 11.2822 13.3 12.0002 13.3Z"/></svg>
          </button>
          ${this.onClusterCustomize ? `<button type="button" class="wp-ce-cbtn wp-ce-cedit" aria-label="Editar posiciones">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>` : ''}
        </div>
      </div>
      <div class="wp-ce-cstage"></div>
      <div class="wp-ce-ccaption">
        <div class="wp-ce-ccaption-list"></div>
      </div>`;
    document.body.appendChild(wrap);
    this._clusterExpandEl = wrap;
    document.body.style.overflow = 'hidden';

    const stage = wrap.querySelector('.wp-ce-cstage');
    const caption = wrap.querySelector('.wp-ce-ccaption-list');
    caption.innerHTML = group.map((_, i) => `<button type="button" class="wp-ce-ctag" data-chip-idx="${i}">${group[i].el._place?.name || ''}</button>`).join('');
    const chipEls = Array.from(caption.querySelectorAll('.wp-ce-ctag'));

    // ── Clonar cada pieza en su posición ACTUAL (First) ────────────────
    const clones = pieces.map(p => {
      const c = p.node.cloneNode(true);
      c.className = (c.className || '') + ' wp-ce-flip-piece';
      c.style.position = 'fixed';
      c.style.left = p.rect.left + 'px';
      c.style.top = p.rect.top + 'px';
      c.style.width = p.rect.width + 'px';
      c.style.height = p.rect.height + 'px';
      c.style.margin = '0'; c.style.transform = 'none';
      // 100000 porque .wp-ce-wrap (el fondo blanco + header) vive en
      // z-index:99999. TODO z-index que se le asigne a un clon de acá en
      // adelante — incluido el que fija el destino final más abajo — tiene
      // que ser >= 100000, si no el blanco de wrap los tapa apenas se
      // asienta la animación (pasó exactamente eso: la transición se veía
      // pero terminaba en blanco porque el destino bajaba el z-index a un
      // número chico, pensado solo para el orden ENTRE piezas, sin sumarle
      // esta base).
      c.style.zIndex = '100000';
      c.style.transition = 'none';
      c.removeAttribute('data-card-idx'); c.removeAttribute('data-sticker-idx');
      if (p.kind === 'card') c.style.cursor = 'pointer';
      document.body.appendChild(c);
      return { ...p, clone: c };
    });

    // ── El "render" central: dado un activeIdx (puede ser fraccional,
    // en pleno drag), calcula y aplica la posición de CADA pieza. Se
    // llama en cada frame de drag (sin transición CSS, 1:1 con el dedo)
    // y también para los saltos animados (chip, flick, snap al soltar).
    let activeIdx = 0;
    // Compartido con el editor de SuperUser más abajo: mientras se edita,
    // el sistema de navegación (drag/chip entre lugares) se desactiva —
    // si no, arrastrar para reposicionar un sticker también movería de
    // héroe, cambiando la referencia a mitad de la edición.
    let clusterEditing = false;

    // ── Decoraciones INDEPENDIENTES POR LUGAR ───────────────────────────
    // Cada lugar del grupo tiene su PROPIO set de badges/stickers para
    // esta pantalla — separado por completo de customDef.badges/stickers
    // (lo que ve el CLUSTER en el mapa). Editar acá nunca toca el mapa;
    // guardar acá nunca toca el mapa. slidePlaceDecos[i] = { badges, stickers },
    // cada entrada { dx, dy, rotation, scale, radius, baseW, baseH, clone, ...datos }.
    const placeIds = group.map(({ el }) => placeIdOf(el._place));
    const savedSlidePlaces = customDef?.slidePlaces || {};
    const slidePlaceDecos = group.map(() => ({ badges: [], stickers: [] }));
    // Estilo propio de CADA tarjeta en este slide — radio, color/ancho de
    // borde, giro y tamaño extra — también independiente del mapa.
    const slideCardStyles = group.map(() => ({ radius: null, borderColor: null, borderWidth: null, rotation: 0, scale: 1 }));

    const decoCap = (kind) => kind === 'badge' ? 2 : 8; // tope de escala vía pellizco — mismo rango que el slider de abajo

    // ── Stroke de sticker — MISMA técnica que usa el mapa (_buildClusterStickerHtml):
    // -webkit-text-stroke no pinta en emoji a color en casi ningún navegador,
    // así que el contorno se simula apilando copias del contenido en un
    // círculo de 12 puntos (texto) u 8 puntos + drop-shadow (imagen).
    const buildEmojiStroke = (strokeWidth, strokeColor) => {
      if (strokeWidth <= 0) return '0 2px 4px rgba(0,0,0,0.32)';
      const N = 12;
      const stack = Array.from({ length: N }, (_, k) => {
        const a = (k / N) * 2 * Math.PI;
        const x = +(Math.cos(a) * strokeWidth).toFixed(2), y = +(Math.sin(a) * strokeWidth).toFixed(2);
        return `${x}px ${y}px 0 ${strokeColor}`;
      }).join(',');
      return `${stack},0 2px 4px rgba(0,0,0,0.28)`;
    };
    const buildImageStroke = (strokeWidth, strokeColor) => {
      if (strokeWidth <= 0) return 'drop-shadow(0 2px 4px rgba(0,0,0,0.32))';
      const diag = +(strokeWidth * 0.7071).toFixed(2);
      return `drop-shadow(${strokeWidth}px 0 0 ${strokeColor}) drop-shadow(-${strokeWidth}px 0 0 ${strokeColor}) drop-shadow(0 ${strokeWidth}px 0 ${strokeColor}) drop-shadow(0 -${strokeWidth}px 0 ${strokeColor}) drop-shadow(${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.28))`;
    };

    // Crea el elemento DOM de una decoración nueva (sticker/badge), para
    // datos cargados desde lo guardado o agregados en vivo con el editor.
    // El sticker lleva un DIV INTERNO — el tamaño del CONTENEDOR lo pisa
    // applyLayout() (posición/parallax), pero el font-size/stroke del
    // CONTENIDO se actualiza aparte, ahí mismo, cada vez que cambia el
    // tamaño — si no, el contenido quedaba fijo mientras el contenedor
    // crecía alrededor.
    // Reconstruye el CONTENIDO interno de un sticker (emoji <-> imagen) sin
    // recrear el clon entero — así el usuario puede tipear un emoji o subir
    // una imagen desde el mismo panel y ver el cambio al instante, sin
    // perder posición/tamaño/selección.
    const rebuildDecoInner = (clone, data) => {
      const inner = clone.querySelector('.wp-ce-deco-inner');
      if (!inner) return;
      inner.innerHTML = '';
      if (data.emoji) {
        inner.style.fontFamily = "'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif";
        inner.style.lineHeight = '1';
        inner.textContent = data.emoji;
      } else if (data.imageUrl) {
        inner.style.fontFamily = ''; inner.style.lineHeight = '';
        inner.innerHTML = `<img src="${data.imageUrl}" style="width:100%;height:100%;object-fit:contain;">`;
      }
    };

    const createDecoClone = (kind, data) => {
      const c = document.createElement('div');
      c.className = 'wp-ce-flip-piece';
      c.style.position = 'fixed';
      // Fijar la rotación YA, sin transición, en el mismo momento en que
      // se crea el elemento — si no, la PRIMERA vez que applyLayout()
      // (animado) lo posiciona, el navegador transiciona el `transform`
      // desde "sin rotar" hasta la rotación guardada, y se ve como que
      // el sticker/badge entra girando en vez de con el pulse normal
      // (posición/tamaño/opacidad) que tiene todo lo demás.
      c.style.transform = data.rotation ? `rotate(${data.rotation}deg)` : 'none';
      // el z-index NO se fija acá — applyDecoStyle() lo recalcula cada
      // frame incluyendo layerZ (orden "Adelante"/"Atrás" del panel)
      c.style.pointerEvents = 'auto';
      c.style.boxSizing = 'border-box';
      if (kind === 'badge') {
        // padding FIJO a propósito (no escala con el tamaño) — el
        // tamaño y el font-size sí crecen juntos, eso lo hace
        // applyLayout() en cada frame.
        c.style.cssText += `display:flex;align-items:center;justify-content:center;padding:0 6px;border-radius:999px;background:${data.color || '#111827'};color:#fff;font-weight:800;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;`;
        c.textContent = data.label || '';
      } else {
        const inner = document.createElement('div');
        inner.className = 'wp-ce-deco-inner';
        inner.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;';
        c.appendChild(inner);
        rebuildDecoInner(c, data);
      }
      document.body.appendChild(c);
      return c;
    };

    // Todos los lugares arrancan IGUAL — sin heredar nada del sticker del
    // mapa (pedido explícito: badge/sticker del cluster ya no se heredan
    // al slide). Lo único que se carga es lo YA GUARDADO para ESTE slide.
    group.forEach((_, i) => {
      const saved = savedSlidePlaces[placeIds[i]];
      if (!saved) return;
      ['badges', 'stickers'].forEach(key => {
        const kind = key === 'badges' ? 'badge' : 'sticker';
        (saved[key] || []).forEach(d => {
          const clone = createDecoClone(kind, d);
          const entry = { ...d, clone };
          slidePlaceDecos[i][key].push(entry);
          clones.push({ node: null, kind, idx: i, rect: null, clone });
        });
      });
      // Estilo propio de ESTA tarjeta en el slide (radio, borde, giro,
      // tamaño extra) — también independiente del mapa.
      if (saved.cardStyle) slideCardStyles[i] = { ...saved.cardStyle };
    });

    // ── Decoraciones GLOBALES ("título para todos los slides") ─────────
    // A diferencia de las de arriba (atadas a un lugar y su tarjeta),
    // estas viven SIEMPRE en la misma posición de pantalla, sin importar
    // qué lugar esté de héroe — para un badge/sticker que querés que se
    // vea en TODO el recorrido, no solo en uno.
    const slideGlobal = { badges: [], stickers: [] };
    const savedGlobal = customDef?.slideGlobal || {};
    ['badges', 'stickers'].forEach(key => {
      const kind = key === 'badges' ? 'badge' : 'sticker';
      (savedGlobal[key] || []).forEach(d => {
        const clone = createDecoClone(kind, d);
        const entry = { ...d, clone };
        slideGlobal[key].push(entry);
        clones.push({ node: null, kind: kind + 'Global', idx: 0, rect: null, clone });
      });
    });

    const cleanupClones = () => clones.forEach(({ clone }) => clone && clone.remove());
    const cardClones = clones.filter(c => c.kind === 'card');

    // ── El "render" central: dado un activeIdx (puede ser fraccional,
    // en pleno drag), calcula y aplica la posición de CADA pieza. Se
    // llama en cada frame de drag (sin transición CSS, 1:1 con el dedo)
    // y también para los saltos animados (chip, flick, snap al soltar).
    //
    // Las decoraciones de cada lugar se anclan a SU PROPIA tarjeta (no a
    // "el héroe" global) — por eso al pasar del slide 1 al slide 2 no
    // saltan de golpe: cada set viaja pegado a su propia foto, que ya se
    // está deslizando con el mismo parallax que las tarjetas. Un lugar
    // que no es héroe se ve desplazado y con menos opacidad — igual que
    // su tarjeta — hasta que le toca ser el centro.
    const applyLayout = (idxVal, animated, opts = {}) => {
      const { duration = 0.36, stagger = 0, decoDelay = 0 } = opts;
      const cardPosByIdx = {};
      cardClones.forEach(({ idx, clone }, order) => {
        try {
          const p = posForDistance(idx - idxVal);
          const style = slideCardStyles[idx] || {};
          clone.style.transition = animated
            ? `left ${duration}s cubic-bezier(0.34,1.56,0.64,1), top ${duration}s cubic-bezier(0.34,1.56,0.64,1), width ${duration}s cubic-bezier(0.34,1.56,0.64,1), height ${duration}s cubic-bezier(0.34,1.56,0.64,1), transform ${duration}s cubic-bezier(0.34,1.56,0.64,1), opacity ${duration}s ease`
            : 'none';
          clone.style.transitionDelay = animated ? `${Math.min(order * stagger, stagger * 4)}ms` : '0ms';
          clone.style.left = p.x + 'px'; clone.style.top = p.y + 'px';
          clone.style.width = p.w + 'px'; clone.style.height = p.h + 'px';
          // El giro/tamaño EXTRA (style.rotation/scale) es propio de este
          // slide, encima del giro que ya trae el layout (p.rot) — ambos
          // conviven en el mismo transform.
          clone.style.transform = `rotate(${p.rot + (style.rotation || 0)}deg) scale(${style.scale ?? 1})`;
          clone.style.opacity = String(p.op);
          // radius/borderColor en null significa "no tocar" — el clon ya
          // trae SU PROPIO borde/radio heredado del mapa (cloneNode
          // conserva el style original); solo se pisa si el editor de
          // ESTE slide lo cambió a mano.
          if (style.radius != null) clone.style.borderRadius = style.radius + 'px';
          if (style.borderColor) clone.style.border = `${style.borderWidth || 2}px solid ${style.borderColor}`;
          // ver comentario en el clon inicial: nunca por debajo de 100000,
          // o el fondo blanco del wrap (99999) los tapa
          clone.style.zIndex = String(100000 + Math.round(p.z));
          clone.style.pointerEvents = p.op < 0.15 ? 'none' : 'auto';
          cardPosByIdx[idx] = p;
        } catch (err) {
          // Sin este catch, una excepción acá (por ejemplo un rect con
          // NaN) frenaba el forEach a mitad de camino y dejaba clones sin
          // reposicionar — la pantalla en blanco de una sesión anterior.
          console.error('[FLIP] error posicionando tarjeta', { idx }, err);
        }
      });

      // Aplica el tamaño/contenido de UNA decoración ya posicionada
      // (left/top ya resueltos aparte). Separado en un helper porque el
      // bloque "por lugar" y el "global" de abajo necesitan exactamente
      // lo mismo, solo cambia de dónde sacan cx/cy.
      const applyDecoStyle = (d, kind, w, h, cardZ) => {
        // Orden de capas ("Adelante"/"Atrás"): para decoraciones LOCALES
        // (atadas a un lugar), cardZ es el z de SU PROPIA tarjeta en este
        // instante — layerZ es un offset relativo a ESA tarjeta, no a un
        // piso fijo. Antes el piso (zBase=35) estaba SIEMPRE por encima
        // del máximo z de cualquier tarjeta (30) — o sea que un sticker
        // JAMÁS podía quedar detrás de su foto, sin importar cuántas
        // veces tocaras "Atrás": por eso el drag lo "devolvía" adelante
        // en cuanto la tarjeta volvía a ser héroe, y por eso con un solo
        // sticker el botón no tenía ningún vecino con quien
        // intercambiarse y no hacía nada. Ahora layerZ se suma al z REAL
        // de la tarjeta, así que un valor negativo lo manda genuinamente
        // detrás — y esa relación se mantiene sin importar en qué
        // posición del parallax esté la tarjeta en cada momento.
        d.clone.style.zIndex = String(100000 + cardZ + (d.layerZ ?? 5));
        if (kind === 'badge') {
          // Tamaño y font-size crecen JUNTOS; el padding queda fijo — es
          // lo que se pidió, y es la misma sensación que un badge del
          // cluster del mapa al agrandarlo.
          const totalScale = h / (d.baseH || 22);
          d.clone.style.minWidth = w + 'px';
          d.clone.style.height = h + 'px';
          d.clone.style.width = '';
          d.clone.style.fontSize = (11.5 * totalScale) + 'px';
          d.clone.style.borderRadius = '999px';
        } else {
          d.clone.style.width = w + 'px'; d.clone.style.height = h + 'px';
          const totalScale = h / (d.baseH || 26);
          const liveStroke = (d.strokeWidth ?? 2) * totalScale;
          const inner = d.clone.firstElementChild;
          if (inner) {
            const blurPx = d.blur || 0;
            if (d.emoji) {
              inner.style.fontSize = h + 'px';
              inner.style.textShadow = buildEmojiStroke(liveStroke, d.strokeColor || '#ffffff');
              inner.style.filter = blurPx ? `blur(${blurPx}px)` : 'none';
            } else if (d.imageUrl) {
              const img = inner.querySelector('img');
              if (img) img.style.filter = buildImageStroke(liveStroke, d.strokeColor || '#ffffff') + (blurPx ? ` blur(${blurPx}px)` : '');
            }
          }
        }
      };

      slidePlaceDecos.forEach((deco, i) => {
        const p = cardPosByIdx[i];
        if (!p) return;
        const scaleRef = p.w / heroW;
        const cx0 = p.x + p.w / 2, cy0 = p.y + p.h / 2;
        [
          ...deco.badges.map(d => ({ d, kind: 'badge' })),
          ...deco.stickers.map(d => ({ d, kind: 'sticker' })),
        ].forEach(({ d, kind }) => {
          try {
            const w = d.baseW * scaleRef * (d.scale ?? 1);
            const h = d.baseH * scaleRef * (d.scale ?? 1);
            const cx = cx0 + d.dx * scaleRef;
            const cy = cy0 + d.dy * scaleRef;
            // Primera vez que esta decoración se posiciona: el clon nace
            // con position:fixed pero SIN left/top todavía, así que el
            // navegador lo deja en su rincón de origen (arriba a la
            // izquierda) hasta que algo lo mueva — y como la PRIMERA vez
            // que lo movemos es con transición animada, se ve como que
            // "entra viajando desde arriba" en vez de aparecer con el
            // pulse (que es lo que sí les pasa a las tarjetas, porque
            // ESAS arrancan ya ancladas en la posición real del sticker
            // del mapa). Acá no hay una posición previa real — se la
            // inventa: fijar YA, sin transición, la posición/tamaño/blur
            // FINALES pero invisible y un poco más chico, forzar un
            // reflow, y recién ahí dejar que la transición de abajo
            // anime nada más que opacidad+escala — un pulse genuino en
            // el lugar que le toca, sin viaje.
            if (!d._entered) {
              d._entered = true;
              d.clone.style.transition = 'none';
              d.clone.style.left = (cx - w / 2) + 'px'; d.clone.style.top = (cy - h / 2) + 'px';
              applyDecoStyle(d, kind, w, h, p.z);
              d.clone.style.transform = `${d.rotation ? `rotate(${d.rotation}deg) ` : ''}scale(0.4)`;
              d.clone.style.opacity = '0';
              void d.clone.offsetHeight; // forzar reflow — sin esto el navegador podía "fusionar" este estado con el siguiente y saltarse el snap
            }
            d.clone.style.transition = animated
              ? `left ${duration}s cubic-bezier(0.34,1.56,0.64,1), top ${duration}s cubic-bezier(0.34,1.56,0.64,1), width ${duration}s ease, height ${duration}s ease, transform ${duration}s cubic-bezier(0.34,1.56,0.64,1), opacity ${duration}s ease`
              : 'none';
            d.clone.style.transitionDelay = animated ? `${decoDelay}ms` : '0ms';
            d.clone.style.left = (cx - w / 2) + 'px'; d.clone.style.top = (cy - h / 2) + 'px';
            applyDecoStyle(d, kind, w, h, p.z);
            d.clone.style.transform = d.rotation ? `rotate(${d.rotation}deg)` : 'none';
            d.clone.style.opacity = String(p.op * (d.opacity ?? 1)); // fade por distancia × opacidad propia del sticker
            d.clone.style.pointerEvents = p.op < 0.15 ? 'none' : 'auto';
          } catch (err) {
            console.error('[FLIP] error posicionando decoración', { place: i }, err);
          }
        });
      });

      // ── Decoraciones GLOBALES — SIEMPRE en la misma posición, sin
      // importar qué lugar sea héroe ahora. "Título para todos los
      // slides": no se desvanecen ni se mueven con el drag.
      const gx0 = heroX + heroW / 2, gy0 = heroY - 26; // arriba de la tarjeta héroe, centrado
      [
        ...slideGlobal.badges.map(d => ({ d, kind: 'badge' })),
        ...slideGlobal.stickers.map(d => ({ d, kind: 'sticker' })),
      ].forEach(({ d, kind }) => {
        try {
          const w = d.baseW * (d.scale ?? 1), h = d.baseH * (d.scale ?? 1);
          const cx = gx0 + d.dx, cy = gy0 + d.dy;
          // Mismo motivo que en las decoraciones por lugar: sin esto, la
          // primera vez que aparece se ve "viajar" desde el rincón donde
          // el navegador deja un position:fixed sin left/top todavía.
          if (!d._entered) {
            d._entered = true;
            d.clone.style.transition = 'none';
            d.clone.style.left = (cx - w / 2) + 'px'; d.clone.style.top = (cy - h / 2) + 'px';
            applyDecoStyle(d, kind, w, h, 60);
            d.clone.style.transform = `${d.rotation ? `rotate(${d.rotation}deg) ` : ''}scale(0.4)`;
            d.clone.style.opacity = '0';
            void d.clone.offsetHeight;
          }
          d.clone.style.transition = animated ? `left ${duration}s ease, top ${duration}s ease, transform ${duration}s cubic-bezier(0.34,1.56,0.64,1), opacity ${duration}s ease` : 'none';
          d.clone.style.transitionDelay = animated ? `${decoDelay}ms` : '0ms';
          d.clone.style.left = (cx - w / 2) + 'px'; d.clone.style.top = (cy - h / 2) + 'px';
          applyDecoStyle(d, kind, w, h, 60);
          d.clone.style.transform = d.rotation ? `rotate(${d.rotation}deg)` : 'none';
          d.clone.style.opacity = String(d.opacity ?? 1); // las globales no se desvanecen por distancia, pero sí respetan su propia opacidad
        } catch (err) {
          console.error('[FLIP] error posicionando decoración global', err);
        }
      });
    };

    const updateChips = (idxVal) => {
      const nearest = Math.max(0, Math.min(group.length - 1, Math.round(idxVal)));
      chipEls.forEach((chip, i) => chip.classList.toggle('wp-ce-ctag-active', i === nearest));
    };

    const clampIdx = (v) => Math.max(0, Math.min(group.length - 1, v));
    const settleTo = (idx, opts) => {
      activeIdx = clampIdx(idx);
      applyLayout(activeIdx, true, opts);
      updateChips(activeIdx);
    };

    requestAnimationFrame(() => {
      wrap.classList.add('wp-ce-in');
      // Segundo frame: recién acá se fija el destino, para que el browser
      // pinte primero la posición de arranque (si no, el navegador puede
      // colapsar ambos estados en uno y la transición no se ve).
      requestAnimationFrame(() => {
        // decoDelay: las decoraciones entran un toque DESPUÉS que las
        // tarjetas (que ya escalonan hasta stagger*4 = 140ms) — mismo
        // pulse, con un pequeño retraso para que se lea como remate en
        // vez de que todo aparezca junto.
        applyLayout(0, true, { duration: 0.52, stagger: 35, decoDelay: 180 });
        updateChips(0);
      });
    });

    // Header y caption entran con un pequeño rebote ("pulse"), un toque
    // después de que arrancó el FLIP — así el ojo primero sigue a las
    // fotos y el texto llega como remate, no todo junto de golpe.
    setTimeout(() => wrap.classList.add('wp-ce-chrome-in'), 260);

    // ── Drag real, 1:1 con el dedo, con parallax entre lugares ─────────
    // Los clones NO son hijos de `stage` (viven en document.body para
    // poder volar por encima de todo durante el FLIP), así que un
    // pointerdown sobre una tarjeta no burbujea hasta `stage` — por eso
    // esto se engancha en `document` y se filtra por la franja vertical
    // de `stage`, así el drag arranca sin importar si el dedo cae sobre
    // una foto o en el espacio vacío entre ellas.
    let dragging = false, dragStartX = 0, dragStartY = 0, dragBaseIdx = 0;
    let lastMoveX = 0, lastMoveT = 0, velocity = 0, totalMove = 0;
    const FLICK = 0.5; // px/ms — arriba de esto, un toque suelto avanza un lugar aunque no hayas cruzado la mitad
    const inStageBand = (e) => {
      const r = stage.getBoundingClientRect();
      return e.clientY >= r.top && e.clientY <= r.bottom;
    };
    const onDown = (e) => {
      if (this._clusterExpandEl !== wrap) return;
      if (clusterEditing) return;
      if (!inStageBand(e)) return;
      dragging = true; totalMove = 0;
      dragStartX = e.clientX; dragStartY = e.clientY; dragBaseIdx = activeIdx;
      lastMoveX = e.clientX; lastMoveT = performance.now(); velocity = 0;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      totalMove = Math.max(totalMove, Math.abs(dx), Math.abs(e.clientY - dragStartY));
      const now = performance.now();
      const dt = now - lastMoveT;
      if (dt > 0) velocity = (e.clientX - lastMoveX) / dt;
      lastMoveX = e.clientX; lastMoveT = now;
      const sensitivity = heroW * 1.05; // cuánto hay que arrastrar para "pasar" un lugar entero
      activeIdx = clampIdx(dragBaseIdx - dx / sensitivity);
      applyLayout(activeIdx, false);
      updateChips(activeIdx);
    };
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      if (totalMove < 8 && Math.abs(velocity) < FLICK) {
        // Fue un TAP, no un drag — ver qué tarjeta hay bajo el dedo.
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.wp-ce-flip-piece');
        const hitEntry = hit ? cardClones.find(c => c.clone === hit) : null;
        if (hitEntry) {
          const nearest = Math.round(activeIdx);
          if (hitEntry.idx === nearest) {
            // Tarjeta héroe → abre su ficha
            const place = group[hitEntry.idx]?.el._place;
            if (place) { this._closeClusterExpand(false); if (this.onPlaceSelect) this.onPlaceSelect(place); }
            return;
          }
          settleTo(hitEntry.idx); // tarjeta lateral → navega hacia ella
          return;
        }
      }
      let target = Math.round(activeIdx);
      if (Math.abs(velocity) > FLICK) target = Math.round(activeIdx) + (velocity < 0 ? 1 : -1);
      settleTo(target);
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointercancel', onUp, { passive: true });
    const cleanupDrag = () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    // Los chips son la navegación directa: tocar uno lleva a ese lugar
    // con el mismo parallax animado, y se marca de azul el que quedó
    // activo (updateChips ya lo hace en cada asentamiento).
    chipEls.forEach((chip, i) => chip.addEventListener('click', () => settleTo(i)));

    // ── Editor de SuperUser: elementos INDEPENDIENTES por lugar ────────
    // Solo se puede editar el lugar que está de héroe EN ESTE MOMENTO —
    // "cada vez que paso a un pin del slide, edito sus elementos, y esos
    // cambios no se aplican a los demás ni al cluster del mapa". Para
    // editar otro lugar: salir de edición, navegar (drag/chip) hasta que
    // ese lugar sea el héroe, y volver a entrar.
    //
    // Gesto: EXACTAMENTE el mismo mecanismo que el editor de cluster del
    // mapa (1 dedo = mover, 2 dedos = pellizco → distancia = tamaño,
    // ángulo = giro) — con la misma idea de "seleccionar y soltar": una
    // vez que algo está seleccionado, CUALQUIER punto de la pantalla
    // sirve para seguir moviéndolo/pellizcándolo, no hace falta que el
    // dedo esté justo arriba del elemento.
    const editBtn = wrap.querySelector('.wp-ce-cedit');
    if (editBtn && this.onClusterCustomize) {
      let editSel = null; // { kind: 'badge'|'sticker'|'card'|'badgeGlobal'|'stickerGlobal', obj, clone }
      let addGlobalNext = false; // checkbox del panel por defecto: el próximo "+ Badge"/"+ Sticker" va a slideGlobal en vez del lugar activo
      let applyCardStyleToAll = false; // "Aplicar a todas las tarjetas" — ver doSave()
      let editBackup = null; // snapshot del LUGAR que se está editando, para "Cancelar"
      let editPlace = 0;

      // Centraliza el contorno punteado de selección — mismo lenguaje
      // visual que el editor de cluster del mapa (outline celeste
      // punteado). Se limpia del anterior antes de ponerlo en el nuevo.
      const setEditSel = (resolved) => {
        if (editSel?.clone) { editSel.clone.style.outline = ''; editSel.clone.style.outlineOffset = ''; }
        editSel = resolved;
        if (editSel?.clone) { editSel.clone.style.outline = '2px dashed #67e8f9'; editSel.clone.style.outlineOffset = '2px'; }
        renderPanel();
      };

      const panel = document.createElement('div');
      panel.className = 'wp-ce-editpanel';
      wrap.appendChild(panel);

      // Encuentra a qué dato vivo corresponde un clon tocado — solo
      // dentro de lo que se puede editar ahora mismo: la tarjeta del
      // lugar activo, sus decoraciones propias, y las globales.
      const resolveClone = (clone) => {
        if (!clone) return null;
        const cardEntry = cardClones.find(c => c.clone === clone && c.idx === editPlace);
        if (cardEntry) return { kind: 'card', obj: slideCardStyles[editPlace], clone };
        const deco = slidePlaceDecos[editPlace];
        let f = deco.badges.find(d => d.clone === clone);
        if (f) return { kind: 'badge', obj: f, clone };
        f = deco.stickers.find(d => d.clone === clone);
        if (f) return { kind: 'sticker', obj: f, clone };
        f = slideGlobal.badges.find(d => d.clone === clone);
        if (f) return { kind: 'badgeGlobal', obj: f, clone };
        f = slideGlobal.stickers.find(d => d.clone === clone);
        if (f) return { kind: 'stickerGlobal', obj: f, clone };
        return null;
      };
      const isDeco = (kind) => kind !== 'card';
      const baseKindFor = (kind) => kind.replace('Global', '');

      const renderPanel = () => {
        if (!clusterEditing) { panel.classList.remove('wp-ce-editpanel-in'); panel.innerHTML = ''; return; }
        if (!editSel) {
          panel.innerHTML = `
            <div class="wp-ce-edithint">Editando "${group[editPlace]?.el._place?.name || ''}" — tocá un badge, sticker o la foto</div>
            ${group.length > 1 ? `<div class="wp-ce-editrow" style="align-items:center;">
              <span style="color:#9ca3af;font-size:11px;font-weight:700;flex:1;">Orden: puesto ${editPlace + 1} de ${group.length}</span>
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="moveleft" ${editPlace === 0 ? 'disabled' : ''} title="Mover antes">◀</button>
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="moveright" ${editPlace === group.length - 1 ? 'disabled' : ''} title="Mover después">▶</button>
            </div>` : ''}
            <label style="display:flex;align-items:center;gap:6px;color:#9ca3af;font-size:11px;font-weight:700;margin-bottom:8px;">
              <input type="checkbox" data-ctl="globaltoggle" ${addGlobalNext ? 'checked' : ''}> Agregar como título global (todos los slides)
            </label>
            <div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn" data-act="addbadge">+ Badge</button>
              <button type="button" class="wp-ce-editbtn" data-act="addsticker">+ Sticker</button>
            </div>
            <div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-primary" data-act="save">Guardar</button>
              <button type="button" class="wp-ce-editbtn" data-act="cancel">Cancelar</button>
            </div>`;
          panel.querySelector('[data-ctl="globaltoggle"]').addEventListener('change', (e) => { addGlobalNext = e.target.checked; });
        } else if (editSel.kind === 'card') {
          const sd = editSel.obj;
          panel.innerHTML = `
            <div class="wp-ce-edithint">Foto de "${group[editPlace]?.el._place?.name || ''}" — pellizcá para girar/agrandar</div>
            <label class="wp-ce-editslider">Borde redondeado<input type="range" min="0" max="50" step="1" value="${sd.radius ?? 0}" data-ctl="cradius"></label>
            <div class="wp-ce-editrow" style="align-items:center;">
              <span style="color:#9ca3af;font-size:11px;font-weight:700;flex:1;">Color de borde</span>
              <input type="color" value="${sd.borderColor || '#ffffff'}" data-ctl="cbcolor" style="width:36px;height:28px;border:none;border-radius:6px;background:none;padding:0;">
              <input type="range" min="0" max="10" step="1" value="${sd.borderWidth ?? 0}" data-ctl="cbwidth" style="flex:1;">
            </div>
            <div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn" data-act="resetcard">Restablecer</button>
              <button type="button" class="wp-ce-editbtn" data-act="deselect">Listo</button>
            </div>
            ${group.length > 1 ? `<div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-primary" data-act="applyallcards">Aplicar a las ${group.length} tarjetas</button>
            </div>` : ''}
            <div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-primary" data-act="save">Guardar</button>
              <button type="button" class="wp-ce-editbtn" data-act="cancel">Cancelar</button>
            </div>`;
          panel.querySelector('[data-ctl="cradius"]').addEventListener('input', (e) => { sd.radius = +e.target.value; applyLayout(activeIdx, false); });
          panel.querySelector('[data-ctl="cbcolor"]').addEventListener('input', (e) => { sd.borderColor = e.target.value; sd.borderWidth = sd.borderWidth || 3; applyLayout(activeIdx, false); });
          panel.querySelector('[data-ctl="cbwidth"]').addEventListener('input', (e) => { sd.borderWidth = +e.target.value; applyLayout(activeIdx, false); });
        } else {
          const sd = editSel.obj;
          const isGlobal = editSel.kind.includes('Global');
          const isBadge = editSel.kind.startsWith('badge');
          const label = isBadge ? 'Badge' : 'Sticker';
          const BADGE_PRESET = ['#111827', '#1a5cf5', '#f97316', '#ef4444', '#10b981', '#8b5cf6']; // mismos colores que el editor de cluster
          panel.innerHTML = `
            <div class="wp-ce-edithint">${label}${isGlobal ? ' (todos los slides)' : ` de "${group[editPlace]?.el._place?.name || ''}"`} — pellizcá para girar/agrandar</div>
            ${isBadge ? `<div style="display:flex;gap:6px;margin-bottom:8px;" data-ctl="colorrow"></div>` : ''}
            ${isBadge ? `<label class="wp-ce-editslider">Texto<input type="text" maxlength="40" value="${sd.label || ''}" placeholder="+N" data-ctl="text" style="flex:1;background:rgba(255,255,255,0.08);border:none;border-radius:6px;color:#fff;padding:6px 8px;font-size:12px;"></label>` : ''}
            ${!isBadge ? `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
              <div style="flex:1;">
                <div style="font-size:9px;color:#9ca3af;margin-bottom:3px;">Emoji</div>
                <input type="text" maxlength="8" value="${sd.emoji || ''}" data-ctl="emoji" style="width:100%;padding:6px;text-align:center;font-size:16px;border-radius:6px;border:none;background:rgba(255,255,255,0.08);color:#fff;box-sizing:border-box;">
              </div>
              <div style="font-size:9px;color:#6b7280;padding-top:14px;">o</div>
              <div style="flex:1;">
                <div style="font-size:9px;color:#9ca3af;margin-bottom:3px;">Imagen propia</div>
                <label data-ctl="uploadlabel" style="display:flex;align-items:center;justify-content:center;gap:4px;width:100%;padding:6px;border-radius:6px;border:1px dashed rgba(255,255,255,0.25);color:#9ca3af;font-size:10px;cursor:pointer;box-sizing:border-box;">
                  <span data-ctl="uploadspan">${sd.imageUrl ? '🖼️ Cambiar' : '📤 Subir'}</span>
                  <input type="file" accept="image/*" data-ctl="uploadfile" style="display:none;">
                </label>
              </div>
            </div>` : ''}
            <label class="wp-ce-editslider">Giro<input type="range" min="-180" max="180" step="1" value="${sd.rotation ?? 0}" data-ctl="rot"></label>
            <label class="wp-ce-editslider">Tamaño<input type="range" min="50" max="${isBadge ? 200 : 800}" step="1" value="${Math.round((sd.scale ?? 1) * 100)}" data-ctl="scale"></label>
            ${!isBadge ? `<div class="wp-ce-editrow" style="align-items:center;">
              <span style="color:#9ca3af;font-size:11px;font-weight:700;flex:1;">Contorno (stroke)</span>
              <input type="color" value="${sd.strokeColor || '#ffffff'}" data-ctl="strokecolor" style="width:36px;height:28px;border:none;border-radius:6px;background:none;padding:0;">
              <input type="range" min="0" max="6" step="1" value="${sd.strokeWidth ?? 2}" data-ctl="strokewidth" style="flex:1;">
            </div>
            <label class="wp-ce-editslider">Blur<input type="range" min="0" max="10" step="0.5" value="${sd.blur ?? 0}" data-ctl="blur"></label>
            <label class="wp-ce-editslider">Opacidad<input type="range" min="10" max="100" step="1" value="${Math.round((sd.opacity ?? 1) * 100)}" data-ctl="opacity"></label>` : ''}
            <div class="wp-ce-editrow wp-ce-editrow-compact">
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="layerback" title="Atrás">⬇️</button>
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="layerfront" title="Adelante">⬆️</button>
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="delthis" title="Eliminar">🗑️</button>
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-icon" data-act="deselect" title="Listo">✓</button>
            </div>
            <div class="wp-ce-editrow">
              <button type="button" class="wp-ce-editbtn wp-ce-editbtn-primary" data-act="save">Guardar</button>
              <button type="button" class="wp-ce-editbtn" data-act="cancel">Cancelar</button>
            </div>`;
          if (isBadge) {
            const row = panel.querySelector('[data-ctl="colorrow"]');
            BADGE_PRESET.forEach(c => {
              const b = document.createElement('button');
              b.type = 'button';
              b.style.cssText = `width:24px;height:24px;border-radius:50%;background:${c};border:2px solid ${c === (sd.color || '#111827') ? '#67e8f9' : 'rgba(255,255,255,0.25)'};cursor:pointer;`;
              b.addEventListener('click', () => { sd.color = c; editSel.clone.style.background = c; renderPanel(); });
              row.appendChild(b);
            });
            panel.querySelector('[data-ctl="text"]').addEventListener('input', (e) => { sd.label = e.target.value; editSel.clone.textContent = e.target.value || ''; });
          } else {
            // El teclado de emojis en móvil suele insertar el emoji como
            // una "composición" (IME) — mismo cuidado que el editor de
            // cluster: escuchar solo 'input' se pierde el emoji hasta que
            // algo más fuerza un 'input' final.
            const emojiEl = panel.querySelector('[data-ctl="emoji"]');
            const applyEmoji = (e) => {
              sd.emoji = e.target.value;
              if (e.target.value) sd.imageUrl = ''; // escribir emoji descarta la imagen propia
              rebuildDecoInner(editSel.clone, sd);
              applyLayout(activeIdx, false);
            };
            emojiEl.addEventListener('input', (e) => { if (!e.isComposing) applyEmoji(e); });
            emojiEl.addEventListener('compositionend', applyEmoji);
            panel.querySelector('[data-ctl="strokecolor"]').addEventListener('input', (e) => { sd.strokeColor = e.target.value; applyLayout(activeIdx, false); });
            panel.querySelector('[data-ctl="strokewidth"]').addEventListener('input', (e) => { sd.strokeWidth = +e.target.value; applyLayout(activeIdx, false); });
            panel.querySelector('[data-ctl="blur"]').addEventListener('input', (e) => { sd.blur = +e.target.value; applyLayout(activeIdx, false); });
            panel.querySelector('[data-ctl="opacity"]').addEventListener('input', (e) => { sd.opacity = +e.target.value / 100; applyLayout(activeIdx, false); });

            // Subir imagen propia — mismo mecanismo que el sticker del
            // cluster del mapa (comprimir a máx 300px + subir a Supabase
            // Storage).
            panel.querySelector('[data-ctl="uploadfile"]').addEventListener('change', async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (!file.type.startsWith('image/')) { alert('Solo imágenes.'); return; }
              if (file.size > 10 * 1024 * 1024) { alert('Imagen demasiado grande (máx 10 MB).'); return; }
              const uploadLabel = panel.querySelector('[data-ctl="uploadlabel"]');
              const uploadSpan = panel.querySelector('[data-ctl="uploadspan"]');
              uploadLabel.style.opacity = '0.5';
              uploadSpan.textContent = '⏳ Subiendo…';
              const compressImage = (f) => new Promise((resolve) => {
                const img = new Image();
                const url = URL.createObjectURL(f);
                img.onload = () => {
                  URL.revokeObjectURL(url);
                  const MAX = 300;
                  let w = img.width, h = img.height;
                  if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                  }
                  const canvas = document.createElement('canvas');
                  canvas.width = w; canvas.height = h;
                  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                  canvas.toBlob(resolve, 'image/png', 0.9);
                };
                img.src = url;
              });
              try {
                const compressed = await compressImage(file);
                const { getSupabase } = await import('/src/services/SupabaseService.js');
                const supabase = getSupabase();
                if (!supabase) throw new Error('Supabase no inicializado');
                const path = 'pins/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.png';
                const { error } = await supabase.storage.from('place-photos').upload(path, compressed, { contentType: 'image/png', upsert: false });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from('place-photos').getPublicUrl(path);
                sd.imageUrl = urlData.publicUrl;
                sd.emoji = ''; // subir imagen descarta el emoji
                rebuildDecoInner(editSel.clone, sd);
                applyLayout(activeIdx, false);
                renderPanel();
              } catch (err) {
                alert('Error al subir el sticker: ' + err.message);
                uploadLabel.style.opacity = '';
                uploadSpan.textContent = sd.imageUrl ? '🖼️ Cambiar' : '📤 Subir';
              } finally {
                e.target.value = '';
              }
            });
          }
          panel.querySelector('[data-ctl="rot"]').addEventListener('input', (e) => { sd.rotation = +e.target.value; applyLayout(activeIdx, false); });
          panel.querySelector('[data-ctl="scale"]').addEventListener('input', (e) => { sd.scale = +e.target.value / 100; applyLayout(activeIdx, false); });
        }
        panel.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => onPanelAction(b.getAttribute('data-act'))));
        requestAnimationFrame(() => panel.classList.add('wp-ce-editpanel-in'));
      };

      // ── Gesto unificado: 1 dedo mueve, 2 dedos pellizcan (tamaño +
      // giro) — igual que el editor de cluster. Se engancha en `document`
      // (no en un contenedor chico) porque las piezas están repartidas
      // por TODA la pantalla; "cualquier parte del slide" es literal.
      const pts = new Map();
      let mode = null, gstart = null;
      const gdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const gangle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

      const onGestureDown = (e) => {
        if (!clusterEditing) return;
        if (e.target.closest('.wp-ce-editpanel')) return;
        if (pts.size === 0) {
          const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.wp-ce-flip-piece');
          let resolved = hit ? resolveClone(hit) : null;
          // Las tarjetas ocupan casi toda la pantalla — si ya había un
          // badge/sticker seleccionado y el toque cae sobre una tarjeta
          // (no sobre el elemento chico en sí), NO robarle la selección:
          // se sigue controlando lo que ya estaba activo. Recién si no
          // hay nada seleccionado, tocar la tarjeta la selecciona a ELLA.
          if (resolved && resolved.kind === 'card' && editSel && editSel.kind !== 'card') {
            resolved = null;
          }
          if (resolved) {
            const isDifferent = !editSel || editSel.clone !== resolved.clone;
            if (isDifferent) setEditSel(resolved);
          } else if (!editSel) {
            return; // nada seleccionado y tocaste una zona sin nada — no hay qué mover
          }
          // si ya había algo seleccionado y tocaste una zona vacía, se
          // sigue controlando ESO — no hace falta estar justo encima
        }
        if (!editSel) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) {
          mode = 'drag';
          gstart = { dx: editSel.obj.dx || 0, dy: editSel.obj.dy || 0, p: [...pts.values()][0] };
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          mode = 'pinch';
          gstart = { dist: gdist(a, b) || 1, angle: gangle(a, b), scale: editSel.obj.scale ?? 1, rotation: editSel.obj.rotation || 0 };
        }
      };
      const onGestureMove = (e) => {
        if (!pts.has(e.pointerId) || !editSel) return;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'drag' && pts.size === 1 && isDeco(editSel.kind)) {
          // Las tarjetas ('card') no se arrastran — su posición la maneja
          // el layout automático; solo se pellizcan (giro/tamaño extra).
          const p = [...pts.values()][0];
          editSel.obj.dx = gstart.dx + (p.x - gstart.p.x);
          editSel.obj.dy = gstart.dy + (p.y - gstart.p.y);
          applyLayout(activeIdx, false);
        } else if (mode === 'pinch' && pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = gdist(a, b) || 1;
          const ratio = d / gstart.dist;
          const cap = editSel.kind === 'card' ? 1.8 : decoCap(baseKindFor(editSel.kind));
          editSel.obj.scale = Math.max(0.4, Math.min(cap, gstart.scale * ratio));
          editSel.obj.rotation = Math.round(gstart.rotation + (gangle(a, b) - gstart.angle));
          applyLayout(activeIdx, false);
        }
      };
      const onGestureUp = (e) => {
        pts.delete(e.pointerId);
        if (pts.size === 0) {
          mode = null;
        } else if (pts.size === 1 && editSel && isDeco(editSel.kind)) {
          // pasó de pellizco a un solo dedo sin soltar del todo: retoma
          // el drag desde la posición actual, sin saltos.
          mode = 'drag';
          const p = [...pts.values()][0];
          gstart = { dx: editSel.obj.dx || 0, dy: editSel.obj.dy || 0, p };
        }
      };

      // Agrega un badge o sticker VIVO — al lugar activo, o a la lista
      // global si se eligió "título para todos los slides".
      const addLiveDecoration = (kind, data, global) => {
        const base = { dx: 0, dy: kind === 'badge' ? -28 : 0, rotation: 0, scale: 1, radius: 0, opacity: 1, blur: 0, baseW: kind === 'badge' ? 22 : 26, baseH: kind === 'badge' ? 22 : 26, strokeColor: '#ffffff', strokeWidth: 2, ...data };
        const clone = createDecoClone(kind, base);
        const entry = { ...base, clone };
        if (global) {
          (kind === 'badge' ? slideGlobal.badges : slideGlobal.stickers).push(entry);
          clones.push({ node: null, kind: kind + 'Global', idx: 0, rect: null, clone });
          setEditSel({ kind: kind + 'Global', obj: entry, clone });
        } else {
          (kind === 'badge' ? slidePlaceDecos[editPlace].badges : slidePlaceDecos[editPlace].stickers).push(entry);
          clones.push({ node: null, kind, idx: editPlace, rect: null, clone });
          setEditSel({ kind, obj: entry, clone });
        }
        applyLayout(activeIdx, false);
      };

      // Reordenar lugares — intercambia TODO lo que corresponde a la
      // posición i con la posición j: a qué lugar apunta, sus
      // decoraciones propias, el estilo de su tarjeta, y el place_id que
      // se manda a guardar (que es lo que también reordena el cluster en
      // el MAPA — comparten el mismo array). Se aplica en vivo; recién
      // queda permanente al tocar "Guardar".
      const swapPlaces = (i, j) => {
        if (i < 0 || j < 0 || i >= group.length || j >= group.length) return;
        [group[i], group[j]] = [group[j], group[i]];
        [placeIds[i], placeIds[j]] = [placeIds[j], placeIds[i]];
        [slidePlaceDecos[i], slidePlaceDecos[j]] = [slidePlaceDecos[j], slidePlaceDecos[i]];
        [slideCardStyles[i], slideCardStyles[j]] = [slideCardStyles[j], slideCardStyles[i]];
        // Las piezas (tarjetas y decoraciones) llevan su posición como
        // `idx` — reasignarlo es lo que hace que applyLayout() las dibuje
        // en el lugar que corresponde a la NUEVA posición.
        clones.forEach(c => { if (c.idx === i) c.idx = -999; else if (c.idx === j) c.idx = i; });
        clones.forEach(c => { if (c.idx === -999) c.idx = j; });
        // Nombre visible en los chips de navegación
        const tmpText = chipEls[i].textContent;
        chipEls[i].textContent = chipEls[j].textContent;
        chipEls[j].textContent = tmpText;
        if (editPlace === i) editPlace = j; else if (editPlace === j) editPlace = i;
      };

      const onPanelAction = async (act) => {
        if (act === 'deselect') { setEditSel(null); applyLayout(activeIdx, false); return; }
        if (act === 'cancel') { exitEdit(); return; }
        if (act === 'moveleft') { swapPlaces(editPlace, editPlace - 1); settleTo(editPlace); renderPanel(); return; }
        if (act === 'moveright') { swapPlaces(editPlace, editPlace + 1); settleTo(editPlace); renderPanel(); return; }
        if (act === 'resetcard') {
          const sd = slideCardStyles[editPlace];
          sd.radius = null; sd.borderColor = null; sd.borderWidth = null; sd.rotation = 0; sd.scale = 1;
          renderPanel(); applyLayout(activeIdx, false);
          return;
        }
        if (act === 'applyallcards') {
          // Copia el estilo de ESTA tarjeta a TODAS las del cluster —
          // en vivo, ya mismo. doSave() usa applyCardStyleToAll para
          // saber que tiene que persistir el cardStyle de TODOS los
          // lugares, no solo el que se está editando.
          const style = { ...slideCardStyles[editPlace] };
          group.forEach((_, i) => { slideCardStyles[i] = { ...style }; });
          applyCardStyleToAll = true;
          applyLayout(activeIdx, false);
          return;
        }
        if (act === 'addbadge') { addLiveDecoration('badge', { label: 'Nuevo' }, addGlobalNext); return; }
        if (act === 'addsticker') { addLiveDecoration('sticker', { emoji: '⭐' }, addGlobalNext); return; }
        if (act === 'layerfront' || act === 'layerback') {
          if (!editSel) return;
          // Antes esto intercambiaba el valor con el "vecino" más
          // cercano en el mismo orden — igual que el editor de cluster
          // del mapa. Pero ahí SIEMPRE hay al menos 3-4 elementos
          // (tarjetas + stickers + badge) con quien intercambiar; acá es
          // normal tener un solo sticker en un lugar, y sin nadie con
          // quien cambiar, el botón no hacía nada. Ahora layerZ es un
          // offset respecto a la TARJETA propia (ver applyDecoStyle) y
          // el botón simplemente fuerza el cruce de signo — "Atrás"
          // siempre termina negativo (detrás de la foto), "Adelante"
          // siempre positivo — funciona aunque no haya ningún otro
          // elemento con quien compararse.
          const cur = editSel.obj.layerZ ?? 5;
          editSel.obj.layerZ = act === 'layerfront'
            ? (cur <= 0 ? 5 : cur + 3)
            : (cur >= 0 ? -5 : cur - 3);
          applyLayout(activeIdx, false);
          return;
        }
        if (act === 'delthis' && editSel) {
          const isGlobal = editSel.kind.includes('Global');
          const store = isGlobal ? slideGlobal : slidePlaceDecos[editPlace];
          const arrKey = editSel.kind.startsWith('badge') ? 'badges' : 'stickers';
          const arr = store[arrKey];
          const i = arr.indexOf(editSel.obj);
          if (i !== -1) arr.splice(i, 1);
          const ci = clones.findIndex(c => c.clone === editSel.clone);
          if (ci !== -1) clones.splice(ci, 1);
          editSel.clone.remove();
          setEditSel(null);
          applyLayout(activeIdx, false);
          return;
        }
        if (act === 'save') { await doSave(); }
      };

      const doSave = async () => {
        const saveBtn = panel.querySelector('[data-act="save"]');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }
        try {
          // Solo se manda el lugar que se editó + lo global — el resto de
          // slidePlaces (otros lugares) se preserva tal cual estaba.
          // badges/stickers/cards del CLUSTER (lo que ve el mapa) ni se
          // tocan ni se mandan de nuevo: este guardado es 100%
          // independiente de eso.
          // _entered es un flag de ESTA sesión (para que la animación de
          // entrada no se repita en cada frame) — no es un dato a
          // persistir. Si se guardara, la próxima vez que se cargue esta
          // decoración ya vendría marcada como "ya entró" y perdería el
          // pulse de apertura para siempre.
          const stripClone = (d) => { const { clone, _entered, ...rest } = d; return rest; };
          const mergedSlidePlaces = { ...savedSlidePlaces };
          mergedSlidePlaces[placeIds[editPlace]] = {
            badges: slidePlaceDecos[editPlace].badges.map(stripClone),
            stickers: slidePlaceDecos[editPlace].stickers.map(stripClone),
            cardStyle: { ...slideCardStyles[editPlace] },
          };
          // "Aplicar a todas las tarjetas": el cardStyle se replica a
          // TODOS los lugares del cluster — sus badges/stickers propios
          // NO se tocan (se preservan tal cual, solo se les pisa
          // cardStyle).
          if (applyCardStyleToAll) {
            group.forEach((_, i) => {
              if (i === editPlace) return;
              const prior = mergedSlidePlaces[placeIds[i]] || { badges: [], stickers: [] };
              mergedSlidePlaces[placeIds[i]] = { ...prior, cardStyle: { ...slideCardStyles[editPlace] } };
            });
          }
          const mergedGlobal = {
            badges: slideGlobal.badges.map(stripClone),
            stickers: slideGlobal.stickers.map(stripClone),
          };
          const res = await fetch('/api/supabase-clusters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: customDef?.id,
              place_ids: placeIds,
              cards: customDef?.cards || [],
              stickers: customDef?.stickers || [],
              badges: customDef?.badges || null,
              badge: customDef?.badge || null,
              label: customDef?.label || null,
              slidePlaces: mergedSlidePlaces,
              slideGlobal: mergedGlobal,
            }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message);
          if (customDef) {
            // placeIds (la copia local que usa este editor) y
            // customDef.placeIds son arrays DISTINTOS — reordenar uno
            // nunca tocaba el otro. Sin sincronizarlo acá, un reordenamiento
            // se veía perfecto en esta misma sesión pero desaparecía en
            // cuanto algo (o un reload) reconstruía el grupo desde
            // customDef.placeIds de nuevo, todavía en el orden viejo.
            customDef.placeIds = [...placeIds];
            customDef.slidePlaces = mergedSlidePlaces;
            customDef.slideGlobal = mergedGlobal;
          }
          // Traer del servidor la versión recién guardada — sin esto,
          // this.pinClusters seguía con los datos de ANTES de este
          // guardado hasta el próximo reload de la app entera.
          await this.reloadPinClusters();
          exitEdit(true);
        } catch (err) {
          alert('Error guardando: ' + err.message);
          if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
        }
      };

      const enterEdit = () => {
        clusterEditing = true;
        editPlace = Math.round(activeIdx);
        settleTo(editPlace); // asentar exacto en el lugar que se va a editar
        editBackup = {
          badges: slidePlaceDecos[editPlace].badges.map(d => ({ ...d })),
          stickers: slidePlaceDecos[editPlace].stickers.map(d => ({ ...d })),
          // TODOS los cardStyle, no solo el del lugar activo — "Aplicar a
          // todas las tarjetas" muta las de TODOS en vivo, y Cancelar
          // tiene que poder devolverlas todas, no solo la que se estaba
          // mirando.
          allCardStyles: slideCardStyles.map(s => ({ ...s })),
          globalBadges: slideGlobal.badges.map(d => ({ ...d })),
          globalStickers: slideGlobal.stickers.map(d => ({ ...d })),
        };
        wrap.classList.add('wp-ce-editing');
        renderPanel();
      };
      const exitEdit = (saved = false) => {
        if (editSel?.clone) { editSel.clone.style.outline = ''; editSel.clone.style.outlineOffset = ''; }
        clusterEditing = false; editSel = null; mode = null; pts.clear();
        applyCardStyleToAll = false;
        wrap.classList.remove('wp-ce-editing');
        panel.innerHTML = ''; panel.classList.remove('wp-ce-editpanel-in');
        if (!saved && editBackup) {
          // Cancelar (o cerrar sin guardar): volver TODO — posiciones,
          // agregados, borrados, estilo de tarjeta (de TODOS los
          // lugares, por si se usó "Aplicar a todas"), y lo global — a
          // como estaba al entrar a editar.
          const keepClones = new Set([
            ...editBackup.badges, ...editBackup.stickers,
            ...editBackup.globalBadges, ...editBackup.globalStickers,
          ].map(d => d.clone));
          const nowClones = new Set([
            ...slidePlaceDecos[editPlace].badges, ...slidePlaceDecos[editPlace].stickers,
            ...slideGlobal.badges, ...slideGlobal.stickers,
          ].map(d => d.clone));
          nowClones.forEach(c => { if (!keepClones.has(c)) c.remove(); });
          slidePlaceDecos[editPlace].badges = editBackup.badges;
          slidePlaceDecos[editPlace].stickers = editBackup.stickers;
          editBackup.allCardStyles.forEach((s, i) => { slideCardStyles[i] = s; });
          slideGlobal.badges = editBackup.globalBadges;
          slideGlobal.stickers = editBackup.globalStickers;
        }
        editBackup = null;
        applyLayout(activeIdx, true);
      };

      editBtn.addEventListener('click', () => { clusterEditing ? exitEdit() : enterEdit(); });
      document.addEventListener('pointerdown', onGestureDown, { capture: true });
      document.addEventListener('pointermove', onGestureMove, { passive: true });
      document.addEventListener('pointerup', onGestureUp, { passive: true });
      document.addEventListener('pointercancel', onGestureUp, { passive: true });
      this._clusterExpandEditCleanup = () => {
        document.removeEventListener('pointerdown', onGestureDown, { capture: true });
        document.removeEventListener('pointermove', onGestureMove);
        document.removeEventListener('pointerup', onGestureUp);
        document.removeEventListener('pointercancel', onGestureUp);
      };
    }

    const doClose = () => this._closeClusterExpand();
    wrap.querySelector('.wp-ce-cback').addEventListener('click', doClose);

    this._clusterExpandCleanup = () => { cleanupClones(); cleanupDrag(); if (this._clusterExpandEditCleanup) { this._clusterExpandEditCleanup(); this._clusterExpandEditCleanup = null; } };
    this._clusterExpandStickerEl = stickerEl;
    this._clusterExpandFlip = { clones, pieces, stickerEl };
  }

  _closeClusterExpand(restoreCamera = true) {
    if (!this._clusterExpandEl) return;
    const wrap = this._clusterExpandEl;
    const flip = this._clusterExpandFlip;
    this._clusterExpandEl = null;
    this._clusterExpandFlip = null;
    document.body.style.overflow = '';
    wrap.classList.remove('wp-ce-chrome-in');
    wrap.classList.remove('wp-ce-in');

    // Reverse-FLIP: los mismos clones vuelven a su posición ORIGINAL
    // (la del sticker en el mapa) antes de desaparecer — el cierre se ve
    // como el reflejo exacto de la apertura, no un simple fundido.
    if (flip) {
      flip.clones.forEach(({ rect, clone }) => {
        clone.style.transitionDelay = '0ms';
        if (!rect) {
          // Decoración propia de un lugar del slide (cargada desde lo
          // guardado, o agregada en vivo) — nunca existió en el sticker
          // del mapa, así que no tiene una posición "original" a la que
          // volver. Se desvanece nomás donde estaba, en vez de romper
          // con un rect.left de null.
          clone.style.opacity = '0';
          return;
        }
        clone.style.transform = 'none';
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
      });
    }

    setTimeout(() => {
      if (this._clusterExpandCleanup) this._clusterExpandCleanup();
      if (flip?.stickerEl) flip.stickerEl.style.visibility = '';
      wrap.remove();
    }, 380);

    if (restoreCamera && this._clusterExpandOrigCamera) {
      this.map.easeTo({ center: this._clusterExpandOrigCamera.center, zoom: this._clusterExpandOrigCamera.zoom, duration: 350 });
    }
    this._clusterExpandOrigCamera = null;
  }

  // ── Labels dinámicos por zoom + posición izquierda/derecha ──────────
  _updateLabelsProgressive() {
    if (this._labelTimers) this._labelTimers.forEach(t => clearTimeout(t));
    this._labelTimers = [];

    const zoom    = this.map.getZoom();
    const bounds  = this.map.getBounds();
    const screenW = this.map.getContainer().offsetWidth;

    // Ocultar todo si zoom < 16
    if (zoom < 16) {
      document.querySelectorAll('.place-marker-el .place-pin-label').forEach(l => {
        l.style.opacity = '0'; l.style.visibility = 'hidden';
      });
      return;
    }

    const lvl     = zoom >= 17 ? 'full' : zoom >= 16.5 ? 'mid' : 'small';
    const opacity = lvl === 'full' ? '1' : lvl === 'mid' ? '0.88' : '0.72';
    // Máximo de labels en pantalla según zoom — evita el amontonamiento
    const MAX_LABELS = lvl === 'full' ? 12 : lvl === 'mid' ? 8 : 5;

    const center = this.map.getCenter();
    const els = Array.from(document.querySelectorAll('.place-marker-el'));

    const candidates = els.map(el => {
      const idx = this.markerEls.indexOf(el);
      if (idx === -1) return null;
      const marker = this.markers[idx];
      if (!marker) return null;
      // No mostrar label si el pin está en modo punto o invisible
      if (!el._wpVisible) {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; lbl.style.visibility = 'hidden'; }
        return null;
      }
      if (el.classList.contains('featured-highlight')) {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; lbl.style.visibility = 'hidden'; }
        return null;
      }
      // Los pines featured (anillo naranja permanente, no solo el
      // centrado con zoom) tampoco muestran label lateral
      if (el._place?.featured) {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; lbl.style.visibility = 'hidden'; }
        return null;
      }
      const ll = marker.getLngLat();
      if (!bounds.contains(ll)) {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; lbl.style.visibility = 'hidden'; }
        return null;
      }
      // Posición en pantalla — recalculada cada vez para que left/right sea dinámico
      const pt   = this.map.project(ll);
      const side = pt.x > screenW / 2 ? 'left' : 'right';
      const dx   = ll.lng - center.lng, dy = ll.lat - center.lat;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const place    = el._place || {};
      const featured = place.featured ? 0 : 1;
      const rating   = -(parseFloat(place.rating) || 0);
      return { el, dist, side, pt, priority: featured * 1000 + rating * 10 + dist };
    }).filter(Boolean).sort((a, b) => a.priority - b.priority);

    // Ocultar labels de los que no entran
    candidates.forEach((item, i) => {
      const lbl = item.el.querySelector('.place-pin-label');
      if (lbl && i >= MAX_LABELS) {
        lbl.style.opacity     = '0';
        lbl.style.visibility  = 'hidden';
        item._labelHidden = true;
      }
    });

    const visible = candidates.slice(0, MAX_LABELS);

    visible.forEach(({ el, side }, i) => {
      const label = el.querySelector('.place-pin-label');
      if (!label) return;

      const pinW = el.querySelector('.place-pin-wrapper, .pin-dot')?.offsetWidth || 20;
      if (side === 'right') {
        label.style.left      = (pinW + 6) + 'px';
        label.style.right     = 'auto';
        label.style.transform = 'translateY(-50%)';
        label.style.textAlign = 'left';
      } else {
        label.style.left      = 'auto';
        label.style.right     = (pinW + 6) + 'px';
        label.style.transform = 'translateY(-50%)';
        label.style.textAlign = 'right';
      }

      // Aplicar modo pre-calculado — sin medir, sin setTimeout, sin parpadeo
      if (el._labelMultiline) {
        label.style.whiteSpace      = 'normal';
        label.style.display         = '-webkit-box';
        label.style.webkitLineClamp = '2';
        label.style.webkitBoxOrient = 'vertical';
        label.style.textOverflow    = '';
      } else {
        label.style.whiteSpace   = 'nowrap';
        label.style.display      = 'block';
        label.style.textOverflow = 'ellipsis';
      }
      label.style.overflow    = 'hidden';
      label.style.fontSize    = '12px';
      label.style.maxWidth    = '90px';
      label.style.visibility  = 'visible';
      label.style.transition  = 'opacity 0.22s ease';
      label.style.opacity     = opacity;
    });
  }

  // ── MiniCard ──────────────────────────────────────────────────────
  // markerOverride: para los pines de ESTILO CLUSTER el minicard se infla
  // sobre el propio sticker, no sobre el marker "de fábrica" del lugar.
  // Antes se intercambiaban los dos elementos (ocultar sticker / mostrar
  // wrapper), y ese swap era la fuente de todos los bugs de este flujo:
  // el pin volvía al estilo social, aparecían los dos encimados, o
  // desaparecía. Operando siempre sobre un único elemento no hay estados
  // intermedios que sincronizar.
  _showMiniCard(place, index, rawPhoto, skipMove = false, markerOverride = null) {
    this._closeMiniCard();
    const marker = markerOverride || this.markers[index];
    if (!marker) return;
    this.miniCardPlace  = place;
    this.miniCardMarker = marker;
    this.miniCardIndex  = index;
    this.haptic('tap');
    const wrapper = marker.getElement();
    if (!wrapper) return;

    const photoUrl  = proxyPhotoCard(rawPhoto);
    const rating    = place.rating ? `⭐ ${Number(place.rating).toFixed(1)}` : '';
    const address   = (place.formattedAddress || place.formatted_address || place.vicinity || '').substring(0, 32);
    const hasAct    = this._activityCount(place) > 0;
    const cardGrad  = hasAct ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#c4b5fd,#7dd3fc)';
    const cat       = this.currentCatData;

    // Guardar HTML del pin — solo si no hay uno ya guardado
    // (evita sobreescribir con minicard si la animación de salida está en curso)
    if (wrapper._savedPinHTML === undefined) {
      wrapper._savedPinHTML = wrapper.innerHTML;
    }
    wrapper.style.width    = 'auto';
    wrapper.style.height   = 'auto';
    wrapper.style.overflow = 'visible';
    wrapper.style.zIndex   = '9999';

    // El wrapper ENTERO se desplaza -45px (margin, no transform en un hijo)
    // para que la burbuja "flote" arriba del punto real. Es clave que sea
    // el wrapper completo el que se mueva: un transform en un div hijo deja
    // la caja natural del wrapper (la que usan tanto MapLibre para el
    // anchor:'center' como el navegador para detectar taps) parada en el
    // punto real, vacía pero SIGUE SIENDO CLICKEABLE ahí — eso generaba una
    // zona fantasma donde tocar el mapa "vacío" abría la ficha como si se
    // tocara el pin. Con margin-top en el wrapper, su caja clickeable se
    // mueve junto con lo que se ve — no queda ninguna zona vacía clickeable.
    wrapper.style.marginTop = '-45px';

    // Icono de fallback — se calcula SIEMPRE (sirve si no hay foto o si la foto falla)
    const mcSubIcon3d = getSubcatIcon3d(place, this.currentCatId);
    const mcIcon3d    = mcSubIcon3d || cat?.icon3d || '';
    const mcEmoji     = cat?.icon || '💎';
    const mcIconInner = mcIcon3d
      ? `<img src="${mcIcon3d}" style="width:26px;height:26px;object-fit:contain;" onerror="this.outerHTML='${mcEmoji}'">`
      : mcEmoji;
    const mcFallbackHtml = `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${cardGrad};border-radius:10px;font-size:22px;flex-shrink:0;">${mcIconInner}</div>`;

    // Punto negro de "sombra" — marca el punto real del pin. Como ahora es
    // el WRAPPER el que se desplaza -45px (ver arriba), este punto —que
    // vive dentro del mismo wrapper y por default quedaría centrado ahí
    // también— lleva el offset CONTRARIO (+45px) para terminar visualmente
    // en el punto real de nuevo, mientras la burbuja queda arriba.
    // pointer-events:none: es puramente decorativo, nunca debe interceptar
    // taps (si el usuario toca justo ahí, el tap debe pasar al mapa).
    const mcShadowDotHtml = `<div class="wp-mc-shadow-dot" style="position:absolute;left:50%;top:calc(50% + 45px);transform:translate(-50%,-50%);width:10px;height:4px;border-radius:50%;background:#1a1a1a;pointer-events:none;z-index:1;"></div>`;

    // Minicard — mismo estilo que las cards "sugeridos" del ActivityModal paso 2
    wrapper.innerHTML = `${mcShadowDotHtml}<div class="minicard-marker-content" style="display:flex;align-items:center;gap:10px;padding:9px 11px;background:rgba(255,255,255,0.72);backdrop-filter:blur(24px) saturate(1.8);-webkit-backdrop-filter:blur(24px) saturate(1.8);border-radius:20px;border:1.5px solid rgba(255,255,255,0.7);box-shadow:0 8px 28px rgba(0,0,0,0.13),inset 0 1px 0 rgba(255,255,255,0.9);cursor:pointer;max-width:230px;min-width:180px;-webkit-tap-highlight-color:rgba(0,0,0,0);user-select:none;font-family:'Inter Tight',system-ui,sans-serif;transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);">
      ${photoUrl
        ? `<div class="wp-mc-photo-wrap" style="width:44px;height:44px;border-radius:9px;flex-shrink:0;position:relative;overflow:hidden;background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);background-size:400% 100%;animation:wp-mc-skeleton 1.4s ease-in-out infinite;">
            <img src="${photoUrl}" data-fb-icon="${mcIcon3d}" data-fb-emoji="${mcEmoji}" data-fb-bg="${cardGrad}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.25s" onload="this.style.opacity=1;this.parentNode.style.animation='none';this.parentNode.style.background='none'" onerror="window._wpMcImgError(this)">
          </div>`
        : `<div style="width:44px;height:44px;border-radius:9px;background:${cardGrad};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;">${mcIconInner}</div>`}
      <div style="flex:1;min-width:0;overflow:hidden;">
        <div style="font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${place.name}</div>
        ${rating  ? `<div style="font-size:12px;color:#f59e0b;margin-top:1px;line-height:1.3;">${rating}</div>` : ''}
        ${address ? `<div style="font-size:11px;color:#9ca3af;margin-top:1px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${address}</div>` : ''}
      </div>
      <div style="width:28px;height:28px;border-radius:50%;background:#e5e5e5;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#9ca3af;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>`;

    const card = wrapper.querySelector('.minicard-marker-content');
    if (card) {
      animateMinicardIn(card);
      const pulse = () => {
        card.style.transform = 'scale(0.93)';
        setTimeout(() => { card.style.transform = ''; }, 150);
      };
      let tx = 0, ty = 0;
      card.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; pulse(); }, { passive: true });
      card.addEventListener('touchend', e => {
        if (Math.abs(e.changedTouches[0].clientX - tx) > 8 || Math.abs(e.changedTouches[0].clientY - ty) > 8) return;
        e.stopPropagation(); e.preventDefault();
        this.haptic('select');
        if (this.onPlaceSelect) this.onPlaceSelect(place);
      });
      card.addEventListener('click', e => {
        e.stopPropagation();
        pulse();
        this.haptic('select');
        if (this.onPlaceSelect) this.onPlaceSelect(place);
      });
    }

    const lat = place.location?.lat ?? place.lat;
    const lng = place.location?.lng ?? place.lng;
    if (lat && lng) {
      const vv      = window.visualViewport;
      const canvasH = this.map.getCanvas().clientHeight;
      const vvH     = vv ? vv.height : canvasH;
      const visibleH = Math.min(vvH, canvasH);

      const inSearch = document.body.classList.contains('wp-search-active') ||
                       !!(document.getElementById('wps-inner'));

      if (inSearch) {
        // En búsqueda: mismo cálculo que SearchBar.doFlyTo, respeta zoom actual
        const topbar  = document.getElementById('topbar-right-chip');
        const topEdge = topbar ? topbar.getBoundingClientRect().bottom + 8 : 68;
        const scats   = document.getElementById('wp-scats');
        const results = document.getElementById('wp-sresults');
        const botEl   = (scats && scats.offsetParent !== null) ? scats :
                        (results && results.offsetParent !== null) ? results : null;
        let botEdge   = botEl ? botEl.getBoundingClientRect().top - 8 : visibleH;
        botEdge = Math.max(botEdge, visibleH * 0.5);
        const areaCenter = topEdge + (botEdge - topEdge) / 2;
        const offsetY    = Math.round(areaCenter + 45 - canvasH / 2);
        if (!skipMove) this.map.easeTo({ center: [lng, lat], zoom: this.map.getZoom(), duration: 400, offset: [0, offsetY] });
        return;
      }

      // Modo normal: cálculo original
      const topbar  = document.getElementById('topbar-right-chip');
      const topEdge = topbar ? topbar.getBoundingClientRect().bottom + 8 : 68;

      const panel   = document.querySelector('.map-results-panel-float') || document.getElementById('map-results-panel');
      let botEdge;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const panelTop  = panelRect && panelRect.top > 0 && panelRect.top < visibleH ? panelRect.top : 9999;
      const scats2    = document.getElementById('wp-scats');
      const scatsTop  = scats2 && scats2.offsetParent !== null ? scats2.getBoundingClientRect().top : 9999;
      const msEl      = document.getElementById('wp-minisnap-panel');
      const msRect    = msEl ? msEl.getBoundingClientRect() : null;
      const msTop     = msRect && msRect.top > topEdge && msRect.top < visibleH ? msRect.top : 9999;

      const candidates = [panelTop, scatsTop, msTop].filter(v => v > topEdge + 50 && v < visibleH + 200);
      botEdge = candidates.length > 0 ? Math.min(...candidates) - 8 : visibleH - 8;

      const areaCenter = topEdge + (botEdge - topEdge) / 2;
      const pinTarget  = areaCenter + 35;
      const offsetY    = Math.round(pinTarget - canvasH / 2);

      if (!skipMove) this.map.easeTo({ center: [lng, lat], duration: 300, offset: [0, offsetY] });
    }
  }

  _closeMiniCard() {
    if (!this.miniCardMarker) return;
    // Capturar wrapper y limpiar estado YA — antes de cualquier animación
    // Así _showMiniCard puede pisar miniCardMarker sin race condition
    const wrapper = this.miniCardMarker.getElement();
    this.miniCardMarker  = null;
    this.miniCardIndex   = -1;
    this.miniCardPlace   = null;
    this._miniCardPinRoot  = null;
    this._miniCardMarkerEl = null;

    const card = wrapper && wrapper.querySelector('.minicard-marker-content');
    if (card) {
      // Animación de salida — restaurar pin al terminar
      const self = this;
      animateMinicardOut(card, function() {
        self._restorePin(wrapper);
      });
    } else {
      this._restorePin(wrapper);
    }
  }

  _restorePin(wrapper) {
    if (wrapper && wrapper._savedPinHTML !== undefined) {
      // El wrapper del marker (.place-marker-el) NUNCA tiene ancho/alto fijo
      // por CSS — se auto-dimensiona según su contenido (2x2px para el pin
      // "social", ~29px para el clásico, etc). Forzar '44px' acá (como
      // estaba antes) dejaba el wrapper con ese tamaño fijo PARA SIEMPRE
      // después de cerrar el minicard, sin importar el tamaño real del pin
      // restaurado. Como MapLibre centra la caja completa del wrapper
      // (anchor:'center') y el contenido no siempre queda perfectamente
      // centrado dentro de una caja más grande de lo que le corresponde,
      // esto corría el pin (visible sobre todo en vertical) cada vez que
      // se abría y cerraba el minicard. Reset a '' para que vuelva a
      // auto-dimensionarse exactamente como antes de abrir el minicard.
      wrapper.style.width     = '';
      wrapper.style.height    = '';
      wrapper.style.overflow  = 'visible';
      wrapper.style.zIndex    = '';
      wrapper.style.marginTop = '';
      wrapper.innerHTML = wrapper._savedPinHTML;
      delete wrapper._savedPinHTML;
      // Si el minicard se infló sobre un STICKER de cluster, el reset
      // genérico de arriba le borró su tamaño fijo (2x2 con overflow
      // visible). Sin reponerlo, el sticker pasa a auto-dimensionarse por
      // su contenido y MapLibre —que centra la caja del elemento— lo
      // dibuja corrido. Se le devuelve su cssText original.
      if (wrapper.classList.contains('place-cluster-el')) {
        wrapper.style.cssText = 'position:relative;width:2px;height:2px;overflow:visible;cursor:pointer;';
      }
      const z = this.map ? this.map.getZoom() : 0;
      wrapper.querySelectorAll('.place-act-badge').forEach(function(b) {
        b.style.opacity = z >= 15 ? '1' : '0';
      });
    }
    // Estado ya limpiado en _closeMiniCard — no tocar aquí
  }

  // ── Actividades ───────────────────────────────────────────────────
  _activityCount(place) {
    const pName = (place.name || '').toLowerCase().trim();
    const pId   = (place.place_id || place.placeId || '').toLowerCase();
    return this.activities.filter(a => {
      const aName = (a.place_name || '').toLowerCase().trim();
      const aId   = (a.place_id  || '').toLowerCase();
      return (pId && aId === pId) || (pName && aName === pName);
    }).length;
  }

  _refreshActivityBadges() {
    this.markerEls.forEach((el, i) => {
      const place = this.allPlaces[i]; if (!place) return;
      const count = this._activityCount(place);
      let badge = el.querySelector('.place-act-badge');
      if (count > 0) {
        if (!badge) { badge = document.createElement('div'); badge.className = 'place-act-badge'; el.querySelector('.place-pin-rel, div')?.appendChild(badge); }
        badge.textContent = count; badge.style.opacity = this.map.getZoom() >= 15 ? '1' : '0';
      } else if (badge) badge.remove();
    });
  }

  updateActivities(activities) { this.activities = activities; this._refreshActivityBadges(); }

  // ── Landmarks ─────────────────────────────────────────────────────
  _renderLandmarks(items) {
    if (items && items.length) this._allLandmarks = items;
    const cat = this.currentCatId;
    const filtered = (this._allLandmarks || []).filter(item => {
      if (!item.visible_in_categories || !item.visible_in_categories.length) return true;
      if (!cat) return true;
      return item.visible_in_categories.includes(cat);
    });
    items = filtered;
    this.landmarkMarkers.forEach(m => m.remove());
    this.landmarkMarkers = [];

    items.forEach(item => {
      if (!item.lat || !item.lng) return;
      const sizeMap  = { mini: 18, normal: 26, destacado: 46 };
      const fontSize = sizeMap[item.size] || 32;
      const borderColor = item.border_color || null;
      const color    = item.color || '#00bcd4';

      const el = document.createElement('div');
      el.className = 'lm-wrap';

      if (item.type === 'sticker') {
        const inner    = document.createElement('div');
        inner.className = 'lm-inner-slow';
        const strokeColor = borderColor || '#ffffff';
        const strokeW  = Math.round(Math.max(4, fontSize * 0.16));
        const pad      = Math.round(fontSize * 0.1);
        const totalSize = fontSize + pad * 2;

        const stickerWrap = document.createElement('div');
        stickerWrap.style.cssText = `position:relative;display:inline-flex;align-items:center;justify-content:center;width:${totalSize}px;height:${totalSize}px;user-select:none;`;

        if (item.icon_url) {
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.onload = () => {
            const dpr  = Math.min(window.devicePixelRatio || 1, 2);
            const strokeW = Math.round(Math.max(4, fontSize * 0.16));

            // ── Respetar aspect ratio de la imagen ──────────────────
            const natW = imgEl.naturalWidth  || 1;
            const natH = imgEl.naturalHeight || 1;
            const ratio = natW / natH;
            // Ajustar dimensiones manteniendo el área visual ≈ totalSize²
            let drawW, drawH;
            if (ratio >= 1) {
              drawW = totalSize;
              drawH = Math.round(totalSize / ratio);
            } else {
              drawH = totalSize;
              drawW = Math.round(totalSize * ratio);
            }

            const pad2 = Math.ceil(strokeW * dpr * 2);
            const cvW  = drawW * dpr + pad2 * 2;
            const cvH  = drawH * dpr + pad2 * 2;
            const cvs  = document.createElement('canvas');
            cvs.width  = cvW; cvs.height = cvH;
            const ctx  = cvs.getContext('2d');

            const cx = pad2, cy = pad2;
            const sz = { w: drawW * dpr, h: drawH * dpr };
            const bsz = { w: sz.w + strokeW * dpr * 2, h: sz.h + strokeW * dpr * 2 };
            const bx = cx - strokeW * dpr, by = cy - strokeW * dpr;

            // Stroke / borde
            ctx.drawImage(imgEl, bx, by, bsz.w, bsz.h);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = strokeColor; ctx.fillRect(0, 0, cvW, cvH);
            ctx.globalCompositeOperation = 'source-over';
            // Imagen original
            ctx.drawImage(imgEl, cx, cy, sz.w, sz.h);

            const out = document.createElement('img');
            out.src = cvs.toDataURL('image/png');
            out.style.cssText = `width:${drawW + strokeW * 2}px;height:${drawH + strokeW * 2}px;display:block;`;
            stickerWrap.style.width  = `${drawW + strokeW * 2}px`;
            stickerWrap.style.height = `${drawH + strokeW * 2}px`;
            stickerWrap.appendChild(out);
          };
          imgEl.onerror = () => {
            const fb = document.createElement('div');
            fb.style.cssText = `width:${totalSize}px;height:${totalSize}px;background:rgba(0,0,0,0.1);border-radius:8px;`;
            stickerWrap.appendChild(fb);
          };
          imgEl.src = item.icon_url;
        } else {
          const dpr  = Math.min(window.devicePixelRatio || 1, 2);
          const pad2 = Math.ceil(strokeW * dpr * 2);
          const cs   = totalSize * dpr + pad2 * 2;
          const cx   = cs / 2, cy = cs / 2;
          const cvs  = document.createElement('canvas');
          cvs.width = cs; cvs.height = cs;
          const ctx  = cvs.getContext('2d');
          const fontPx  = fontSize * dpr;
          const offsets = strokeW * dpr;
          ctx.font = `${fontPx + offsets * 2}px serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(item.emoji || '⭐', cx, cy);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = strokeColor; ctx.fillRect(0, 0, cs, cs);
          ctx.globalCompositeOperation = 'source-over';
          ctx.font = `${fontPx}px serif`;
          ctx.fillText(item.emoji || '⭐', cx, cy);
          const img = document.createElement('img');
          img.src = cvs.toDataURL('image/png');
          img.style.cssText = `width:${totalSize}px;height:${totalSize}px;display:block;`;
          stickerWrap.appendChild(img);
        }

        const shadow = document.createElement('div');
        shadow.className = 'lm-shadow-slow';
        shadow.style.cssText = 'width:20px;height:6px;margin-top:3px;';

        const iconCol = document.createElement('div');
        iconCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
        iconCol.appendChild(stickerWrap);
        iconCol.appendChild(shadow);
        inner.appendChild(iconCol);
        el.appendChild(inner);

        if (item.title && item.show_label !== false) {
          const seed  = item.id ? item.id.charCodeAt(0) % 600 : Math.random() * 600;
          const label = document.createElement('div');
          label.className = 'lm-label lm-sticker-label';
          label.textContent = item.title;
          // label_side: 'right' (default, comportamiento de siempre) | 'left'
          const isLeft = item.label_side === 'left';
          const sidePos = isLeft ? 'right:calc(100% + 3px)' : 'left:calc(100% + 3px)';
          const labelBg = item.label_color || 'rgba(10,10,20,0.78)';
          label.style.cssText = [
            'position:absolute', sidePos, 'top:50%',
            'transform:translateY(-60%)', 'white-space:nowrap',
            `background:${labelBg}`, 'color:#fff',
            'font-size:9px', 'font-weight:700',
            "font-family:'Inter Tight',system-ui,sans-serif",
            'padding:2px 6px', 'border-radius:20px', 'pointer-events:none',
            'opacity:1', `transition:opacity 0.4s ease ${seed}ms`,
            'max-width:90px', 'overflow:hidden', 'text-overflow:ellipsis',
            'border:1px solid rgba(255,255,255,0.12)',
            'backdrop-filter:blur(4px)', '-webkit-backdrop-filter:blur(4px)',
          ].join(';');
          inner.style.position = 'relative';
          inner.appendChild(label);
          el.style.overflow = 'visible';
        }

      } else {
        // Landmark normal
        const pinSize = 42;
        const inner   = document.createElement('div');
        inner.className = 'lm-inner';
        inner.style.cssText = 'gap:3px;';

        const label = document.createElement('div');
        label.style.cssText = 'background:white;border-radius:12px;padding:4px 10px;font-size:11px;font-weight:800;color:#1a1a2e;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);max-width:90px;overflow:hidden;text-overflow:ellipsis;font-family:\'Inter Tight\',system-ui,sans-serif;';
        label.textContent = item.title || '';

        const borderStyle = borderColor
          ? `box-shadow:0 0 0 3px ${borderColor},0 4px 12px rgba(0,0,0,0.3);`
          : `box-shadow:0 0 0 2px ${color}66,0 4px 12px rgba(0,0,0,0.3);`;
        const pin = document.createElement('div');
        pin.style.cssText = `width:${pinSize}px;height:${pinSize}px;border-radius:50%;background:linear-gradient(145deg,${color}dd 0%,${color} 50%,${color}99 100%);border:3px solid white;${borderStyle}display:flex;align-items:center;justify-content:center;font-size:20px;`;
        pin.textContent = item.emoji || '📍';

        const shadow = document.createElement('div');
        shadow.className = 'lm-shadow';
        shadow.style.cssText = 'width:24px;height:8px;margin-top:3px;';

        inner.appendChild(label);
        inner.appendChild(pin);
        inner.appendChild(shadow);
        el.appendChild(inner);
      }

      if (item.description) el.title = item.description;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([item.lng, item.lat])
        .addTo(this.map);
      this.landmarkMarkers.push(marker);
    });

    console.log('✅ Landmarks renderizados:', items.length);
  }

  // ── Featured Highlight — igual que el original ─────────────────────
  _clearFeaturedHighlight() {
    document.querySelectorAll('.place-marker-el.featured-highlight').forEach(el => {
      el.classList.remove('featured-highlight');
      const wrapper = el.querySelector('.place-pin-wrapper');
      const bubbleStack = el.querySelector('.place-pin-bubble-stack');
      const nameEl  = el.querySelector('.pin-featured-name');
      const shadow  = el.querySelector('.pin-featured-shadow');
      const badge   = el.querySelector('.pin-featured-badge');
      if (wrapper) {
        wrapper.style.transform = '';
        wrapper.style.boxShadow = wrapper.dataset.liquidShadow || wrapper._liquidShadow || '';
      }
      if (bubbleStack) {
        bubbleStack.style.transform = 'translateX(-50%)';
      }
      if (nameEl)  nameEl.remove();
      if (shadow)  shadow.remove();
      if (badge) {
        badge.style.display = 'flex';
        const place = el._place;
        if (place?.featured) {
          const bg   = place.featured==='verified'?'#059669':place.featured==='premium'?'#2563eb':'rgba(0,0,0,0.65)';
          const icon = place.featured==='verified'?'✓':'⭐';
          badge.style.background = bg; badge.innerHTML = icon;
        }
      }
      const lbl = el.querySelector('.place-pin-label');
      if (lbl) { lbl.style.opacity = ''; lbl.style.pointerEvents = ''; }
    });
    this._featuredHighlightEl = null;
  }

  _checkFeaturedNearCenter() {
    const container = this.map.getContainer();
    const cx = container.offsetWidth / 2;
    const cy = container.offsetHeight / 2;
    const ENTER = 100, EXIT = 180;
    let closest = null, closestDist = Infinity;
    document.querySelectorAll('.place-marker-el').forEach(el => {
      const place = el._place;
      if (!place?.featured) return;
      const marker = el._marker;
      if (!marker) return;
      const pt   = this.map.project(marker.getLngLat());
      const dist = Math.sqrt(Math.pow(pt.x-cx,2) + Math.pow(pt.y-cy,2));
      if (dist < ENTER && dist < closestDist) { closestDist = dist; closest = { el, place }; }
    });
    if (closest && closest.el === this._featuredHighlightEl) return;
    if (!closest && this._featuredHighlightEl) {
      const pm = this._featuredHighlightEl._marker;
      if (pm) {
        const pt = this.map.project(pm.getLngLat());
        if (Math.sqrt(Math.pow(pt.x-cx,2)+Math.pow(pt.y-cy,2)) < EXIT) return;
      }
    }
    this._clearFeaturedHighlight();
    if (!closest) return;
    this._featuredHighlightEl = closest.el;
    closest.el.classList.add('featured-highlight');
    const fb  = closest.el.querySelector('.pin-featured-badge');
    const lbl = closest.el.querySelector('.place-pin-label');
    if (fb)  fb.style.display  = 'none';
    if (lbl) { lbl.style.opacity = '0'; lbl.style.pointerEvents = 'none'; }
    if (navigator.vibrate) navigator.vibrate(40);

    const isBubble = closest.place.pinStyle === 'bubble';
    const wrapper = closest.el.querySelector('.place-pin-wrapper');
    const bubbleStack = closest.el.querySelector('.place-pin-bubble-stack');
    if (wrapper) {
      wrapper.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
      wrapper.style.transform  = 'scale(1.35) translateY(-6px)';
    }
    if (bubbleStack) {
      // El globo entero (píldora + colita) hace el mismo pulso/zoom que
      // los pines circulares — así se siente flotando, coherente con la
      // sombra de abajo
      bubbleStack.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
      bubbleStack.style.transform  = 'translateX(-50%) scale(1.18) translateY(-4px)';
    }
    const root = closest.el.querySelector('.place-pin-root');
    if (root && !root.querySelector('.pin-featured-shadow')) {
      const shadow = document.createElement('div');
      shadow.className = 'pin-featured-shadow';
      shadow.style.cssText = 'position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:10px;height:4px;border-radius:50%;background:#1a1a1a;pointer-events:none;';
      root.appendChild(shadow);
    }
    if (root && !root.querySelector('.pin-featured-name')) {
      const badge  = closest.place.featured==='verified'?'✅ Verificado':closest.place.featured==='premium'?'💎 Premium':'⭐ Destacado';
      const badgeBg = closest.place.featured==='verified'?'linear-gradient(135deg,#10b981,#059669)':closest.place.featured==='premium'?'linear-gradient(135deg,#3b82f6,#2563eb)':'linear-gradient(135deg,#f59e0b,#f97316)';
      const nameEl = document.createElement('div');
      nameEl.className = 'pin-featured-name';
      // Globo: el nombre YA se ve adentro de la píldora — mostrar el mismo
      // texto de vuelta arriba (con stroke) queda redundante, así que acá
      // solo va el badge, y bien más arriba para no pisar el globo (que
      // encima ahora crece con el pulso)
      nameEl.style.cssText = isBubble
        ? 'position:absolute;bottom:calc(100% + 26px);left:50%;transform:translateX(-50%);pointer-events:none;white-space:nowrap;animation:featuredNameIn 0.2s ease;'
        : 'position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;animation:featuredNameIn 0.2s ease;';
      nameEl.innerHTML = isBubble
        ? '<div style="font-size:9px;font-weight:700;background:' + badgeBg + ';color:white;padding:2px 7px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">' + badge + '</div>'
        : '<div style="font-size:13px;font-weight:800;color:#1f2937;font-family:\'Inter Tight\',system-ui,sans-serif;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;">' +
          closest.place.name + '</div>' +
          '<div style="font-size:9px;font-weight:700;background:' + badgeBg +
          ';color:white;padding:2px 7px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">' + badge + '</div>';
      root.appendChild(nameEl);
    }
  }

  // ── Reposicionar lugares (SuperUserPanel) ───────────────────────────
  enableDragMode(onMoved) {
    this._dragModeActive = true;
    this._dragModeCallback = onMoved || null;
    this._dragSelectedPlace = null;
    this._dragSelectedEl = null;

    // Banner visual
    let banner = document.getElementById('wp-reposition-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'wp-reposition-banner';
      banner.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px)+12px);left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,0.82);color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:999px;font-family:\'Inter Tight\',system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;';
      banner.innerHTML = `<span id="wp-reposition-text">🎯 Toca un lugar para moverlo</span><button id="wp-reposition-cancel" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;cursor:pointer;">Salir</button>`;
      document.body.appendChild(banner);
      document.getElementById('wp-reposition-cancel').addEventListener('click', () => this.disableDragMode());
    }
    banner.style.display = 'flex';

    this.map.getCanvas().style.cursor = 'crosshair';
  }

  disableDragMode() {
    this._dragModeActive = false;
    this._dragModeCallback = null;
    this._dragSelectedPlace = null;
    if (this._dragSelectedEl) {
      this._dragSelectedEl.style.outline = '';
      this._dragSelectedEl.style.filter  = '';
      this._dragSelectedEl = null;
    }
    const banner = document.getElementById('wp-reposition-banner');
    if (banner) banner.style.display = 'none';
    this.map.getCanvas().style.cursor = '';
    if (this._dragMapClickHandler) {
      this.map.off('click', this._dragMapClickHandler);
      this._dragMapClickHandler = null;
    }
  }

  _selectPlaceForReposition(place, el, index) {
    // Deseleccionar anterior
    if (this._dragSelectedEl) {
      this._dragSelectedEl.style.outline = '';
      this._dragSelectedEl.style.filter  = '';
    }
    this._dragSelectedPlace = place;
    this._dragSelectedEl    = el;
    this._dragSelectedIndex = index;

    // Resaltar visualmente el pin seleccionado
    el.style.outline = '3px solid #f59e0b';
    el.style.outlineOffset = '2px';
    el.style.filter = 'drop-shadow(0 0 8px rgba(245,158,11,0.7))';

    const txt = document.getElementById('wp-reposition-text');
    if (txt) txt.textContent = `📍 "${place.name}" — toca el mapa para moverlo`;

    // Listener en el mapa: el próximo click mueve el lugar
    if (this._dragMapClickHandler) this.map.off('click', this._dragMapClickHandler);
    this._dragMapClickHandler = (e) => {
      this._moveSelectedPlace(e.lngLat.lat, e.lngLat.lng);
    };
    this.map.once('click', this._dragMapClickHandler);
  }

  _moveSelectedPlace(lat, lng) {
    const place = this._dragSelectedPlace;
    const el    = this._dragSelectedEl;
    if (!place || !el) return;

    // Actualizar visualmente el marker de inmediato
    const marker = el._marker;
    if (marker) marker.setLngLat([lng, lat]);
    place.lat = lat; place.lng = lng;
    if (place.location) { place.location.lat = lat; place.location.lng = lng; }

    this.haptic('snap');
    el.style.outline = '';
    el.style.filter  = '';
    this._dragSelectedEl = null;
    this._dragSelectedPlace = null;

    const txt = document.getElementById('wp-reposition-text');
    if (txt) txt.textContent = '🎯 Toca un lugar para moverlo';

    if (this._dragModeCallback) {
      this._dragModeCallback(place, lat, lng);
    }
  }

  // ── Pick mode: elegir lugar para una actividad (tap en mapa) ────────
  enablePickMode(onPickCallback) {
    document.getElementById('activity-popup')?.remove();
    this.pickModeActive   = true;
    this.pickModeCallback = onPickCallback;
    document.body.classList.add('pick-mode');
    this.map.getCanvas().style.cursor = 'crosshair';

    // Ocultar UI: panel resultados, chips de subcategoría, topbar
    const panel = document.querySelector('.map-results-panel-float');
    if (panel) panel.style.transform = 'translateY(100%)';
    const scats = document.getElementById('wp-scats');
    if (scats) { scats.style.opacity = '0'; scats.style.pointerEvents = 'none'; }
    ['topbar-auth-btn', 'topbar-notif-btn', 'topbar-right-chip'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; }
    });

    // Mostrar labels de los pines para identificar lugares mientras se elige
    this._updateLabelsProgressive();

    // Click en el mapa (fuera de un pin) → punto personalizado
    this._pickHandled = false;
    this._pickMapClickHandler = (e) => {
      if (this._pickHandled) return;
      const { lat, lng } = e.lngLat;
      this._placePickPin(lng, lat);
      this.map.flyTo({ center: [lng, lat], duration: 350 });
      if (onPickCallback) onPickCallback({ name: null, lat, lng, customPoint: true });
    };
    this.map.on('click', this._pickMapClickHandler);

    // Click en un pin existente → ese lugar real
    this._pickMarkerHandlers = [];
    this.markerEls.forEach((el, index) => {
      const place = this.allPlaces[index];
      if (!place || !el) return;
      const handler = (e) => {
        e.stopPropagation();
        this._pickHandled = true;
        setTimeout(() => { this._pickHandled = false; }, 300);
        const lat = place.location?.lat ?? place.lat;
        const lng = place.location?.lng ?? place.lng;
        this._placePickPin(lng, lat);
        this.map.flyTo({ center: [lng, lat], duration: 350 });
        if (onPickCallback) onPickCallback({
          name: place.name, lat, lng,
          place_id: place.place_id || place.placeId
        });
      };
      el.addEventListener('click', handler, { capture: true });
      this._pickMarkerHandlers.push({ el, handler });
    });

    console.log('🎯 Pick mode activado');
  }

  // ── Pin visual fijo en el punto exacto donde se hizo tap ────────────
  _placePickPin(lng, lat) {
    if (this._pickPinMarker) {
      this._pickPinMarker.setLngLat([lng, lat]);
      return;
    }
    const el = document.createElement('div');
    el.style.cssText = 'width:36px;height:48px;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;';
    el.innerHTML = `
      <svg width="36" height="48" viewBox="0 0 36 48" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.3));">
        <path d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0z" fill="#1a5cf5"/>
        <circle cx="18" cy="18" r="7" fill="white"/>
      </svg>`;
    this._pickPinMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(this.map);
  }

  _removePickPin() {
    if (this._pickPinMarker) { this._pickPinMarker.remove(); this._pickPinMarker = null; }
  }

  disablePickMode() {
    this.pickModeActive   = false;
    this.pickModeCallback = null;
    document.body.classList.remove('pick-mode');
    this.map.getCanvas().style.cursor = '';

    const panel = document.querySelector('.map-results-panel-float');
    if (panel) panel.style.transform = '';
    const scats = document.getElementById('wp-scats');
    if (scats) { scats.style.opacity = ''; scats.style.pointerEvents = ''; }
    ['topbar-auth-btn', 'topbar-notif-btn', 'topbar-right-chip'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.opacity = ''; el.style.pointerEvents = ''; }
    });

    // Ocultar labels de pines (vuelven a su comportamiento normal por zoom)
    document.querySelectorAll('.place-marker-el .place-pin-label').forEach(l => {
      l.style.opacity = '0'; l.style.display = 'none';
    });

    if (this._pickMapClickHandler) {
      this.map.off('click', this._pickMapClickHandler);
      this._pickMapClickHandler = null;
    }
    if (this._pickMarkerHandlers) {
      this._pickMarkerHandlers.forEach(({ el, handler }) => {
        el.removeEventListener('click', handler, { capture: true });
      });
      this._pickMarkerHandlers = [];
    }
    this._removePickPin();
    console.log('🎯 Pick mode desactivado');
  }

  flyTo(lng, lat, zoom = 17) { this.map.flyTo({ center: [lng, lat], zoom, duration: 600 }); }
  getMap() { return this.map; }
}

// PATCH: _buildPinHtml — foto con borde liquid celestial 3D + Roboto
// Mismo cálculo que PlaceModal2._isOpenNow — lo necesita el pin 'social'
// para mostrar el estado (Abierto/Cerrado) en la línea de metadata.
function _isPlaceOpenNow(place) {
  const oh = place.regularOpeningHours;
  if (!oh || !oh.periods || !oh.periods.length) return null;
  const now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
  return oh.periods.some(p => {
    if (!p.open || !p.close || p.open.day !== day) return false;
    const o = p.open.hour * 60 + (p.open.minute || 0);
    const c = p.close.hour * 60 + (p.close.minute || 0);
    return mins >= o && mins < c;
  });
}

// ── Fotos apiladas del pin "social" — 3 variantes de diseño ─────────
// Todas reciben las mismas fotos (photos[0] = foto principal, SIEMPRE
// la de más adelante/arriba del stack, mayor z-index) y el mismo
// tamaño de foto (photoW/photoH) — solo cambia el arreglo visual.
//
// 'fan'        (la que ya existía, sin cambios de diseño): abanico
//               rotado con offset fijo. Antes la última foto del array
//               terminaba arriba por un bug de z-index — ahora el
//               índice 0 siempre es la principal.
// 'fan-center': abanico simétrico tipo "pavo real" — la principal queda
//               derecha/centrada y arriba de todo, flanqueada por las
//               otras 2 inclinadas en espejo hacia cada lado, todas
//               pivotando desde el mismo punto de la base (como un
//               mazo de cartas sostenido con la mano).
// 'fan-drift':  abanico direccional tipo "cascada de cartas repartidas"
//               — la principal va apenas inclinada y adelante, las
//               siguientes se asoman cada vez más hacia un costado y
//               más atrás (menor z-index), mismo pivote en la base.
function _buildPinPhotoStackHtml(photos, photoW, photoH, style) {
  const n = photos.length;
  if (!n) return '';

  // 'fan-center' y 'fan-drift' comparten la técnica de pivote: cada
  // foto se ancla por su borde inferior-centro exactamente en el mismo
  // punto (el centro del pin) y rota desde ahí (transform-origin:50% 100%),
  // así que el abanico converge en un único punto en vez de desplazarse
  // con un offset fijo — el mismo efecto visual que un mazo de cartas
  // sostenido y abierto con la mano.
  const buildPivotFan = (angles) => photos.map((url, i) => {
    const z = n - i; // principal (i=0) = mayor z-index, siempre arriba
    const rot = angles[i] ?? 0;
    return `<img src="${url}" style="position:absolute;top:50%;left:50%;width:${photoW}px;height:${photoH}px;object-fit:cover;border-radius:5px;border:1.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.25);transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${rot}deg);z-index:${z};">`;
  }).join('');

  if (style === 'fan-center') {
    // Ángulos simétricos alrededor de 0°, ordenados de menor a mayor
    // ángulo absoluto — así la principal (índice 0) siempre recibe el
    // slot más centrado/prominente (el de menor inclinación).
    const spread = n === 2 ? 15 : 17;
    const raw = Array.from({ length: n }, (_, k) => Math.round((k - (n - 1) / 2) * spread));
    const angles = raw.slice().sort((a, b) => Math.abs(a) - Math.abs(b));
    return buildPivotFan(angles);
  }

  if (style === 'fan-drift') {
    // La principal (índice 0) va apenas inclinada; cada foto detrás
    // suma inclinación hacia el mismo lado, como cartas repartidas en
    // cascada hacia un costado.
    const start = -8, step = 14;
    const angles = Array.from({ length: n }, (_, k) => start + k * step);
    return buildPivotFan(angles);
  }

  // 'fan' — diseño original (offset fijo en vez de pivote), sin cambios.
  const rotsArr = [-10, 4, 12]; // mismos ángulos de siempre, por slot visual
  const offX = photoW * 0.55, offY = photoH * 0.65;
  return photos.map((url, i) => {
    const rot = rotsArr[n - 1 - i] ?? 0; // slot visual: la principal usa el ángulo del slot "de adelante"
    const z = n - i; // principal (i=0) = mayor z-index
    return `<img src="${url}" style="position:absolute;top:50%;left:50%;width:${photoW}px;height:${photoH}px;object-fit:cover;border-radius:4px;border:1.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.25);transform:translate(calc(-50% - ${offX}px),calc(-50% - ${offY}px)) rotate(${rot}deg);z-index:${z};">`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════════
// STICKER DE CLUSTER — composición de tarjetas dispersas, tipo el mapa
// de "Moments" (una tarjeta por lugar, rotadas/tamaños distintos, más
// stickers decorativos) en vez de un ícono con anillo.
//
// Modelo de datos GUARDADO (pin_clusters):
//   cards:    [{ placeId, shape:'portrait'|'square', rotation, scale,
//                dx, dy, borderColor, borderWidth, borderRadius, z }]
//             override opcional por lugar; si un lugar del grupo no
//             tiene entrada acá, se usa el slot automático
//             (CLUSTER_CARD_SLOTS) según su posición en el grupo.
//   stickers: [{ emoji|imageUrl, dx, dy, size, rotation, strokeColor,
//                strokeWidth, z }]
//   badge:    { dx, dy, scale, color, z }
//
// `z` es el orden de apilado — "traer al frente"/"enviar atrás" en el
// panel solo tocan este número (máximo/mínimo global +1/-1), no hace
// falta reordenar arrays. Todo opcional — un cluster sin personalizar
// (customDef=null) ya se ve bien solo con los slots automáticos.
// ════════════════════════════════════════════════════════════════════

// Slots de posición/tamaño/rotación/z para hasta 6 tarjetas visibles —
// mismo espíritu disperso que la referencia de Moments. dx/dy en px
// desde el centro del pin; scale multiplica el tamaño base.
export const CLUSTER_CARD_SLOTS = [
  { dx: -30, dy: -4,  rot: -4, scale: 0.74, z: 1 },
  { dx: 10,  dy: -22, rot: 3,  scale: 0.98, z: 2 },
  { dx: -16, dy: 10,  rot: -7, scale: 0.86, z: 3 },
  { dx: 30,  dy: 6,   rot: 6,  scale: 0.80, z: 4 },
  { dx: -8,  dy: 28,  rot: -1, scale: 1.06, z: 6 }, // principal, más grande
  { dx: 34,  dy: 30,  rot: 7,  scale: 0.66, z: 5 },
];
export const CLUSTER_MAX_CARDS = CLUSTER_CARD_SLOTS.length;

// Único punto que resuelve el id de un lugar para todo lo relacionado a
// clusters — usado tanto acá (render) como en _updateClusters() y en
// SuperUserPanel.js (edición). ANTES esta fórmula estaba duplicada en
// varios lugares con ligeras diferencias entre sí (algunas con fallback
// por nombre, otras sin él) — para un lugar sin place_id NI id (típico
// en categorías con lugares cargados a mano), cada copia podía resolver
// a un id DISTINTO, así que el override guardado por el panel nunca se
// encontraba al renderizar acá, y esos lugares terminaban usando un
// override "vacío" recién creado (dx:0,dy:0 = centro) en vez del que el
// SuperUser en realidad había guardado — de ahí el "se desordena todo".
export function placeIdOf(place) {
  return place?.place_id || place?.id || place?.name || '__lugar_sin_id';
}

// data-card-idx / data-sticker-idx / data-badge quedan siempre en el
// HTML (no solo en el editor) — no hacen nada en el mapa real, pero le
// permiten al panel de edición enganchar el gesto directo sobre CADA
// elemento sin duplicar esta función. Una sola fuente de verdad.
export function _buildClusterStickerHtml(group, customDef) {
  const BASE_W = 46, BASE_H = 60; // tamaño base portrait (16:21, igual ratio que el pin individual)
  const cardsOverride = customDef?.cards || [];
  const shown = group.slice(0, CLUSTER_MAX_CARDS);

  const cardsHtml = shown.map(({ el }, i) => {
    const place = el._place;
    const pid = placeIdOf(place);
    const override = cardsOverride.find(c => c.placeId === pid);
    const slot = CLUSTER_CARD_SLOTS[i] || CLUSTER_CARD_SLOTS[CLUSTER_CARD_SLOTS.length - 1];

    const shape = override?.shape || 'portrait';
    const scale = override?.scale ?? slot.scale;
    const rot   = override?.rotation ?? slot.rot;
    const dx    = override?.dx ?? slot.dx;
    const dy    = override?.dy ?? slot.dy;
    const z     = override?.z ?? slot.z;
    const borderColor  = override?.borderColor  ?? '#ffffff';
    const borderWidth  = override?.borderWidth  ?? 2;
    const borderRadius = override?.borderRadius ?? 9;

    const h = BASE_H * scale;
    const w = shape === 'square' ? h : BASE_W * scale;

    const photo = proxyPhotoCluster(place.photoUrl || place.photo_url || place.photosUrls?.[0] || null);
    const bg = photo
      ? `background-image:url('${photo}');background-size:cover;background-position:center;`
      : `background:linear-gradient(160deg,#d1d5db,#9ca3af);`;

    // pointer-events:auto explícito — el CONTENEDOR grande de todo el
    // cluster va con pointer-events:none (ver el return final), así que
    // sin este auto acá la tarjeta ni siquiera sería tappeable.
    return `<div data-card-idx="${i}" style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;border-radius:${borderRadius}px;${bg}border:${borderWidth}px solid ${borderColor};box-shadow:0 3px 8px rgba(0,0,0,0.28);transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${rot}deg);z-index:${z};pointer-events:auto;"></div>`;
  }).join('');

  const stickersHtml = (customDef?.stickers || []).map((s, i) => {
    const size = s.size || 26;
    const strokeColor = s.strokeColor || '#ffffff';
    const strokeWidth = s.strokeWidth ?? 2;
    const dx = s.dx ?? 0, dy = s.dy ?? 0;
    const z = s.z ?? (20 + i);
    const noStroke = strokeWidth === 0;

    // Contorno por apilado de copias (mismo criterio que el sticker del
    // pin individual) — es la técnica que SÍ funciona con emoji a color:
    // -webkit-text-stroke no tiene efecto en glifos bitmap/COLR en la
    // mayoría de navegadores. 12 puntos repartidos cada 30° para que el
    // contorno se vea redondo, no "con picos".
    const STROKE_POINTS = 12;
    const emojiShadowStack = Array.from({ length: STROKE_POINTS }, (_, k) => {
      const a = (k / STROKE_POINTS) * 2 * Math.PI;
      const x = +(Math.cos(a) * strokeWidth).toFixed(2);
      const y = +(Math.sin(a) * strokeWidth).toFixed(2);
      return `${x}px ${y}px 0 ${strokeColor}`;
    }).join(',');
    const diag = +(strokeWidth * 0.7071).toFixed(2);

    const inner = s.imageUrl
      ? (noStroke
          ? `<img src="${s.imageUrl}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.32));">`
          : `<img src="${s.imageUrl}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(${strokeWidth}px 0 0 ${strokeColor}) drop-shadow(-${strokeWidth}px 0 0 ${strokeColor}) drop-shadow(0 ${strokeWidth}px 0 ${strokeColor}) drop-shadow(0 -${strokeWidth}px 0 ${strokeColor}) drop-shadow(${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.28));">`)
      : s.emoji
      ? (noStroke
          ? `<div style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:${size}px;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,0.32);">${s.emoji}</div>`
          : `<div style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:${size}px;line-height:1;text-shadow:${emojiShadowStack},0 2px 4px rgba(0,0,0,0.28);">${s.emoji}</div>`)
      : '';
    if (!inner) return '';
    return `<div data-sticker-idx="${i}" style="position:absolute;left:50%;top:50%;transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${s.rotation || 0}deg);z-index:${z};pointer-events:auto;">${inner}</div>`;
  }).join('');

  // MÚLTIPLES badges: customDef.badges (array) es lo nuevo. Si no existe
  // pero hay un customDef.badge (singular, como se guardaba antes),
  // se trata como un array de uno solo — así los clusters guardados
  // antes de este cambio siguen viéndose exactamente igual.
  const badgeList = Array.isArray(customDef?.badges) ? customDef.badges
    : customDef?.badge ? [customDef.badge]
    : group.length > 1 ? [{}] // grupo real sin badge configurado → el "+N" de siempre, con sus defaults
    : [];
  const badgeHtml = badgeList.map((badge, bi) => {
    badge = badge || {};
    const bColor = badge.color || '#111827';
    const bScale = badge.scale ?? 1;
    const bDx = badge.dx ?? (34 + bi * 4), bDy = badge.dy ?? (-28 - bi * 30); // badges extra se apilan hacia arriba por default, para no pisarse
    const bRot = badge.rotation ?? 0;
    const bZ = badge.z ?? (30 + bi);
    const bSize = 22 * bScale;
    // Texto del badge: si hay un `label` explícito lo usa (sirve tanto
    // para clusters — "Top 5", "Centro" — como para un pin individual de
    // estilo cluster, donde el conteo automático "+1" no tendría sentido).
    // Si no hay label y es el PRIMER badge de un grupo real (>1), cae al
    // "+N" de siempre. Los badges extra (bi>0) sin label no dibujan nada.
    const bText = typeof badge.label === 'string' && badge.label ? badge.label
      : (bi === 0 && group.length > 1) ? `+${group.length}`
      : '';
    if (!bText) return '';
    return `<div data-badge-idx="${bi}" style="position:absolute;left:50%;top:50%;min-width:${bSize}px;height:${bSize}px;padding:0 ${6 * bScale}px;border-radius:999px;background:${bColor};color:#fff;font-size:${11.5 * bScale}px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:translate(calc(-50% + ${bDx}px),calc(-50% + ${bDy}px)) rotate(${bRot}deg);z-index:${bZ};pointer-events:auto;white-space:nowrap;">${bText}</div>`;
  }).join('');

  // ── Etiqueta SEPARADA (no es el badge) ──────────────────────────────
  // Texto libre e independiente, pensado para el nombre del lugar al lado
  // o debajo del pin, sin pisar el badge. Mismo patrón dx/dy/rotation/z
  // que el resto de los elementos; solo se dibuja si tiene texto.
  const label = customDef?.label || {};
  const lText = typeof label.text === 'string' ? label.text : '';
  const labelHtml = lText ? (() => {
    const lDx = label.dx ?? 0, lDy = label.dy ?? 44; // default: debajo del pin
    const lRot = label.rotation ?? 0;
    const lScale = label.scale ?? 1;
    const lColor = label.color || '#1a1a2e';
    const lBg = label.bg || 'rgba(255,255,255,0.92)';
    const lZ = label.z ?? 25;
    return `<div data-label style="position:absolute;left:50%;top:50%;max-width:140px;padding:${4 * lScale}px ${9 * lScale}px;border-radius:${8 * lScale}px;background:${lBg};color:${lColor};font-size:${12 * lScale}px;font-weight:700;font-family:'Inter Tight',system-ui,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.18);transform:translate(calc(-50% + ${lDx}px),calc(-50% + ${lDy}px)) rotate(${lRot}deg);z-index:${lZ};pointer-events:auto;">${lText}</div>`;
  })() : '';

  // pointer-events:none acá es LA clave: este div mide 150x120 (o más, si
  // hay tarjetas/stickers desplazados afuera) pero es puramente un marco
  // de posicionamiento — sin este none, CUALQUIER toque dentro de esa
  // caja entera (incluyendo el espacio vacío/transparente entre tarjetas)
  // quedaba capturado por este elemento y burbujeaba como si se hubiera
  // tocado el cluster. Cada pieza visible (tarjeta/sticker/badge)
  // reactiva pointer-events:auto por separado arriba — así solo lo que
  // realmente se VE es tappeable, nada más.
  return `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:150px;height:120px;pointer-events:none;">${cardsHtml}${stickersHtml}${badgeHtml}${labelHtml}</div>`;
}


MapView.prototype._buildPinHtml = function(place, photoUrl, catIcon) {
  const rawName   = place.name || '';
  // Si el nombre viene en TODAS MAYÚSCULAS, convertirlo a Title Case.
  // CSS text-transform:capitalize solo funciona en textos que ya tienen minúsculas.
  const isAllCaps = rawName === rawName.toUpperCase() && /[A-ZÁÉÍÓÚÑa-záéíóúñ]{2,}/.test(rawName);
  const shortName = isAllCaps
    ? rawName.toLowerCase().replace(/(?:^|\s|['"([\-])\S/g, c => c.toUpperCase())
    : rawName;
  const isFeat    = !!place.featured;
  const featType  = typeof place.featured === 'string' ? place.featured : '';

  const featHtml  = '';  // Sin badge en el pin
  const pulseHtml = isFeat ? '<div class="pin-pulse"></div>' : '';

  const liquidBg     = 'linear-gradient(145deg,rgba(255,255,255,1) 0%,rgba(210,235,255,0.95) 40%,rgba(180,215,255,0.88) 65%,rgba(255,255,255,0.98) 100%)';
  const liquidShadow = '0 0 0 1.5px rgba(160,205,255,0.5),0 3px 10px rgba(100,170,255,0.22),0 1px 3px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.9)';
  const featShadow   = '0 0 0 2.5px #FF6D00,0 0 0 4.5px rgba(255,109,0,0.2),0 3px 10px rgba(255,109,0,0.3),inset 0 1px 0 rgba(255,255,255,0.9)';
  const activeShadow = isFeat ? featShadow : liquidShadow;

  // Label: más grande, más ancho
  const labelHtml = `<div class="place-pin-label" style="position:absolute;left:26px;top:50%;transform:translateY(-50%);display:none;opacity:0;font-size:13px;font-weight:700;line-height:1.05;font-family:'Inter Tight',system-ui,sans-serif;color:#1a1a2e;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-width:90px;max-height:2.4em;white-space:normal;pointer-events:none;letter-spacing:-0.1px;text-transform:capitalize;text-shadow:-1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff;transition:opacity 0.22s ease;">${shortName}</div>`;

  // ── Pin tipo emoji/sticker (elegido en SuperUserPanel) — tiene
  // prioridad sobre la foto si el lugar está configurado así ──
  // ── Pin tipo "globo" (speech bubble) — reemplaza el pin completo.
  // Reutiliza el mismo emoji/sticker elegido en "Pin en el mapa", con el
  // nombre del lugar al lado, en una píldora blanca con colita apuntando
  // al punto exacto. anchor sigue siendo 'center' (no se toca la creación
  // del marker) — el truco es que la "caja" que reporta el marker es solo
  // la colita, y la píldora crece hacia arriba desde ahí con position:absolute,
  // mismo patrón que ya usan los labels de los demás pines.
  // ── Pin tipo "social" — badge circular de color sólido + label debajo
  // con metadata (rating · categoría · abierto/cerrado). Modo evento:
  // reemplaza el badge por un mini-collage de fotos en abanico + pill de
  // tiempo en vez de la metadata normal. Gancho para avatares de actividad
  // activa (place.activeAvatars) para cuando ese dato esté disponible.
  // ── Pin tipo "cluster" ────────────────────────────────────────────
  // Usa exactamente el mismo render que un sticker de cluster, pero para
  // UN lugar y como pin normal del mapa. El diseño (tarjetas, stickers,
  // badge, etiqueta) vive en una fila de pin_clusters con un solo
  // place_id — se busca acá por id.
  //
  // Al ser un estilo de pin más, este pin ES el marker del lugar: no hay
  // un sticker aparte que haya que intercambiar con el pin "de fábrica".
  // Ese swap era el origen de que el minimodal saliera descentrado (se
  // inflaba sobre otro elemento) y de que el pin desapareciera o volviera
  // al estilo social al cerrarlo.
  if (place.pinStyle === 'cluster') {
    const pid = placeIdOf(place);
    // Por si quedaron filas duplicadas de antes de este fix (cada
    // long-press creaba una fila nueva): entre todas las que matchean
    // este place_id, usar la más reciente por updatedAt, no la primera
    // que aparezca en el array.
    const matches = (this.pinClusters || []).filter(
      cd => (cd.placeIds || []).length === 1 && cd.placeIds[0] === pid
    );
    const def = matches.length
      ? matches.reduce((a, b) => (Date.parse(b.updatedAt || '') || 0) > (Date.parse(a.updatedAt || '') || 0) ? b : a)
      : null;
    const dotColor = def?.badge?.color || '#111827';
    // El punto de "todavía no revelado por zoom" (ver _updatePinsByZoom,
    // que alterna display entre este dot y .place-pin-cluster-content
    // según el estado). No existe un dot equivalente en el diseño del
    // sticker de cluster — los demás estilos (social, globo) sí tienen
    // el suyo propio, así que se agrega acá.
    return `<div class="place-pin-root" style="position:relative;width:2px;height:2px;overflow:visible;">` +
      `<div class="place-pin-cluster-dot" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;border-radius:50%;background:${dotColor};box-shadow:0 0 0 1.5px rgba(255,255,255,0.9),0 1.5px 3px rgba(0,0,0,0.3);display:none;"></div>` +
      `<div class="place-pin-cluster-content">${_buildClusterStickerHtml([{ el: { _place: place } }], def)}</div>` +
      `</div>`;
  }

  if (place.pinStyle === 'social') {
    const badgeColor = place.pinBadgeColor || '#f97316';
    // Modo evento AHORA solo controla si aparece la etiqueta de fecha/hora
    // en la metadata — ya no condiciona nada más (ni fotos, ni el badge)
    const isEvent = !!place.pinEventMode;

    // Tamaño del PIN (badge/punto) — independiente del tamaño de las fotos
    // apiladas. OJO: el selector de tamaño (su-pin-size-btn) es compartido
    // con sticker/globo y manda 'mini'/'normal'/'grande'. Escala corrida:
    // el "mediano" de antes ahora es "mini", el "grande" de antes ahora es
    // "normal" (mediano), y se agregó un nuevo "grande" más grande.
    const BADGE_SIZE_MAP = {
      mini:   { round: 15, square: 14, dot: 8,  icon: 8  },
      normal: { round: 18, square: 17, dot: 10, icon: 9  },
      grande: { round: 23, square: 22, dot: 13, icon: 12 },
    };
    const sz = BADGE_SIZE_MAP[place.pinSize] || BADGE_SIZE_MAP.normal;

    // Tamaño y forma de las FOTOS APILADAS — selectores propios,
    // totalmente independientes del pin y del modo evento. Agrandadas un
    // poco en los 3 tamaños.
    const PHOTO_SIZE_MAP = {
      chico:  { portraitW: 12, portraitH: 16, square: 13 },
      med:    { portraitW: 16, portraitH: 21, square: 18 },
      grande: { portraitW: 20, portraitH: 26, square: 23 },
    };
    const psz = PHOTO_SIZE_MAP[place.pinPhotoStackSize] || PHOTO_SIZE_MAP.med;

    // Ícono siempre en blanco (silueta) — mismo tratamiento sea emoji,
    // imagen propia, o el ícono de categoría de fallback
    const badgeIcon = place.pinIconUrl
      ? `<img src="${place.pinIconUrl}" style="width:${sz.icon}px;height:${sz.icon}px;object-fit:contain;filter:brightness(0) invert(1);">`
      : place.pinEmoji
        ? `<span style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:${sz.icon}px;line-height:1;filter:brightness(0) invert(1);">${place.pinEmoji}</span>`
        : `<div style="width:${sz.icon}px;height:${sz.icon}px;filter:brightness(0) invert(1);">${catIcon}</div>`;

    // ── Las 3 piezas, cada una con su propio control, sin depender entre sí ──
    // 1) Forma/estilo del PIN: pinBadgeStyle 'icon' (ícono, círculo o
    //    cuadrado según pinBadgeShape) | 'dot' (solo punto) — nunca depende
    //    de si es evento o no.
    const useDot = place.pinBadgeStyle === 'dot';
    const isSquareShape = place.pinBadgeShape === 'square';

    // 2) Fotos apiladas: pinShowStackedPhotos — opción propia, YA NO
    //    depende de pinEventMode. Se muestran si el toggle está activo Y
    //    el lugar tiene fotos, en cualquier combinación con el pin.
    const showPhotos = !!place.pinShowStackedPhotos;
    const photoShape = place.pinPhotoStackShape === 'square' ? 'square' : 'portrait';
    const photosForFan = showPhotos ? (place.photosUrls || []).slice(0, 3) : [];

    const photoW = photoShape === 'square' ? psz.square : psz.portraitW;
    const photoH = photoShape === 'square' ? psz.square : psz.portraitH;
    // Estilo del stack: 'fan' (default) | 'cascade' | 'cluster'
    const stackStyle = place.pinPhotoStackStyle === 'fan-center' ? 'fan-center'
      : place.pinPhotoStackStyle === 'fan-drift' ? 'fan-drift'
      : 'fan';
    // Las fotos se posicionan desde un punto de anclaje FIJO (centro del
    // contenedor, vía top/left 50% + transform), no desde el borde de un
    // contenedor que cambia de tamaño con el badge — así el tamaño del
    // pin/punto ya no corre la posición de las fotos.
    const fanHtml = photosForFan.length
      ? _buildPinPhotoStackHtml(photosForFan, photoW, photoH, stackStyle)
      : '';

    // 3) El anchor (ícono o punto) — SIEMPRE encima de las fotos si ambas
    //    están activas (z-index explícito, más alto que cualquier foto)
    let anchorHtml;
    if (useDot) {
      anchorHtml = `<div style="width:${sz.dot}px;height:${sz.dot}px;border-radius:50%;background:#fff;border:2.5px solid ${badgeColor};box-shadow:0 2px 5px rgba(0,0,0,0.25);"></div>`;
    } else {
      const badgeSize = isSquareShape ? sz.square : sz.round;
      const radius = isSquareShape ? '6px' : '50%';
      anchorHtml = `
        <div style="width:${badgeSize}px;height:${badgeSize}px;border-radius:${radius};background:${badgeColor};box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;">
          ${badgeIcon}
        </div>`;
    }

    // Contenedor del anchor: SIEMPRE del tamaño del badge/punto (para que
    // el layout del pin en sí se vea bien), pero las fotos ya no dependen
    // de este tamaño — se anclan al centro exacto vía position:absolute
    // con top/left 50%, invariante sea cual sea este tamaño.
    const anchorBoxSize = useDot ? sz.dot : (isSquareShape ? sz.square : sz.round);
    const badgeHtml = fanHtml
      ? `<div class="place-pin-social-content" style="position:relative;width:${anchorBoxSize}px;height:${anchorBoxSize}px;">${fanHtml}<div style="position:relative;z-index:10;">${anchorHtml}</div></div>`
      : `<div class="place-pin-social-content">${anchorHtml}</div>`;

    // Avatares de actividad activa — gancho para cuando MapView traiga ese
    // dato agregado por lugar (hoy solo vive dentro de la ficha). Si
    // place.activeAvatars no está poblado, esto simplemente no renderiza
    // nada, sin romper el resto del pin.
    const avatars = (place.activeAvatars || []).slice(0, 3);
    const avatarsHtml = avatars.length
      ? `<div style="display:flex;margin-top:2px;">
          ${avatars.map((url, i) => `<img src="${url}" style="width:14px;height:14px;border-radius:50%;border:1.5px solid #fff;object-fit:cover;margin-left:${i === 0 ? 0 : -5}px;box-shadow:0 1px 2px rgba(0,0,0,0.2);">`).join('')}
        </div>`
      : '';

    // Metadata: rating · categoría · abierto/cerrado (o la etiqueta de
    // tiempo, si el modo evento está activo) — con opción de ocultarla
    // por completo (pinShowMetaText)
    const showMetaText = place.pinShowMetaText !== false; // default true
    let metaHtml = '';
    if (showMetaText) {
      if (isEvent) {
        const evLabel = place.pinEventLabel || 'Evento activo';
        metaHtml = `<div style="font-size:9px;font-weight:700;color:#ec4899;line-height:1.15;">${evLabel}</div>`;
      } else {
        const parts = [];
        if (place.rating) parts.push(`★ ${Number(place.rating).toFixed(1)}`);
        if (place.primaryType || place.category) parts.push((place.primaryType || place.category));
        const openState = _isPlaceOpenNow(place);
        const metaText = parts.join(' · ');
        metaHtml = `<div style="font-size:9px;line-height:1.15;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${metaText}${openState !== null ? (metaText ? ' · ' : '') + `<span style="color:${openState ? '#16a34a' : '#dc2626'};font-weight:700;">${openState ? 'ABIERTO' : 'CERRADO'}</span>` : ''}</div>`;
      }
    }

    const name = (place.name || place.displayName || '').trim();

    // Punto de pre-visualización por zoom — mismo mecanismo que ya usan
    // los pines circulares y el globo: antes de tener zoom suficiente se
    // ve solo un punto (acá con el MISMO color de badge elegido), y al
    // acercarse aparece el pin completo con un efecto pulse.
    const zoomDotHtml = `<div class="place-pin-social-zoomdot" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;border-radius:50%;background:${badgeColor};box-shadow:0 0 0 1.5px rgba(255,255,255,0.9),0 1.5px 3px rgba(0,0,0,0.3);display:none;"></div>`;

    // Posición del label — abajo (default), izquierda o derecha del pin
    const labelPos = place.pinLabelPosition === 'left' || place.pinLabelPosition === 'right'
      ? place.pinLabelPosition : 'below';
    const textAlign = labelPos === 'below' ? 'center' : (labelPos === 'left' ? 'right' : 'left');
    const textBlockHtml = `<div style="text-align:${textAlign};max-width:120px;">
      <div style="font-size:11px;font-weight:800;line-height:1.15;color:#111827;font-family:'Inter Tight',system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;">${name}</div>
      ${metaHtml}
    </div>`;

    // ── ARQUITECTURA DE ANCLAJE ──────────────────────────────────────
    // El pin (badge) tiene que quedar exactamente en la coordenada real,
    // invariante al zoom. MapLibre con anchor:'center' centra la CAJA
    // COMPLETA del marker — si esa caja incluye el badge y el label
    // juntos (como en el layout flex), el "centro" real no es el badge
    // sino un punto intermedio, y ese desfase se nota más mientras más
    // lejos hace zoom-out.
    //
    // Fix: el ROOT es una cajita fija de 2x2px — su centro nunca cambia.
    // El badge se centra ahí. El label se posiciona con `transform`
    // puro (nunca con left/right en %, que se calculan sobre el ANCHO
    // DEL PADRE — acá el padre mide 2px, así que cualquier % ahí da
    // resultados frágiles). `translate()` en cambio siempre se calcula
    // sobre el tamaño del PROPIO elemento, así que es seguro combinarlo
    // con un offset fijo en píxeles (halfBadge + gap) sin depender del
    // padre para nada.
    const halfBadge = Math.round(anchorBoxSize / 2);
    const gap = 7;
    const offset = halfBadge + gap;

    let extraTransform;
    if (labelPos === 'below') {
      extraTransform = `translate(-50%, ${offset}px)`;
    } else if (labelPos === 'right') {
      extraTransform = `translate(${offset}px, -50%)`;
    } else {
      extraTransform = `translate(calc(-100% - ${offset}px), -50%)`;
    }

    let extraHtml = '';
    if (avatarsHtml || textBlockHtml) {
      const alignItems = labelPos === 'below' ? 'center' : labelPos === 'right' ? 'flex-start' : 'flex-end';
      extraHtml = `<div class="place-pin-social-extra" style="position:absolute;top:50%;left:50%;transform:${extraTransform};display:flex;flex-direction:column;align-items:${alignItems};">${avatarsHtml}${textBlockHtml}</div>`;
    }

    return `<div class="place-pin-root place-pin-social-root" style="position:relative;width:2px;height:2px;overflow:visible;">
      ${zoomDotHtml}
      <div class="place-pin-social-body" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">
        <div class="place-pin-social-pop">${badgeHtml}</div>
      </div>
      ${extraHtml}
    </div>`;
  }

  if (place.pinStyle === 'bubble' && (place.pinEmoji || place.pinIconUrl)) {
    const iconHtml = place.pinIconUrl
      ? `<img src="${place.pinIconUrl}" style="width:12px;height:12px;object-fit:contain;border-radius:3px;flex-shrink:0;">`
      : `<span style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:11px;line-height:1;flex-shrink:0;">${place.pinEmoji}</span>`;
    const name = (place.name || place.displayName || '').trim();

    // .place-pin-bubble-inner: la clase que engancha la animación de
    // entrada tipo "pulse" en _updatePinsByZoom (en vez del fade genérico)
    // .place-pin-bubble-dot: el punto celeste que se muestra ANTES de que
    // aparezca el globo (mismo mecanismo del "punto" que ya tienen los
    // pines circulares, pero el globo no tiene .place-pin-wrapper así que
    // necesita su propio elemento)
    return `<div class="place-pin-root" style="position:relative;width:8px;height:8px;overflow:visible;">
      <div class="place-pin-bubble-dot" style="position:absolute;bottom:0;left:50%;transform:translate(-50%,50%);width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8fd8ff,#1a8cff 65%,#0a5fc2);box-shadow:0 1.5px 3px rgba(10,95,194,0.4);display:none;"></div>
      <div class="place-pin-bubble-stack" style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.22)) drop-shadow(0 1px 2px rgba(0,0,0,0.14));">
        <div class="place-pin-bubble-inner" style="position:relative;z-index:0;display:flex;align-items:center;gap:4px;background:linear-gradient(180deg,#ffffff 0%,#f2f3f5 100%);border-radius:999px;padding:4px 8px 4px 6px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.95);white-space:nowrap;">
          ${iconHtml}
          <span style="font-size:10px;font-weight:700;color:#1a1a2e;font-family:'Inter Tight',system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${name}</span>
        </div>
      </div>
    </div>`;
  }

  if (place.pinStyle === 'sticker' && (place.pinEmoji || place.pinIconUrl)) {
    // Estilo landmark real: SIN círculo de fondo ni badge — el emoji/imagen
    // flota directo, con un contorno blanco (drop-shadow apilado) que
    // simula el efecto sticker, igual que los landmarks del mapa.
    const STICKER_SIZE_MAP = { mini: 16, normal: 22, grande: 34 };
    const pinPx = STICKER_SIZE_MAP[place.pinSize] || STICKER_SIZE_MAP.normal;
    // Color y grosor del contorno son configurables (SuperUserPanel). Si
    // pinStrokeWidth es explícitamente 0, el usuario eligió NO tener
    // contorno — se muestra el emoji solo con la sombra de profundidad,
    // sin el apilado de color.
    const strokeColor = place.pinStrokeColor || '#ffffff';
    const hasExplicitWidth = place.pinStrokeWidth !== undefined && place.pinStrokeWidth !== null && place.pinStrokeWidth !== '';
    const outlineW = hasExplicitWidth ? parseFloat(place.pinStrokeWidth) : Math.max(2, Math.round(pinPx * 0.075));
    const noStroke = outlineW === 0;
    const diag = +(outlineW * 0.7071).toFixed(2); // offset diagonal (cos 45°) — usado en el stroke de imagen custom

    // Contorno por apilado de copias — es la técnica que SÍ funciona con
    // emoji a color (-webkit-text-stroke no tiene efecto en glifos
    // bitmap/COLR en la mayoría de navegadores). Para que no se vea "con
    // picos" en formas alargadas/diagonales, usamos 12 puntos repartidos
    // cada 30° (en vez de solo 8 a 45°) — cuantos más puntos, más redondo
    // y menos facetado se ve el contorno.
    const STROKE_POINTS = 12;
    const emojiShadowStack = Array.from({ length: STROKE_POINTS }, (_, i) => {
      const angle = (i / STROKE_POINTS) * 2 * Math.PI;
      const x = +(Math.cos(angle) * outlineW).toFixed(2);
      const y = +(Math.sin(angle) * outlineW).toFixed(2);
      return `${x}px ${y}px 0 ${strokeColor}`;
    }).join(',');

    const innerContent = place.pinIconUrl
      // 8 direcciones (4 cardinales + 4 diagonales) — con solo 4 quedaban
      // huecos en las esquinas del glifo, se veía "con picos" en grosores
      // más grandes. noStroke: sin apilado, solo la sombra de profundidad.
      ? (noStroke
          ? `<img src="${place.pinIconUrl}" style="width:${pinPx}px;height:${pinPx}px;object-fit:contain;display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));">`
          : `<img src="${place.pinIconUrl}" style="width:${pinPx}px;height:${pinPx}px;object-fit:contain;display:block;filter:drop-shadow(${outlineW}px 0 0 ${strokeColor}) drop-shadow(-${outlineW}px 0 0 ${strokeColor}) drop-shadow(0 ${outlineW}px 0 ${strokeColor}) drop-shadow(0 -${outlineW}px 0 ${strokeColor}) drop-shadow(${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px ${diag}px 0 ${strokeColor}) drop-shadow(${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(-${diag}px -${diag}px 0 ${strokeColor}) drop-shadow(0 3px 6px rgba(0,0,0,0.3));">`)
      // font-family con la pila de fuentes de emoji NATIVAS del sistema —
      // sin esto hereda 'Inter Tight' (sin glifos de emoji) y el navegador
      // cae a un fallback que puede rendear distinto al que se ve en el
      // teclado al elegirlo
      : noStroke
        ? `<div style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:${pinPx}px;line-height:1;text-shadow:0 3px 5px rgba(0,0,0,0.35);">${place.pinEmoji}</div>`
        : `<div style="font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;font-size:${pinPx}px;line-height:1;text-shadow:${emojiShadowStack},0 3px 5px rgba(0,0,0,0.25);">${place.pinEmoji}</div>`;

    return `<div class="place-pin-root" style="position:relative;display:inline-block;overflow:visible;">
      <div class="place-pin-rel" style="display:flex;align-items:center;justify-content:center;width:${pinPx}px;height:${pinPx}px;">
        ${innerContent}
      </div>
      ${labelHtml}
    </div>`;
  }

  if (photoUrl) {
    // data-liquid-shadow: para restaurar después del highlight
    return `<div class="place-pin-root" style="position:relative;display:inline-block;overflow:visible;">
      <div class="place-pin-rel">${featHtml}${pulseHtml}
        <div class="place-pin-wrapper" data-liquid-shadow="${activeShadow}" style="background:${liquidBg};box-shadow:${activeShadow};border-radius:50%;padding:1.5px;display:flex;align-items:center;justify-content:center;">
          <div class="pin-inner loading" data-photo="${photoUrl}" style="border-radius:50%;overflow:hidden;">${catIcon}</div>
        </div>
      </div>
      ${labelHtml}
    </div>`;
  }

  // ── Sin foto: mostrar el icono (subcategoría > categoría > emoji) dentro del pin ──
  return `<div class="place-pin-root" style="position:relative;display:inline-block;overflow:visible;">
    <div class="place-pin-rel">${featHtml}${pulseHtml}
      <div class="place-pin-wrapper" data-liquid-shadow="${activeShadow}" style="background:${liquidBg};box-shadow:${activeShadow};border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="display:flex;align-items:center;justify-content:center;width:16px;height:16px;">${catIcon}</div>
      </div>
    </div>
    ${labelHtml}
  </div>`;
};