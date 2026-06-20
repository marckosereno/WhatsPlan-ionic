import { animateMinicardIn, animateMinicardOut } from '/src/utils/animations.js';
// ====================================================================
// WHATSPLAN — MapView.js
// Mapa Carto Positron + Blink Light + pins + labels + landmarks
// ====================================================================

import { ActivityService } from '/src/services/SupabaseService.js';
import { LandmarkService, CustomPlaceService } from '/src/services/SuperUserService.js';
import { SUBCATEGORIES_MAP } from '/src/components/SubcategoryRow.js';

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
function getSubcatIcon3d(place, catId) {
  const list = SUBCATEGORIES_MAP[catId];
  if (!list || !place) { console.log('🔍 sin lista —', place?.name, '| catId:', catId); return null; }
  let tags = place.subcategoryTags || place.subcategory_tags || '';
  if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (!Array.isArray(tags) || !tags.length) {
    console.log('🔍 SIN TAGS —', place.name, '| catId:', catId, '| raw subcategoryTags:', JSON.stringify(place.subcategoryTags), '| raw subcategory_tags:', JSON.stringify(place.subcategory_tags));
    return null;
  }
  for (const tag of tags) {
    const found = list.find(s => s.value.toLowerCase() === String(tag).toLowerCase());
    if (found && found.icon3d) {
      console.log('✅ MATCH —', place.name, '| tag:', tag, '| icon3d:', found.icon3d);
      return found.icon3d;
    }
  }
  console.log('❌ SIN MATCH —', place.name, '| catId:', catId, '| tags reales:', JSON.stringify(tags), '| valores esperados:', list.map(s=>s.value));
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
  pi.style.opacity    = '0';
  pi.style.background = `url('${photoUrl}') center/cover no-repeat`;
  pi.innerHTML        = '';
  pi.classList.remove('loading');
  pi.classList.add('loaded');
  requestAnimationFrame(() => { pi.style.opacity = '1'; });
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
      center:                [0, 15],         // intro: vista del planeta
      zoom:                  0.4,
      // minZoom/maxBounds se aplican DESPUÉS de la animación de llegada (ver _flyIntoTown)
      maxZoom:               19,
      attributionControl:    false,
      keyboard:              false,
      dragRotate:            false,
      pitchWithRotate:       false,
      pitch:                 0,
      renderWorldCopies:     false,
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

      // ── Intro: globo del planeta → vuelo hasta Nuevo Progreso ──────────
      try { this.map.setProjection({ type: 'globe' }); } catch(_) {}
      this._flyIntoTown();



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
      this.map.on('dragstart', () => { document.body.classList.add('map-dragging'); });
      this.map.on('dragend', () => { document.body.classList.remove('map-dragging'); });

      // Featured highlight — se activa al acercarse al centro, se limpia al alejar zoom
      const _featuredCheck = () => {
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

      // Labels y pines — solo en zoomend/moveend (nunca durante animación)
      const _updateOrHideLabels = () => {
        this._updatePinsByZoom();
        this._updateLabelsProgressive();
      };
      // Solo actualizar al TERMINAR zoom — nunca durante animación
      this.map.on('zoomend', _updateOrHideLabels);
      this.map.on('moveend', _updateOrHideLabels);

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

  // ── Intro: globo del planeta → vuelo animado hasta Nuevo Progreso ──────
  _flyIntoTown() {
    const map = this.map;
    // Pequeña pausa para que el globo se vea antes de empezar a volar
    setTimeout(() => {
      map.flyTo({
        center:   [CENTER_LNG, CENTER_LAT],
        zoom:     ZOOM,
        duration: 3800,
        curve:    1.42,
        speed:    0.85,
        essential: true,
      });
    }, 600);

    map.once('moveend', () => {
      // Llegamos — aplicar restricciones normales de navegación
      try {
        map.setMinZoom(12);
        map.setMaxBounds([
          [-98.1310, 25.9300],   // SW
          [-97.7702, 26.1900]    // NE
        ]);
      } catch(_) {}
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
      this._refreshActivityBadges();
    } catch(e) { console.warn('⚠️ Actividades:', e.message); }
  }

  async _loadLandmarks() {
    try { this._renderLandmarks(await LandmarkService.getAll()); }
    catch(e) { console.warn('⚠️ Landmarks:', e.message); }
  }

  async loadCategory(menuKey) {
    this.currentCatId   = menuKey;
    this.currentCatData = this.CATEGORIES[menuKey] || CATEGORIES[menuKey] || CATEGORIES['RESTAURANTS'];
    this._clearPlaceMarkers();
    try {
      const _t  = Date.now();
      const res  = await fetch(`/api/supabase-places?category=${menuKey}`);
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
        if (this.miniCardMarker === this.markers[index]) {
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
    // Re-aplicar tras fitBounds (el zoom puede cambiar)
    this.map.once('moveend', () => {
      this._updatePinsByZoom();
      this._updateLabelsProgressive();
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
      const show = zoom >= (el._showAtZoom ?? 13);
      if (show === el._wpVisible) return;
      el._wpVisible = show;
      if (show) {
        el.style.visibility    = 'visible';
        el.style.pointerEvents = '';
        el.style.transition    = 'opacity 0.35s ease';
        el.style.opacity       = '1';
      } else {
        el.style.transition    = 'none';
        el.style.opacity       = '0';
        el.style.visibility    = 'hidden';
        el.style.pointerEvents = 'none';
      }
    });
  }

  // ── Labels dinámicos por zoom + posición izquierda/derecha ──────────
  _updateLabelsProgressive() {
    if (this._labelTimers) this._labelTimers.forEach(t => clearTimeout(t));
    this._labelTimers = [];

    const zoom    = this.map.getZoom();
    const bounds  = this.map.getBounds();
    const screenW = this.map.getContainer().offsetWidth;

    // Ocultar todo si zoom < 16 — labels solo aparecen desde zoom 16
    if (zoom < 16) {
      document.querySelectorAll('.place-marker-el .place-pin-label').forEach(l => {
        l.style.opacity = '0'; l.style.display = 'none';
      });
      return;
    }

    // Nivel visual según zoom — fontSize SIEMPRE 16px, solo cambia opacidad
    const lvl = zoom >= 17 ? 'full' : zoom >= 16.5 ? 'mid' : 'small';
    const opacity = lvl === 'full' ? '1' : lvl === 'mid' ? '0.88' : '0.72';

    const center = this.map.getCenter();
    const els = Array.from(document.querySelectorAll('.place-marker-el'));
    const visible = els.map(el => {
      const idx = this.markerEls.indexOf(el);
      if (idx === -1) return null;
      const marker = this.markers[idx];
      if (!marker) return null;
      // No mostrar label si el pin está oculto por zoom
      if (el.style.visibility === 'hidden') {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; }
        return null;
      }
      const ll = marker.getLngLat();
      if (!bounds.contains(ll)) {
        const lbl = el.querySelector('.place-pin-label');
        if (lbl) { lbl.style.opacity = '0'; }
        return null;
      }
      // Posición en pantalla para decidir izquierda/derecha
      const pt = this.map.project(ll);
      const side = pt.x > screenW / 2 ? 'left' : 'right';
      const dx = ll.lng - center.lng, dy = ll.lat - center.lat;
      return { el, dist: Math.sqrt(dx*dx + dy*dy), side, pt };
    }).filter(Boolean).sort((a, b) => a.dist - b.dist);

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

      // font-size fijo en 16px — NO se sobreescribe aquí
      // Resetear display para que -webkit-line-clamp funcione
      label.style.cssText += ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;';

      const t = setTimeout(() => {
        // No mostrar label si el pin está en highlight
        const pinRoot = el.closest('.place-marker-el');
        if (pinRoot && pinRoot.classList.contains('featured-highlight')) return;
        label.style.opacity = opacity;
      }, i * 25);
      this._labelTimers.push(t);
    });
  }

  // ── MiniCard ──────────────────────────────────────────────────────
  _showMiniCard(place, index, rawPhoto) {
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

    wrapper.style.marginTop = '-45px';

    // Icono de fallback — se calcula SIEMPRE (sirve si no hay foto o si la foto falla)
    const mcSubIcon3d = getSubcatIcon3d(place, this.currentCatId);
    const mcIcon3d    = mcSubIcon3d || cat?.icon3d || '';
    const mcEmoji     = cat?.icon || '💎';
    const mcIconInner = mcIcon3d
      ? `<img src="${mcIcon3d}" style="width:26px;height:26px;object-fit:contain;" onerror="this.outerHTML='${mcEmoji}'">`
      : mcEmoji;
    const mcFallbackHtml = `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${cardGrad};border-radius:10px;font-size:22px;flex-shrink:0;">${mcIconInner}</div>`;

    // Minicard con mismo estilo exacto del original PWA
    wrapper.innerHTML = `<div class="minicard-marker-content" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.96);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:none;border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,0.14);cursor:pointer;max-width:260px;min-width:160px;-webkit-tap-highlight-color:rgba(0,0,0,0);user-select:none;font-family:'Yahoo Sans Bold Regular',system-ui,sans-serif;">
      ${photoUrl
        ? `<div class="wp-mc-photo-wrap" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;position:relative;overflow:hidden;background:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);background-size:400% 100%;animation:wp-mc-skeleton 1.4s ease-in-out infinite;">
            <img src="${photoUrl}" data-fb-icon="${mcIcon3d}" data-fb-emoji="${mcEmoji}" data-fb-bg="${cardGrad}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.25s" onload="this.style.opacity=1;this.parentNode.style.animation='none';this.parentNode.style.background='none'" onerror="window._wpMcImgError(this)">
          </div>`
        : mcFallbackHtml}
      <div style="flex:1;min-width:0;overflow:hidden;">
        <div style="font-size:14px;font-weight:900;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.2px;">${place.name}</div>
        ${rating  ? `<div style="font-size:11px;font-weight:600;color:#92400e;">${rating}</div>` : ''}
        ${address ? `<div style="font-size:10px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${address}</div>` : ''}
      </div>
      <div style="font-size:16px;flex-shrink:0;margin-left:2px;color:#9ca3af;">›</div>
    </div>`;

    const card = wrapper.querySelector('.minicard-marker-content');
    if (card) {
      animateMinicardIn(card);
      let tx = 0, ty = 0;
      card.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
      card.addEventListener('touchend', e => {
        if (Math.abs(e.changedTouches[0].clientX - tx) > 8 || Math.abs(e.changedTouches[0].clientY - ty) > 8) return;
        e.stopPropagation(); e.preventDefault();
        this.haptic('select');
        if (this.onPlaceSelect) this.onPlaceSelect(place);
      });
      card.addEventListener('click', e => {
        e.stopPropagation();
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

      // Top edge: bottom de la barra de búsqueda o topbar
      const topbar  = document.getElementById('topbar-right-chip');
      const topEdge = topbar ? topbar.getBoundingClientRect().bottom + 8 : 68;

      // Bot edge: buscar el elemento visible más alto en la parte inferior
      const scats   = document.getElementById('wp-scats');
      const results = document.getElementById('wp-sresults');
      const panel   = document.querySelector('.map-results-panel-float') || document.getElementById('map-results-panel');

      // Bot edge: panel principal, scats y mini snap
      let botEdge;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const panelTop  = panelRect && panelRect.top > 0 && panelRect.top < visibleH ? panelRect.top : 9999;
      const scatsTop  = scats && scats.offsetParent !== null ? scats.getBoundingClientRect().top : 9999;
      const msEl      = document.getElementById('wp-minisnap-panel');
      const msRect    = msEl ? msEl.getBoundingClientRect() : null;
      const msTop     = msRect && msRect.top > topEdge && msRect.top < visibleH ? msRect.top : 9999;

      const candidates = [panelTop, scatsTop, msTop].filter(v => v > topEdge + 50 && v < visibleH + 200);
      botEdge = candidates.length > 0 ? Math.min(...candidates) - 8 : visibleH - 8;

      // Minicard: ~90px altura, aparece encima del pin
      // Para centrar la minicard (no el pin) en areaCenter:
      // - el centro de la minicard = pinTarget - 90/2 = areaCenter
      // - pinTarget = areaCenter + 45   ← centro del pin
      // Para que el centro VISUAL del conjunto (pin + minicard) quede centrado:
      // - conjunto total ≈ 130px (minicard 90 + pin 40)
      // - centro del conjunto = pinTarget - 90 + 65 = pinTarget - 25
      // - pinTarget = areaCenter + 25
      const areaCenter = topEdge + (botEdge - topEdge) / 2;
      const pinTarget  = areaCenter + 35;   // baja la minicard para centrar el conjunto
      const offsetY    = Math.round(pinTarget - canvasH / 2);

      // DEBUG disabled

      this.map.easeTo({
        center: [lng, lat],
        duration: 300,
        offset: [0, offsetY]
      });
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
      wrapper.style.width     = '44px';
      wrapper.style.height    = '44px';
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
          label.style.cssText = [
            'position:absolute', 'left:calc(100% + 3px)', 'top:50%',
            'transform:translateY(-60%)', 'white-space:nowrap',
            'background:rgba(10,10,20,0.78)', 'color:#fff',
            'font-size:9px', 'font-weight:700',
            "font-family:'Yahoo Sans Bold Regular',system-ui,sans-serif",
            'padding:2px 6px', 'border-radius:20px', 'pointer-events:none',
            'opacity:1', `transition:opacity 0.4s ease ${seed}ms`,
            'max-width:110px', 'overflow:hidden', 'text-overflow:ellipsis',
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
        label.style.cssText = 'background:white;border-radius:12px;padding:4px 10px;font-size:11px;font-weight:800;color:#1a1a2e;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);max-width:130px;overflow:hidden;text-overflow:ellipsis;font-family:\'Yahoo Sans Bold Regular\',system-ui,sans-serif;';
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
      const nameEl  = el.querySelector('.pin-featured-name');
      const shadow  = el.querySelector('.pin-featured-shadow');
      const badge   = el.querySelector('.pin-featured-badge');
      if (wrapper) {
        wrapper.style.transform = '';
        wrapper.style.boxShadow = wrapper.dataset.liquidShadow || wrapper._liquidShadow || '';
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
    const wrapper = closest.el.querySelector('.place-pin-wrapper');
    if (wrapper) {
      wrapper.style.transition = 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)';
      wrapper.style.transform  = 'scale(1.35) translateY(-6px)';
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
      const nameEl = document.createElement('div');
      nameEl.className = 'pin-featured-name';
      nameEl.style.cssText = 'position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;animation:featuredNameIn 0.2s ease;';
      nameEl.innerHTML =
        '<div style="font-size:13px;font-weight:800;color:#1f2937;font-family:\'Yahoo Sans Bold Regular\',system-ui,sans-serif;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;">' +
        closest.place.name + '</div>' +
        '<div style="font-size:9px;font-weight:700;background:' +
        (closest.place.featured==='verified'?'linear-gradient(135deg,#10b981,#059669)':closest.place.featured==='premium'?'linear-gradient(135deg,#3b82f6,#2563eb)':'linear-gradient(135deg,#f59e0b,#f97316)') +
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
      banner.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px)+12px);left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,0.82);color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:999px;font-family:Roboto,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;';
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

  flyTo(lng, lat, zoom = 17) { this.map.flyTo({ center: [lng, lat], zoom, duration: 600 }); }
  getMap() { return this.map; }
}
// PATCH: _buildPinHtml — foto con borde liquid celestial 3D + Roboto
MapView.prototype._buildPinHtml = function(place, photoUrl, catIcon) {
  const shortName = place.name || '';
  const isFeat    = !!place.featured;
  const featType  = typeof place.featured === 'string' ? place.featured : '';

  const featHtml  = '';  // Sin badge en el pin
  const pulseHtml = isFeat ? '<div class="pin-pulse"></div>' : '';

  const liquidBg     = 'linear-gradient(145deg,rgba(255,255,255,1) 0%,rgba(210,235,255,0.95) 40%,rgba(180,215,255,0.88) 65%,rgba(255,255,255,0.98) 100%)';
  const liquidShadow = '0 0 0 1.5px rgba(160,205,255,0.5),0 3px 10px rgba(100,170,255,0.22),0 1px 3px rgba(0,0,0,0.18),inset 0 1px 0 rgba(255,255,255,0.9)';
  const featShadow   = '0 0 0 2.5px #FF6D00,0 0 0 4.5px rgba(255,109,0,0.2),0 3px 10px rgba(255,109,0,0.3),inset 0 1px 0 rgba(255,255,255,0.9)';
  const activeShadow = isFeat ? featShadow : liquidShadow;

  // Label: más grande, más ancho
  const labelHtml = `<div class="place-pin-label" style="position:absolute;left:26px;top:50%;transform:translateY(-50%);display:none;opacity:0;font-size:13px;font-weight:700;line-height:1.05;font-family:'Roboto',system-ui,sans-serif;color:#1a1a2e;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;max-width:150px;max-height:2.4em;white-space:normal;pointer-events:none;letter-spacing:-0.1px;text-transform:capitalize;text-shadow:-1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff;transition:opacity 0.22s ease;">${shortName}</div>`;

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