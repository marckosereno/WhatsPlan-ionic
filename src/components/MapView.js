// ====================================================================
// WHATSPLAN — MapView.js
// Mapa Carto Positron + Blink Light + pins + labels + landmarks
// ====================================================================

import { ActivityService } from '/src/services/SupabaseService.js';
import { LandmarkService, CustomPlaceService } from '/src/services/SuperUserService.js';

const CENTER_LNG = -97.9506;
const CENTER_LAT =  25.9950;
const ZOOM       = 16;
const MAP_STYLE  = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const BL_BG       = '#ededea';
const BL_LAND     = '#ededea';
const BL_WATER    = '#00bcd4';
const BL_PARK     = '#b8d4b0';
const BL_BUILDING = '#e0e0db';
const BL_TEXT     = '#4a4a4a';
const BL_HALO     = 'rgba(237,237,234,0.95)';
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

// ── Supabase resize ──────────────────────────────────────────────────
function supabaseResize(url, width, quality, mode) {
  width   = width   || 80;
  quality = quality || 75;
  mode    = mode    || 'contain';
  if (!url || !url.includes('supabase.co')) return url;
  if (url.includes('/render/image/')) return url;
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    + '?width=' + width + '&quality=' + quality + '&resize=' + mode;
}

function proxyPhoto(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('supabase.co')) return supabaseResize(url, 80, 75, 'contain');
  return '/api/photo-proxy?url=' + encodeURIComponent(url);
}

// ── Fade-in de foto en pin ───────────────────────────────────────────
function applyPhotoToPin(photoUrl, el) {
  const pi = el.querySelector('.pin-inner');
  if (!pi || pi.classList.contains('loaded')) return;
  pi.style.opacity    = '0';
  pi.style.background = "url('" + photoUrl + "') center/cover no-repeat";
  pi.innerHTML        = '';
  pi.classList.remove('loading');
  pi.classList.add('loaded');
  requestAnimationFrame(function() { pi.style.opacity = '1'; });
}

function applyErrorToPin(el) {
  const pi = el.querySelector('.pin-inner');
  if (!pi) return;
  pi.classList.remove('loading');
  pi.style.background = 'transparent';
}

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
  haptic(type) {
    type = type || 'tap';
    if (!navigator.vibrate) return;
    const patterns = {
      tap: 15, select: 12, snap: 25,
      action: [30, 20, 60], longpress: [40, 30, 40], light: 10
    };
    navigator.vibrate(patterns[type] !== undefined ? patterns[type] : type);
  }

  // ── Init mapa ────────────────────────────────────────────────────
  _initMap() {
    injectLandmarkStyles();

    this.map = new maplibregl.Map({
      container:             'map-container',
      style:                 MAP_STYLE,
      center:                [CENTER_LNG, CENTER_LAT],
      zoom:                  ZOOM,
      attributionControl:    false,
      keyboard:              false,
      dragRotate:            false,
      pitchWithRotate:       false,
      maxTileCacheSize:      20,
      fadeDuration:          0,
      preserveDrawingBuffer: false,
    });

    this.map.on('load', () => {
      console.log('✅ Mapa listo');

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
      this.map.on('dragstart', function() { document.body.classList.add('map-dragging'); });
      this.map.on('dragend',   function() { document.body.classList.remove('map-dragging'); });

      // Featured highlight — se activa al acercarse al centro, se limpia al alejar zoom
      const self = this;
      const _featuredCheck = function() {
        if (self.map.getZoom() >= 17) {
          self._checkFeaturedNearCenter();
        } else if (self._featuredHighlightEl) {
          self._clearFeaturedHighlight();
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
            box-shadow: 0 0 0 2px #a5b4fc, 0 0 0 4px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.4) !important;
            transition: box-shadow 0.2s ease;
          }
          @keyframes featuredNameIn {
            from { opacity:0; transform:translateX(-50%) translateY(4px); }
            to   { opacity:1; transform:translateX(-50%) translateY(0); }
          }
        `;
        document.head.appendChild(fs);
      }

      // Badge visible en zoom >= 15
      let _zt = null;
      this.map.on('zoom', () => {
        if (_zt) return;
        _zt = setTimeout(() => {
          _zt = null;
          const show = this.map.getZoom() >= 15 ? '1' : '0';
          document.querySelectorAll('.place-act-badge').forEach(function(b) { b.style.opacity = show; });
        }, 80);
      });

      // Labels visibles en zoom >= 18 — aparecen/desaparecen con el viewport
      const _updateOrHideLabels = () => {
        if (this.map.getZoom() >= 18) {
          this._updateLabelsProgressive();
        } else {
          if (this._labelTimers) this._labelTimers.forEach(function(t) { clearTimeout(t); });
          this._labelTimers = [];
          document.querySelectorAll('.place-marker-el .place-pin-label').forEach(function(l) {
            l.style.opacity = '0';
            l.style.display = 'none';
          });
        }
      };
      this.map.on('zoomend', _updateOrHideLabels);
      this.map.on('moveend', _updateOrHideLabels);

      // Ghost-pan fix
      const c = this.map.getContainer();
      c.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.maplibregl-marker')) return;
        let moved = false;
        const onMove = function() { moved = true; };
        const onEnd  = function() {
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
      if (e.originalEvent.target.closest('.minicard-wrap')) return;
      this._closeMiniCard();
    });
  }

  // ── Blink Light ───────────────────────────────────────────────────
  _applyBlinkLight() {
    try {
      const style = this.map.getStyle();
      if (!style || !style.layers) return;
      style.layers.forEach(layer => {
        if (!layer.id) return;
        const id = layer.id;
        const type = layer.type;

        if (type === 'background') {
          this.map.setPaintProperty(id, 'background-color', BL_BG);
        } else if (type === 'fill') {
          if (/water|ocean|sea|lake|river/.test(id)) {
            this.map.setPaintProperty(id, 'fill-color', BL_WATER);
          } else if (/park|green|grass|forest|wood|nature/.test(id)) {
            this.map.setPaintProperty(id, 'fill-color', BL_PARK);
          } else if (/building|structure/.test(id)) {
            this.map.setPaintProperty(id, 'fill-color', BL_BUILDING);
          } else {
            this.map.setPaintProperty(id, 'fill-color', BL_LAND);
          }
        } else if (type === 'line') {
          if (/benito|juarez/.test(id)) {
            this.map.setPaintProperty(id, 'line-color', BENITO_LINE);
          } else if (/water|ocean|sea|lake|river/.test(id)) {
            this.map.setPaintProperty(id, 'line-color', BL_WATER);
          } else {
            this.map.setPaintProperty(id, 'line-color', 'rgba(200,200,196,0.6)');
          }
        } else if (type === 'symbol') {
          try { this.map.setPaintProperty(id, 'text-color', BL_TEXT); } catch(e) {}
          try { this.map.setPaintProperty(id, 'text-halo-color', BL_HALO); } catch(e) {}
          try { this.map.setPaintProperty(id, 'text-halo-width', 1.5); } catch(e) {}
          if (/benito|juarez/.test(id)) {
            try { this.map.setPaintProperty(id, 'text-color', BENITO_TEXT); } catch(e) {}
          }
        }
      });
      console.log('✅ Blink Light aplicado');
    } catch(e) { console.warn('⚠️ Blink Light error:', e.message); }
  }

  // ── Landmarks ─────────────────────────────────────────────────────
  async _loadLandmarks() {
    try {
      const items = await LandmarkService.getAll();
      this._renderLandmarks(items);
    } catch(e) { console.warn('⚠️ Landmarks:', e.message); }
  }

  // ── Actividades ───────────────────────────────────────────────────
  async _loadActivities() {
    try {
      const acts = await ActivityService.getAll();
      this.activities = acts || [];
      this._refreshActivityBadges();
    } catch(e) { console.warn('⚠️ Actividades:', e.message); }
  }

  // ── Cargar categoría ─────────────────────────────────────────────
  async loadCategory(menuKey, catData) {
    if (catData) this.currentCatData = catData;
    this.currentCatId = menuKey;

    // Limpiar marcadores anteriores
    this.markers.forEach(function(m) { m.remove(); });
    this.markers   = [];
    this.markerEls = [];
    this.allPlaces = [];
    this._closeMiniCard();

    try {
      // Cargar lugares desde Supabase
      const { data, error } = await window._supabase
        .from('places')
        .select('*')
        .eq('category', menuKey)
        .eq('visible', true);

      if (error) throw error;
      const places = data || [];

      // También cargar lugares custom del SuperUser
      let custom = [];
      try { custom = await CustomPlaceService.getByCategory(menuKey); } catch(e) {}

      const all = places.concat(custom);
      this.allPlaces = all;

      all.forEach((place, i) => {
        const el = document.createElement('div');
        el.className = 'place-marker-el';
        el._place  = place;

        const html = this._buildPinHtml(place);
        el.innerHTML = html;

        const lat = (place.location && place.location.lat) || place.lat;
        const lng = (place.location && place.location.lng) || place.lng;
        if (!lat || !lng) return;

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(this.map);

        el._marker = marker;
        this.markers.push(marker);
        this.markerEls.push(el);

        // Cargar foto si hay
        const photoUrl = place.photo_url || (place.photos && place.photos[0]);
        if (photoUrl) {
          const proxied = proxyPhoto(photoUrl);
          const img = new Image();
          img.onload  = function() { applyPhotoToPin(proxied, el); };
          img.onerror = function() { applyErrorToPin(el); };
          img.src = proxied;
        }

        // Click en el pin
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.haptic('select');
          const rawPhoto = place.photo_url || (place.photos && place.photos[0]) || null;
          this._showMiniCard(place, i, rawPhoto);
        });
      });

      this._refreshActivityBadges();
      this._renderLandmarks();
      console.log('✅ Categoría cargada:', menuKey, '(' + all.length + ' lugares)');
    } catch(e) {
      console.error('❌ Error cargando categoría:', e.message);
    }
  }

  // ── Build pin HTML ────────────────────────────────────────────────
  _buildPinHtml(place) {
    const isFeatured = place.featured && place.featured !== 'none';
    const actCount   = this._activityCount(place);
    const hasAct     = actCount > 0;

    let featuredBadge = '';
    if (isFeatured) {
      const bg   = place.featured === 'verified' ? '#059669' : place.featured === 'premium' ? '#7c3aed' : 'rgba(0,0,0,0.65)';
      const icon = place.featured === 'verified' ? '✓' : '⭐';
      featuredBadge = '<div class="pin-featured-badge" style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:' + bg + ';color:white;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;border:1.5px solid white;z-index:2;">' + icon + '</div>';
    }

    let actBadge = '';
    if (hasAct) {
      actBadge = '<div class="place-act-badge" style="position:absolute;top:-6px;left:-6px;min-width:16px;height:16px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 3px;border:1.5px solid white;z-index:2;opacity:' + (this.map.getZoom() >= 15 ? '1' : '0') + ';">' + actCount + '</div>';
    }

    // Label solo si NO es featured (para evitar duplicado con el badge de highlight)
    const labelHtml = !isFeatured
      ? '<div class="place-pin-label" style="position:absolute;left:calc(100% + 4px);top:50%;transform:translateY(-50%);background:rgba(10,10,20,0.75);color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px;white-space:nowrap;pointer-events:none;opacity:0;display:none;max-width:100px;overflow:hidden;text-overflow:ellipsis;font-family:\'Yahoo Sans Bold Regular\',system-ui,sans-serif;">' + (place.name || '') + '</div>'
      : '';

    return '<div class="place-pin-root" style="position:relative;display:inline-flex;align-items:center;">' +
      '<div class="place-pin-rel" style="position:relative;">' +
        '<div class="place-pin-wrapper" style="width:40px;height:40px;border-radius:50%;border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);overflow:hidden;background:#f3f4f6;">' +
          '<div class="pin-inner loading" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;transition:opacity 0.3s;">' +
            (this.currentCatData ? (this.currentCatData.icon || '📍') : '📍') +
          '</div>' +
        '</div>' +
        featuredBadge +
        actBadge +
      '</div>' +
      labelHtml +
    '</div>';
  }

  // ── Labels progresivos ────────────────────────────────────────────
  _updateLabelsProgressive() {
    if (this._labelTimers) this._labelTimers.forEach(function(t) { clearTimeout(t); });
    this._labelTimers = [];
    const bounds = this.map.getBounds();
    this.markerEls.forEach((el, i) => {
      const place = this.allPlaces[i];
      if (!place) return;
      const lat = (place.location && place.location.lat) || place.lat;
      const lng = (place.location && place.location.lng) || place.lng;
      if (!lat || !lng) return;
      const inView = bounds.contains([lng, lat]);
      const lbl = el.querySelector('.place-pin-label');
      if (!lbl) return;
      if (inView) {
        const t = setTimeout(function() {
          lbl.style.display = 'block';
          requestAnimationFrame(function() { lbl.style.opacity = '1'; });
        }, i * 30);
        this._labelTimers.push(t);
      } else {
        lbl.style.opacity = '0';
        lbl.style.display = 'none';
      }
    });
  }

  // ── MiniCard ──────────────────────────────────────────────────────
  _showMiniCard(place, index, rawPhoto) {
    this._closeMiniCard();
    this.miniCardPlace  = place;
    this.miniCardMarker = this.markers[index];
    this.miniCardIndex  = index;

    const rating  = place.rating ? '⭐ ' + Number(place.rating).toFixed(1) : '';
    const address = ((place.formattedAddress || place.formatted_address || '').substring(0, 32));
    const hasAct  = this._activityCount(place) > 0;
    const cat     = this.currentCatData;
    const cardGrad = hasAct ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#c4b5fd,#7dd3fc)';
    const miniPhoto = proxyPhoto(rawPhoto);

    // Calcular posición del marcador en pantalla para centrar la minicard
    const markerLngLat = this.miniCardMarker.getLngLat();
    const pt = this.map.project(markerLngLat);

    const miniWrap = document.createElement('div');
    miniWrap.id = 'active-minicard';
    miniWrap.style.cssText = [
      'position:fixed',
      'z-index:99999',
      'left:' + Math.round(pt.x) + 'px',
      'top:'  + Math.round(pt.y) + 'px',
      'transform:translate(-50%,-50%)',
      'pointer-events:auto'
    ].join(';');

    miniWrap.innerHTML =
      '<div class="minicard-wrap">' +
        (miniPhoto
          ? '<img src="' + miniPhoto + '" class="minicard-photo" onerror="this.style.display=\'none\'">'
          : '<div class="minicard-icon" style="background:' + cardGrad + '">' + (cat && cat.icon ? cat.icon : '💎') + '</div>') +
        '<div class="minicard-body">' +
          '<div class="minicard-name">' + place.name + '</div>' +
          (rating  ? '<div class="minicard-rating">'  + rating  + '</div>' : '') +
          (address ? '<div class="minicard-address">' + address + '</div>' : '') +
        '</div>' +
        '<button class="minicard-close" title="Cerrar">✕</button>' +
      '</div>';

    miniWrap.querySelector('.minicard-wrap').addEventListener('click', (e) => {
      if (e.target.classList.contains('minicard-close')) return;
      e.stopPropagation();
      this.haptic('select');
      if (this.onPlaceSelect) this.onPlaceSelect(place);
    });
    miniWrap.querySelector('.minicard-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeMiniCard();
    });

    // Añadir al body para que quede por encima de todo
    document.body.appendChild(miniWrap);

    // Centrar el mapa en el pin
    const lat = (place.location && place.location.lat) || place.lat;
    const lng = (place.location && place.location.lng) || place.lng;
    this.map.easeTo({ center: [lng, lat], duration: 300 });
  }

  _closeMiniCard() {
    const mini = document.getElementById('active-minicard');
    if (mini) mini.remove();
    this.miniCardMarker = null;
    this.miniCardIndex  = -1;
    this.miniCardPlace  = null;
  }

  // ── Actividades ───────────────────────────────────────────────────
  _activityCount(place) {
    const pName = ((place.name || '')).toLowerCase().trim();
    const pId   = ((place.place_id || place.placeId || '')).toLowerCase();
    return this.activities.filter(function(a) {
      const aName = ((a.place_name || '')).toLowerCase().trim();
      const aId   = ((a.place_id  || '')).toLowerCase();
      return (pId && aId === pId) || (pName && aName === pName);
    }).length;
  }

  _refreshActivityBadges() {
    this.markerEls.forEach((el, i) => {
      const place = this.allPlaces[i]; if (!place) return;
      const count = this._activityCount(place);
      let badge = el.querySelector('.place-act-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'place-act-badge';
          const rel = el.querySelector('.place-pin-rel, div');
          if (rel) rel.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.opacity = this.map.getZoom() >= 15 ? '1' : '0';
      } else if (badge) {
        badge.remove();
      }
    });
  }

  updateActivities(activities) { this.activities = activities; this._refreshActivityBadges(); }

  // ── Landmarks ─────────────────────────────────────────────────────
  _renderLandmarks(items) {
    if (items && items.length) this._allLandmarks = items;
    const cat = this.currentCatId;
    const filtered = (this._allLandmarks || []).filter(function(item) {
      if (!item.visible_in_categories || !item.visible_in_categories.length) return true;
      if (!cat) return true;
      return item.visible_in_categories.includes(cat);
    });
    items = filtered;
    this.landmarkMarkers.forEach(function(m) { m.remove(); });
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
        stickerWrap.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;width:' + totalSize + 'px;height:' + totalSize + 'px;user-select:none;';

        if (item.icon_url) {
          const imgEl = new Image();
          imgEl.crossOrigin = 'anonymous';
          imgEl.onload = function() {
            const dpr  = Math.min(window.devicePixelRatio || 1, 2);
            const pad2 = Math.ceil(strokeW * dpr * 2);
            const cs   = totalSize * dpr + pad2 * 2;
            const cvs  = document.createElement('canvas');
            cvs.width = cs; cvs.height = cs;
            const ctx  = cvs.getContext('2d');
            const cx = pad2, cy = pad2, sz = totalSize * dpr;
            const bsz = sz + strokeW * dpr * 2, bx = cx - strokeW * dpr, by = cy - strokeW * dpr;
            ctx.drawImage(imgEl, bx, by, bsz, bsz);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = strokeColor; ctx.fillRect(0, 0, cs, cs);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(imgEl, cx, cy, sz, sz);
            const out = document.createElement('img');
            out.src = cvs.toDataURL('image/png');
            out.style.cssText = 'width:' + (totalSize + strokeW * 2) + 'px;height:' + (totalSize + strokeW * 2) + 'px;display:block;';
            stickerWrap.appendChild(out);
          };
          imgEl.onerror = function() {
            const fb = document.createElement('div');
            fb.style.cssText = 'width:' + totalSize + 'px;height:' + totalSize + 'px;background:rgba(0,0,0,0.1);border-radius:8px;';
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
          ctx.font = (fontPx + offsets * 2) + 'px serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(item.emoji || '⭐', cx, cy);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = strokeColor; ctx.fillRect(0, 0, cs, cs);
          ctx.globalCompositeOperation = 'source-over';
          ctx.font = fontPx + 'px serif';
          ctx.fillText(item.emoji || '⭐', cx, cy);
          const img = document.createElement('img');
          img.src = cvs.toDataURL('image/png');
          img.style.cssText = 'width:' + totalSize + 'px;height:' + totalSize + 'px;display:block;';
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
            'opacity:1', 'transition:opacity 0.4s ease ' + seed + 'ms',
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
        label.style.cssText = "background:white;border-radius:12px;padding:4px 10px;font-size:11px;font-weight:800;color:#1a1a2e;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);max-width:130px;overflow:hidden;text-overflow:ellipsis;font-family:'Yahoo Sans Bold Regular',system-ui,sans-serif;";
        label.textContent = item.title || '';

        const borderStyle = borderColor
          ? 'box-shadow:0 0 0 3px ' + borderColor + ',0 4px 12px rgba(0,0,0,0.3);'
          : 'box-shadow:0 0 0 2px ' + color + '66,0 4px 12px rgba(0,0,0,0.3);';
        const pin = document.createElement('div');
        pin.style.cssText = 'width:' + pinSize + 'px;height:' + pinSize + 'px;border-radius:50%;background:linear-gradient(145deg,' + color + 'dd 0%,' + color + ' 50%,' + color + '99 100%);border:3px solid white;' + borderStyle + 'display:flex;align-items:center;justify-content:center;font-size:20px;';
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

  // ── Featured Highlight ─────────────────────────────────────────────
  _clearFeaturedHighlight() {
    document.querySelectorAll('.place-marker-el.featured-highlight').forEach(el => {
      el.classList.remove('featured-highlight');
      const wrapper = el.querySelector('.place-pin-wrapper');
      const nameEl  = el.querySelector('.pin-featured-name');
      const shadow  = el.querySelector('.pin-featured-shadow');
      const badge   = el.querySelector('.pin-featured-badge');
      if (wrapper) { wrapper.style.transform = ''; wrapper.style.boxShadow = ''; }
      if (nameEl)  nameEl.remove();
      if (shadow)  shadow.remove();
      if (badge) {
        badge.style.display = 'flex';
        const place = el._place;
        if (place && place.featured) {
          const bg   = place.featured === 'verified' ? '#059669' : place.featured === 'premium' ? '#7c3aed' : 'rgba(0,0,0,0.65)';
          const icon = place.featured === 'verified' ? '✓' : '⭐';
          badge.style.background = bg; badge.innerHTML = icon;
        }
      }
      const lbl = el.querySelector('.place-pin-label');
      if (lbl) lbl.style.opacity = '';
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
      if (!place || !place.featured) return;
      const marker = el._marker;
      if (!marker) return;
      const pt   = this.map.project(marker.getLngLat());
      const dist = Math.sqrt(Math.pow(pt.x - cx, 2) + Math.pow(pt.y - cy, 2));
      if (dist < ENTER && dist < closestDist) { closestDist = dist; closest = { el, place }; }
    });
    if (closest && closest.el === this._featuredHighlightEl) return;
    if (!closest && this._featuredHighlightEl) {
      const pm = this._featuredHighlightEl._marker;
      if (pm) {
        const pt = this.map.project(pm.getLngLat());
        if (Math.sqrt(Math.pow(pt.x - cx, 2) + Math.pow(pt.y - cy, 2)) < EXIT) return;
      }
    }
    this._clearFeaturedHighlight();
    if (!closest) return;
    this._featuredHighlightEl = closest.el;
    closest.el.classList.add('featured-highlight');
    const fb  = closest.el.querySelector('.pin-featured-badge');
    const lbl = closest.el.querySelector('.place-pin-label');
    if (fb)  fb.style.display  = 'none';
    if (lbl) lbl.style.opacity = '0';
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
      const badge  = closest.place.featured === 'verified' ? '✅ Verificado' : closest.place.featured === 'premium' ? '💎 Premium' : '⭐ Destacado';
      const nameEl = document.createElement('div');
      nameEl.className = 'pin-featured-name';
      nameEl.style.cssText = 'position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none;white-space:nowrap;animation:featuredNameIn 0.2s ease;';
      nameEl.innerHTML =
        '<div style="font-size:11px;font-weight:800;color:#1f2937;font-family:\'Yahoo Sans Bold Regular\',system-ui,sans-serif;text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;">' +
        closest.place.name + '</div>' +
        '<div style="font-size:9px;font-weight:700;background:' +
        (closest.place.featured === 'verified' ? 'linear-gradient(135deg,#10b981,#059669)' : closest.place.featured === 'premium' ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'linear-gradient(135deg,#f59e0b,#f97316)') +
        ';color:white;padding:2px 7px;border-radius:20px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">' + badge + '</div>';
      root.appendChild(nameEl);
    }
  }

  flyTo(lng, lat, zoom) { this.map.flyTo({ center: [lng, lat], zoom: zoom || 17, duration: 600 }); }
  getMap() { return this.map; }
}