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
       Pines: se achican mientras se arrastra (sin opacity — solo escala)
       y vuelven a su tamaño con un rebote (spring) al soltar. Además,
       durante el drag se les aplica un leve "parallax": se atrasan un
       poco respecto al movimiento real del mapa (ver --wp-parallax-x/y,
       calculado en _initMap en cada evento 'drag'), dando sensación de
       profundidad/capas en vez de que todo se mueva como un bloque rígido.
       El transform va en el HIJO DIRECTO de .place-marker-el (nunca en
       .place-marker-el mismo): MapLibre posiciona el marker con su
       propio transform inline ahí, y cualquier transform puesto por CSS
       quedaría pisado por ese inline — aplicándolo al hijo evitamos el
       conflicto. */
    .place-marker-el > * {
      transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1);
    }
    body.map-dragging .place-marker-el > * {
      transform: scale(0.82) translate(var(--wp-parallax-x, 0px), var(--wp-parallax-y, 0px));
      transition: transform 0.05s linear;
    }

    /* ── Carrusel expandido de cluster (pantalla completa) ──────────── */
    .wp-ce-wrap {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; flex-direction: column;
      opacity: 0; transition: opacity 0.22s ease-out;
    }
    .wp-ce-wrap.wp-ce-in { opacity: 1; }
    .wp-ce-bg {
      position: absolute; inset: -20px; /* margen extra para que el scale/translate del parallax nunca deje ver el borde */
      backdrop-filter: blur(26px) brightness(0.55) saturate(1.15);
      -webkit-backdrop-filter: blur(26px) brightness(0.55) saturate(1.15);
      background: rgba(10,10,14,0.28);
      transition: transform 0.05s linear;
      pointer-events: none;
    }
    .wp-ce-header {
      position: relative; z-index: 2; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: calc(env(safe-area-inset-top, 0px) + 14px) 18px 12px;
    }
    .wp-ce-count { color: #fff; font-weight: 700; font-size: 15px; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    .wp-ce-close {
      width: 36px; height: 36px; border-radius: 50%; border: none;
      background: rgba(255,255,255,0.18); backdrop-filter: blur(10px);
      color: #fff; display: flex; align-items: center; justify-content: center;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .wp-ce-carousel {
      position: relative; z-index: 2; flex: 1;
      display: flex; align-items: center;
      overflow-x: auto; overflow-y: hidden;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .wp-ce-carousel::-webkit-scrollbar { display: none; }
    .wp-ce-card {
      flex-shrink: 0; scroll-snap-align: center;
      height: 320px; border-radius: 22px; overflow: hidden;
      box-shadow: 0 14px 34px rgba(0,0,0,0.35);
      cursor: pointer; transition: transform 0.05s linear, opacity 0.05s linear;
      -webkit-tap-highlight-color: transparent;
    }
    .wp-ce-card-photo {
      position: relative; width: 100%; height: 100%;
      background-size: cover; background-position: center;
      display: flex; align-items: flex-end;
    }
    .wp-ce-card-fade {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.15) 45%, transparent 70%);
    }
    .wp-ce-card-text { position: relative; z-index: 1; padding: 16px; color: #fff; }
    .wp-ce-card-rating { font-size: 12px; font-weight: 700; color: #fbbf24; margin-bottom: 3px; }
    .wp-ce-card-name { font-size: 17px; font-weight: 800; line-height: 1.25; text-shadow: 0 1px 4px rgba(0,0,0,0.35); }
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
    this.pinClusters     = null; // clusters personalizados (SuperUser) — null = aún no cargados
    this.onClusterCustomize = null; // callback (group, existingClusterOrNull) — lo asigna SuperUserPanel al hacer long-press
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
      // Parallax de pines durante el drag: se calcula cuánto se movió en
      // pantalla el punto donde estaba el centro al empezar el drag
      // (proyectando ESE lnglat fijo contra la cámara actual en cada
      // frame), y se aplica una fracción de ese desplazamiento —en
      // sentido contrario— a los pines vía CSS custom properties. Con
      // PARALLAX_LAG=0.15, los pines "solo avanzan" un 85% de lo que
      // avanza el mapa, dando sensación de profundidad/capas.
      const PARALLAX_LAG = 0.15;
      let _dragStartCenter = null, _dragStartPx = null;
      this.map.on('dragstart', () => {
        document.body.classList.add('map-dragging');
        _dragStartCenter = this.map.getCenter();
        _dragStartPx     = this.map.project(_dragStartCenter);
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
      this.map.on('drag', () => {
        if (!_dragStartCenter) return;
        const nowPx = this.map.project(_dragStartCenter);
        const dx = nowPx.x - _dragStartPx.x;
        const dy = nowPx.y - _dragStartPx.y;
        document.documentElement.style.setProperty('--wp-parallax-x', (-dx * PARALLAX_LAG).toFixed(1) + 'px');
        document.documentElement.style.setProperty('--wp-parallax-y', (-dy * PARALLAX_LAG).toFixed(1) + 'px');
      });
      this.map.on('dragend', () => {
        document.body.classList.remove('map-dragging');
        _dragStartCenter = null; _dragStartPx = null;
        document.documentElement.style.setProperty('--wp-parallax-x', '0px');
        document.documentElement.style.setProperty('--wp-parallax-y', '0px');
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

      // Ghost-pan fix
      const c = this.map.getContainer();
      c.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.maplibregl-marker')) return;
        let moved = false;
        const onMove = () => { moved = true; };
        const onEnd  = () => {
          c.removeEventListener('touchmove', onMove, { capture: true });
          c.removeEventListener('touchend',  onEnd,  { capture: true });
          if (!moved) e.target.dispatchEvent(new TouchEvent('touchcancel', {
            bubbles: true, cancelable: false,
            touches: [], targetTouches: [], changedTouches: e.changedTouches
          }));
        };
        c.addEventListener('touchmove', onMove, { capture: true, passive: true });
        c.addEventListener('touchend',  onEnd,  { capture: true, passive: true });
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
            if (isMoto)      { map.setPaintProperty(id,'line-color','#f9a825'); map.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],10,6,14,16,16,22,18,28]); }
            else if (isPrim) { map.setPaintProperty(id,'line-color','#fcd858'); map.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],11,5,14,12,16,18,18,24]); }
            else if (isSec)  { map.setPaintProperty(id,'line-color','#ffffff'); map.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],12,4,14,8,16,14,18,20]); }
            else             { map.setPaintProperty(id,'line-color','#ffffff'); map.setPaintProperty(id,'line-width',['interpolate',['linear'],['zoom'],13,2.5,14,5,16,10,18,16]); }
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

      el.addEventListener('click', (e) => {
        e.stopPropagation();
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
    const zoom = Math.floor(this.map.getZoom());
    this.markerEls.forEach(el => {
      if (!el) return;
      const threshold = el._showAtZoom ?? 13;
      // 3 estados: 0=oculto, 1=punto celeste (1 zoom antes), 2=pin completo
      const state = zoom >= threshold ? 2 : zoom >= threshold - 1 ? 1 : 0;
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
    this.clusterMarkers.forEach(m => m?.remove());
    this.clusterMarkers = [];
  }

  _updateClusters() {
    this._clearClusters();

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

    if (this.map.getZoom() >= 17.2) return; // ya hay espacio, no agrupar

    const CLUSTER_PX = 58;   // distancia máxima en pantalla para agrupar (auto)
    const MIN_GROUP  = 3;    // mínimo de pines juntos para volverse cluster (auto)

    const candidates = this.markerEls
      .filter(el => el.style.display !== 'none' && el.style.visibility !== 'hidden' && el._place)
      .map(el => {
        const ll = el._marker.getLngLat();
        return { el, ll, px: this.map.project(ll) };
      });

    const usedEls = new Set();

    // 1) Clusters PERSONALIZADOS por el SuperUser — fijos por place_id,
    // sin importar la distancia real entre ellos (curados a mano). Se
    // renderizan sin importar cuántos lugares tengan — el MIN_GROUP de
    // abajo solo aplica al clustering automático.
    (this.pinClusters || []).forEach(customDef => {
      const members = candidates.filter(c =>
        !usedEls.has(c.el) && (customDef.placeIds || []).includes(c.el._place.place_id || c.el._place.id)
      );
      if (!members.length) return;
      members.forEach(m => usedEls.add(m.el));
      this._renderClusterMarker(members, customDef);
    });

    // 2) Clustering automático por cercanía en pantalla para el resto
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

    groups.filter(g => g.length >= MIN_GROUP).forEach(group => this._renderClusterMarker(group, null));
  }

  // Crea el marker del cluster (personalizado o automático) con doble
  // gesto: tap normal → abre el carrusel expandido (_openClusterExpand);
  // long-press (solo si SuperUserPanel dejó seteado this.onClusterCustomize)
  // → abre el panel de personalización, pasando el grupo actual y la
  // definición existente (o null si es la primera vez que se personaliza).
  _renderClusterMarker(group, customDef) {
    const centerLat = group.reduce((s, g) => s + g.ll.lat, 0) / group.length;
    const centerLng = group.reduce((s, g) => s + g.ll.lng, 0) / group.length;

    group.forEach(({ el }) => {
      el._clusterHiddenDisplay = el.style.display;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    });

    const el = document.createElement('div');
    el.className = 'place-cluster-el';
    el.style.cssText = 'position:relative;width:2px;height:2px;overflow:visible;cursor:pointer;';
    el.innerHTML = _buildClusterStickerHtml(group, customDef);

    let pressTimer = null, longPressFired = false, startX = 0, startY = 0;
    el.addEventListener('pointerdown', (e) => {
      longPressFired = false;
      startX = e.clientX; startY = e.clientY;
      pressTimer = setTimeout(() => {
        longPressFired = true;
        this._cancelActiveClusterPress = null;
        if (this.onClusterCustomize) {
          this.haptic('longpress');
          this.onClusterCustomize(group, customDef || null);
        }
      }, 550);
      this._cancelActiveClusterPress = clearPress; // ver map.on('dragstart') — cancela si arranca un drag real del mapa
    });
    const clearPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (this._cancelActiveClusterPress === clearPress) this._cancelActiveClusterPress = null;
    };
    el.addEventListener('pointermove', (e) => {
      if (pressTimer && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) clearPress();
    });
    el.addEventListener('pointerup', clearPress);
    el.addEventListener('pointercancel', clearPress);
    el.addEventListener('pointerleave', clearPress);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (longPressFired) { longPressFired = false; return; } // el long-press ya actuó, no abrir el carrusel también
      this.haptic('tap');
      this._openClusterExpand(group);
    });

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([centerLng, centerLat])
      .addTo(this.map);

    this.clusterMarkers.push(marker);
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
  _openClusterExpand(group) {
    if (this._clusterExpandEl) this._closeClusterExpand();

    // Guardamos cámara original para restaurarla al cerrar sin dejar el
    // mapa "pegado" en el lugar que se estaba mirando dentro del carrusel.
    this._clusterExpandOrigCamera = { center: this.map.getCenter(), zoom: this.map.getZoom() };

    const CARD_W = 240, CARD_GAP = 16;
    const wrap = document.createElement('div');
    wrap.className = 'wp-ce-wrap';
    wrap.innerHTML = `
      <div class="wp-ce-bg"></div>
      <div class="wp-ce-header">
        <div class="wp-ce-count">${group.length} lugares</div>
        <button type="button" class="wp-ce-close" aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="wp-ce-carousel" style="padding:0 calc(50% - ${CARD_W / 2}px);gap:${CARD_GAP}px;">
        ${group.map(({ el: markerEl }) => {
          const place = markerEl._place;
          const photo = proxyPhoto(place.photoUrl || place.photo_url || place.photosUrls?.[0] || null);
          const rating = place.rating ? `★ ${Number(place.rating).toFixed(1)}` : '';
          return `<div class="wp-ce-card" style="width:${CARD_W}px;">
            <div class="wp-ce-card-photo" style="${photo ? `background-image:url('${photo}')` : 'background:linear-gradient(160deg,#e5e7eb,#d1d5db)'}">
              <div class="wp-ce-card-fade"></div>
              <div class="wp-ce-card-text">
                ${rating ? `<div class="wp-ce-card-rating">${rating}</div>` : ''}
                <div class="wp-ce-card-name">${place.name || ''}</div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
    document.body.appendChild(wrap);
    this._clusterExpandEl = wrap;
    document.body.style.overflow = 'hidden';

    const carousel = wrap.querySelector('.wp-ce-carousel');
    const bg       = wrap.querySelector('.wp-ce-bg');
    const cards    = Array.from(wrap.querySelectorAll('.wp-ce-card'));
    const step     = CARD_W + CARD_GAP;

    const lerp = (a, b, t) => a + (b - a) * t;

    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const idx  = carousel.scrollLeft / step;
        const i0   = Math.max(0, Math.min(group.length - 1, Math.floor(idx)));
        const i1   = Math.min(group.length - 1, i0 + 1);
        const frac = Math.min(1, Math.max(0, idx - i0));

        // Parallax real: el mapa de fondo interpola en vivo entre el punto
        // del lugar i0 y el i1 según el progreso exacto del scroll — no
        // espera a que la tarjeta "encaje" para saltar.
        const a = group[i0].ll, b = group[i1].ll;
        this.map.jumpTo({ center: [lerp(a.lng, b.lng, frac), lerp(a.lat, b.lat, frac)] });

        // Además, un pequeño desfasce del fondo respecto al scroll (mismo
        // lenguaje que el parallax del drag del mapa) para que no se
        // sienta como un bloque rígido pegado 1:1 al carrusel.
        bg.style.transform = `translateX(${(-carousel.scrollLeft * 0.04).toFixed(1)}px) scale(1.06)`;

        // Escala/opacidad por cercanía al centro — la tarjeta activa
        // resalta, las de al lado se achican levemente.
        cards.forEach((card, i) => {
          const dist = Math.abs(i - idx);
          const scale = Math.max(0.86, 1 - dist * 0.14);
          const op    = Math.max(0.55, 1 - dist * 0.35);
          card.style.transform = `scale(${scale.toFixed(3)})`;
          card.style.opacity   = op.toFixed(2);
        });
      });
    };
    carousel.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        const place = group[i].el._place;
        this._closeClusterExpand(/* restoreCamera */ false);
        if (this.onPlaceSelect) this.onPlaceSelect(place);
      });
    });

    wrap.querySelector('.wp-ce-close').addEventListener('click', () => this._closeClusterExpand());

    this._clusterExpandCleanup = () => carousel.removeEventListener('scroll', onScroll);

    requestAnimationFrame(() => wrap.classList.add('wp-ce-in'));
  }

  _closeClusterExpand(restoreCamera = true) {
    if (!this._clusterExpandEl) return;
    if (this._clusterExpandCleanup) this._clusterExpandCleanup();
    const wrap = this._clusterExpandEl;
    this._clusterExpandEl = null;
    document.body.style.overflow = '';
    wrap.classList.remove('wp-ce-in');
    setTimeout(() => wrap.remove(), 220);
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
  _showMiniCard(place, index, rawPhoto, skipMove = false) {
    this._closeMiniCard();
    this.miniCardPlace  = place;
    this.miniCardMarker = this.markers[index];
    this.miniCardIndex  = index;
    this.haptic('tap');

    const marker = this.markers[index];
    if (!marker) return;
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
// stickers decorativos y una etiqueta) en vez de un ícono con anillo.
//
// Modelo de datos GUARDADO (pin_clusters, columnas nuevas):
//   cards:    [{ placeId, shape:'portrait'|'square', rotation, scale,
//                dx, dy }]  — override opcional por lugar; si un lugar
//                             del grupo no tiene entrada acá, se usa el
//                             slot automático (CLUSTER_CARD_SLOTS) según
//                             su posición en el grupo.
//   stickers: [{ emoji|imageUrl, anchor, size, rotation, strokeColor }]
//   label:    { text, anchor } — texto puede traer "\n" para 2 líneas,
//                                 cada una en su propia píldora (como el
//                                 "CALLE / DE LOS AGACHADOS" de referencia)
//   badgeColor
//
// Todo opcional — un cluster SIN personalizar (customDef=null, o recién
// creado) ya se ve bien solo con los slots automáticos.
// ════════════════════════════════════════════════════════════════════

// Slots de posición/tamaño/rotación para hasta 6 tarjetas visibles,
// pensados para que la última (índice 4, la más grande) quede "al
// frente" — mismo espíritu disperso que la referencia de Moments.
// dx/dy en px desde el centro del pin; scale multiplica el tamaño base.
const CLUSTER_CARD_SLOTS = [
  { dx: -30, dy: -4,  rot: -4, scale: 0.74, z: 1 },
  { dx: 10,  dy: -22, rot: 3,  scale: 0.98, z: 2 },
  { dx: -16, dy: 10,  rot: -7, scale: 0.86, z: 3 },
  { dx: 30,  dy: 6,   rot: 6,  scale: 0.80, z: 4 },
  { dx: -8,  dy: 28,  rot: -1, scale: 1.06, z: 6 }, // principal (recibe la etiqueta)
  { dx: 34,  dy: 30,  rot: 7,  scale: 0.66, z: 5 },
];
export const CLUSTER_MAX_CARDS = CLUSTER_CARD_SLOTS.length;

// data-card-idx / data-sticker-idx quedan siempre en el HTML (no solo en
// el editor) — no hacen nada en el mapa real, pero le permiten al panel
// de edición enganchar el drag directo sobre CADA elemento sin duplicar
// esta función. Mismo criterio: una sola fuente de verdad para el dibujo.
export function _buildClusterStickerHtml(group, customDef) {
  const BASE_W = 46, BASE_H = 60; // tamaño base portrait (16:21, igual ratio que el pin individual)
  const cardsOverride = customDef?.cards || [];
  const shown = group.slice(0, CLUSTER_MAX_CARDS);

  const cardsHtml = shown.map(({ el }, i) => {
    const place = el._place;
    const pid = place.place_id || place.id;
    const override = cardsOverride.find(c => c.placeId === pid);
    const slot = CLUSTER_CARD_SLOTS[i] || CLUSTER_CARD_SLOTS[CLUSTER_CARD_SLOTS.length - 1];

    const shape = override?.shape || 'portrait';
    const scale = override?.scale ?? slot.scale;
    const rot   = override?.rotation ?? slot.rot;
    const dx    = override?.dx ?? slot.dx;
    const dy    = override?.dy ?? slot.dy;
    const z     = slot.z;

    const h = BASE_H * scale;
    const w = shape === 'square' ? h : BASE_W * scale;

    const photo = proxyPhoto(place.photoUrl || place.photo_url || place.photosUrls?.[0] || null);
    const bg = photo
      ? `background-image:url('${photo}');background-size:cover;background-position:center;`
      : `background:linear-gradient(160deg,#d1d5db,#9ca3af);`;

    // pointer-events:auto explícito — el CONTENEDOR grande de todo el
    // cluster va con pointer-events:none (ver el return final), así que
    // sin este auto acá la tarjeta ni siquiera sería tappeable.
    return `<div data-card-idx="${i}" style="position:absolute;left:50%;top:50%;width:${w}px;height:${h}px;border-radius:9px;${bg}border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.28);transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${rot}deg);z-index:${z};pointer-events:auto;"></div>`;
  }).join('');

  const stickersHtml = (customDef?.stickers || []).map((s, i) => {
    const size = s.size || 26;
    const strokeColor = s.strokeColor || '#ffffff';
    const strokeWidth = s.strokeWidth ?? 2;
    const dx = s.dx ?? 0, dy = s.dy ?? 0;
    const inner = s.imageUrl
      ? `<img src="${s.imageUrl}" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 0 ${strokeWidth}px ${strokeColor}) drop-shadow(0 0 ${strokeWidth}px ${strokeColor}) drop-shadow(0 2px 4px rgba(0,0,0,0.32));">`
      : s.emoji
      ? `<div style="font-size:${size}px;line-height:1;-webkit-text-stroke:${strokeWidth}px ${strokeColor};filter:drop-shadow(0 2px 4px rgba(0,0,0,0.32));">${s.emoji}</div>`
      : '';
    if (!inner) return '';
    return `<div data-sticker-idx="${i}" style="position:absolute;left:50%;top:50%;transform:translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${s.rotation || 0}deg);z-index:20;pointer-events:auto;">${inner}</div>`;
  }).join('');

  const badgeColor = customDef?.badgeColor || '#111827';
  const badgeHtml = `<div data-badge style="position:absolute;right:-6px;top:2px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:${badgeColor};color:#fff;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:30;pointer-events:auto;">+${group.length}</div>`;

  let labelHtml = '';
  const lbl = customDef?.label;
  if (lbl?.text) {
    const lines = lbl.text.split('\n').filter(Boolean).slice(0, 2);
    const bgColor = lbl.bgColor || '#1e1b8f';
    const textColor = lbl.textColor || '#ffffff';
    const fontSize = lbl.fontSize || 10;
    const padY = lbl.paddingY ?? 3, padX = lbl.paddingX ?? 8;
    const radius = lbl.borderRadius ?? 4;
    labelHtml = `<div data-label style="position:absolute;left:6px;bottom:0;display:flex;flex-direction:column;align-items:flex-start;gap:2px;z-index:25;pointer-events:auto;">` +
      lines.map(line => `<div style="background:${bgColor};color:${textColor};font-size:${fontSize}px;font-weight:800;letter-spacing:0.2px;text-transform:uppercase;padding:${padY}px ${padX}px;border-radius:${radius}px;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${line}</div>`).join('') +
      `</div>`;
  }

  // pointer-events:none acá es LA clave: este div mide 150x120 (o más, si
  // hay tarjetas/stickers desplazados afuera) pero es puramente un marco
  // de posicionamiento — sin este none, CUALQUIER toque dentro de esa
  // caja entera (incluyendo el espacio vacío/transparente entre tarjetas)
  // quedaba capturado por este elemento y burbujeaba como si se hubiera
  // tocado el cluster. Cada pieza visible (tarjeta/sticker/badge/label)
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