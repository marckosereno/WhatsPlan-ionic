// ====================================================================
// WHATSPLAN — MapView.js
// ====================================================================

import { ActivityService } from '/src/services/SupabaseService.js';
import { LandmarkService, CustomPlaceService } from '/src/services/SuperUserService.js';

const CENTER_LNG = -97.9506;
const CENTER_LAT =  25.9950;
const ZOOM       = 16;
const MAP_STYLE  = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Paleta Blink Light — igual que la PWA original
const BL_BG       = '#ededea';
const BL_LAND     = '#ededea';
const BL_WATER    = '#00bcd4';
const BL_PARK     = '#b8d4b0';
const BL_BUILDING = '#e0e0db';
const BL_TEXT     = '#4a4a4a';
const BL_HALO     = 'rgba(237,237,234,0.95)';
const BENITO_LINE = '#7c6ef7';
const BENITO_TEXT = '#5a4fcf';

const CATEGORIES = {
  RESTAURANTS:   { icon: '🍔',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Hamburger/3D/hamburger_3d.png' },
  HEALTH:        { icon: '🩺',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Stethoscope/3D/stethoscope_3d.png' },
  SHOPPING:      { icon: '🛍️', icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20bags/3D/shopping_bags_3d.png' },
  ENTERTAINMENT: { icon: '🎈',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Balloon/3D/balloon_3d.png' },
  PARKS:         { icon: '🌵',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Cactus/3D/cactus_3d.png' },
  WORKSHOPS:     { icon: '🔧',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Wrench/3D/wrench_3d.png' },
};

function proxyPhoto(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

// ── Aplicar foto al pin-inner — igual que el original ──────────────
function applyPhotoToPin(photoUrl, el) {
  const pinInner = el.querySelector('.pin-inner');
  if (!pinInner || pinInner.classList.contains('loaded')) return;
  pinInner.style.opacity    = '0';
  pinInner.style.background = `url('${photoUrl}') center/cover no-repeat`;
  pinInner.innerHTML        = '';
  pinInner.classList.remove('loading');
  pinInner.classList.add('loaded');
  requestAnimationFrame(() => { pinInner.style.opacity = '1'; });
}

function applyErrorToPin(el) {
  const p = el.querySelector('.pin-inner');
  if (!p) return;
  p.classList.remove('loading');
  p.style.background   = 'transparent';
  p.style.borderRadius = '50%';
  p.style.border       = '3px solid white';
  p.style.boxShadow    = '0 2px 8px rgba(0,0,0,0.2)';
  const wrapper = el.querySelector('.place-pin-wrapper');
  if (wrapper) { wrapper.style.background = 'transparent'; wrapper.style.boxShadow = 'none'; }
}

// ====================================================================
export class MapView {
  constructor() {
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
    this._initMap();
  }

  _initMap() {
    this.map = new maplibregl.Map({
      container:            'map-container',
      style:                MAP_STYLE,
      center:               [CENTER_LNG, CENTER_LAT],
      zoom:                 ZOOM,
      attributionControl:   false,
      keyboard:             false,
      dragRotate:           false,
      pitchWithRotate:      false,
      maxTileCacheSize:     20,
      fadeDuration:         0,
      preserveDrawingBuffer: false,
    });

    this.map.on('load', () => {
      console.log('✅ Mapa listo');
      this._applyBlinkLight();
      this._loadLandmarks();
      this._loadActivities();

      // Badge visible solo en zoom ≥ 15
      let _zt = null;
      this.map.on('zoom', () => {
        if (_zt) return;
        _zt = setTimeout(() => {
          _zt = null;
          const show = this.map.getZoom() >= 15 ? '1' : '0';
          document.querySelectorAll('.place-act-badge').forEach(b => b.style.opacity = show);
        }, 80);
      });

      // Ghost-pan fix — igual que el original
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
      if (e.originalEvent.target.closest('.minicard-wrap')) return;
      this._closeMiniCard();
    });
  }

  // ── Estilo Blink Light — copiado exacto del original ─────────────
  _applyBlinkLight() {
    try {
      const style = this.map.getStyle();
      if (!style?.layers) return;
      style.layers.forEach(layer => {
        const id = layer.id.toLowerCase();
        if (layer.type === 'symbol') {
          try {
            const tt = this.map.getLayoutProperty(layer.id, 'text-transform');
            if (tt === 'uppercase') this.map.setLayoutProperty(layer.id, 'text-transform', 'none');
            const isPrimary = id.includes('road-primary') || id.includes('highway') || id.includes('motorway') || id.includes('trunk');
            const isTextLayer = id.includes('road') || id.includes('place') || id.includes('poi') || id.includes('label') || id.includes('name');
            if (isTextLayer) {
              try { this.map.setLayoutProperty(layer.id, 'text-font', ['Open Sans Italic','Montserrat Regular Italic','Noto Sans Regular','HanWangHeiLight Regular','NanumBarunGothic Regular']); } catch(_) {}
            }
            this.map.setPaintProperty(layer.id, 'text-color',      isPrimary ? BENITO_TEXT : BL_TEXT);
            this.map.setPaintProperty(layer.id, 'text-halo-color', BL_HALO);
            this.map.setPaintProperty(layer.id, 'text-halo-width', isPrimary ? 2.5 : 2);
            this.map.setPaintProperty(layer.id, 'text-halo-blur',  0.3);
          } catch(_) {}
        }
        if (layer.type === 'line') {
          try {
            const isMajor  = id.includes('primary') || id.includes('trunk') || id.includes('motorway');
            const isSecond = id.includes('secondary') || id.includes('tertiary');
            const isStreet = id.includes('street') || id.includes('road') || id.includes('residential') || id.includes('service') || id.includes('transportation');
            const isWater  = id.includes('water') || id.includes('river') || id.includes('canal');
            if (isWater)       { this.map.setPaintProperty(layer.id, 'line-color', BL_WATER);    this.map.setPaintProperty(layer.id, 'line-width', ['interpolate',['linear'],['zoom'],10,2,16,8]); }
            else if (isMajor)  { this.map.setPaintProperty(layer.id, 'line-color', BENITO_LINE); this.map.setPaintProperty(layer.id, 'line-width', ['interpolate',['linear'],['zoom'],10,1,12,2,14,4,16,7,18,10]); }
            else if (isSecond) { this.map.setPaintProperty(layer.id, 'line-color', '#c8c8d8');   this.map.setPaintProperty(layer.id, 'line-width', ['interpolate',['linear'],['zoom'],11,0.5,13,1.5,14,2.5,16,4,18,6]); }
            else if (isStreet) { this.map.setPaintProperty(layer.id, 'line-color', '#f7f7f5');   this.map.setPaintProperty(layer.id, 'line-width', ['interpolate',['linear'],['zoom'],12,0.3,13,0.8,14,1.5,16,2.5,18,4]); }
            try { this.map.setPaintProperty(layer.id, 'line-opacity', 1); } catch(_) {}
          } catch(_) {}
        }
        if (layer.type === 'fill') {
          try {
            if (id.includes('water') || id.includes('ocean') || id.includes('lake') || id.includes('river') || id.includes('reservoir')) { this.map.setPaintProperty(layer.id, 'fill-color', BL_WATER); this.map.setPaintProperty(layer.id, 'fill-opacity', 1); }
            else if (id.includes('park') || id.includes('grass') || id.includes('forest') || id.includes('wood') || id.includes('green') || id.includes('landcover')) { this.map.setPaintProperty(layer.id, 'fill-color', BL_PARK); this.map.setPaintProperty(layer.id, 'fill-opacity', 0.7); }
            else if (id.includes('building')) { this.map.setPaintProperty(layer.id, 'fill-color', BL_BUILDING); this.map.setPaintProperty(layer.id, 'fill-opacity', 0.5); }
            else if (id === 'background' || id.includes('landuse') || id.includes('land-') || id === 'land') { this.map.setPaintProperty(layer.id, 'fill-color', BL_LAND); }
          } catch(_) {}
        }
      });
      try { this.map.setPaintProperty('background', 'background-color', BL_BG); } catch(_) {}
      console.log('✅ Blink Light aplicado');
    } catch(e) { console.warn('⚠️ Estilo:', e.message); }
  }

  // ── Datos ─────────────────────────────────────────────────────────
  async _loadActivities() {
    try { this.activities = await ActivityService.getActiveActivities(); this._refreshActivityBadges(); }
    catch(e) { console.warn('⚠️ Actividades:', e.message); }
  }

  async _loadLandmarks() {
    try { this._renderLandmarks(await LandmarkService.getAll()); }
    catch(e) { console.warn('⚠️ Landmarks:', e.message); }
  }

  async loadCategory(menuKey) {
    this.currentCatId   = menuKey;
    this.currentCatData = CATEGORIES[menuKey] || CATEGORIES['RESTAURANTS'];
    this._clearPlaceMarkers();
    try {
      const res  = await fetch(`/api/airtable-places?category=${menuKey}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      let custom = [];
      try { custom = await CustomPlaceService.getByCategory(menuKey); } catch(_) {}
      this.allPlaces = [...(json.places || []), ...custom];
      this._renderPlaceMarkers(this.allPlaces);
    } catch(e) { console.error('❌ loadCategory:', e); }
  }

  // ── Markers ───────────────────────────────────────────────────────
  _clearPlaceMarkers() {
    this.markers.forEach(m => m?.remove());
    this.markers = []; this.markerEls = [];
    this._closeMiniCard();
  }

  _renderPlaceMarkers(places) {
    const cat     = this.currentCatData;
    const catIcon = cat?.icon3d
      ? `<img src="${cat.icon3d}" style="width:20px;height:20px;object-fit:contain;" onerror="this.style.display='none'">`
      : (cat?.icon || '💎');

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    places.forEach((place, index) => {
      const lat = place.location?.lat ?? place.lat;
      const lng = place.location?.lng ?? place.lng;
      if (!lat || !lng) return;

      const rawPhoto = place.photoUrl || place.photo_url || place.photosUrls?.[0] || null;
      const photoUrl = proxyPhoto(rawPhoto);

      const el = document.createElement('div');
      el.className = 'place-marker-el';
      el.innerHTML = this._buildPinHtml(place, photoUrl, catIcon);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.miniCardMarker === this.markers[index]) {
          if (this.onPlaceSelect) this.onPlaceSelect(place);
          return;
        }
        this._showMiniCard(place, index, photoUrl);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);

      // ── FOTO: IntersectionObserver — igual que el original ──────
      if (photoUrl) {
        el._photoUrl = photoUrl;
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

    // fitBounds igual que el original
    if (hasCoords) {
      this.map.fitBounds(bounds, {
        padding: { top: 70, bottom: 120, left: 50, right: 50 },
        maxZoom: 17
      });
    }

    this._refreshActivityBadges();
  }

  _buildPinHtml(place, photoUrl, catIcon) {
    const actCount   = this._activityCount(place);
    const hasAct     = actCount > 0;
    const borderGrad = hasAct ? 'linear-gradient(145deg,#fde68a 0%,#f59e0b 40%,#f97316 100%)' : '#ffffff';
    const badgeHtml  = hasAct ? `<div class="place-act-badge" style="opacity:${this.map?.getZoom()>=15?'1':'0'}">${actCount}</div>` : '';
    const pulseHtml  = hasAct ? `<div class="pin-pulse-ring" style="display:block"></div><div class="pin-pulse-ring" style="display:block;animation-delay:0.6s"></div>` : '';
    const featHtml   = place.featured ? `<div class="pin-featured-badge" style="background:${place.featured==='verified'?'#059669':place.featured==='premium'?'#7c3aed':'rgba(0,0,0,0.65)'}">${place.featured==='verified'?'✓':'⭐'}</div>` : '';
    if (photoUrl) {
      return `<div class="place-pin-root"><div class="place-pin-rel">${featHtml}${badgeHtml}${pulseHtml}<div class="place-pin-wrapper" style="background:${borderGrad}"><div class="pin-inner loading" data-photo="${photoUrl}">${catIcon}</div></div></div></div>`;
    }
    return `<div class="place-pin-root"><div style="position:relative;display:inline-block;overflow:visible;">${badgeHtml}${pulseHtml}<div class="pin-dot"></div></div></div>`;
  }

  // ── MiniCard ──────────────────────────────────────────────────────
  _showMiniCard(place, index, photoUrl) {
    this._closeMiniCard();
    this.miniCardPlace  = place;
    this.miniCardMarker = this.markers[index];
    this.miniCardIndex  = index;
    const el = this.miniCardMarker.getElement();
    el._savedHtml    = el.innerHTML;
    el.style.cssText = 'width:auto;height:auto;overflow:visible;z-index:9999;margin-top:-45px;';
    const rating   = place.rating ? `⭐ ${Number(place.rating).toFixed(1)}` : '';
    const address  = (place.formattedAddress || place.formatted_address || '').substring(0, 32);
    const hasAct   = this._activityCount(place) > 0;
    const cardGrad = hasAct ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : 'linear-gradient(135deg,#c4b5fd,#7dd3fc)';
    const cat      = this.currentCatData;
    el.innerHTML   = `<div class="minicard-wrap">${photoUrl?`<img src="${photoUrl}" class="minicard-photo" onerror="this.style.display='none'">` :`<div class="minicard-icon" style="background:${cardGrad}">${cat?.icon||'💎'}</div>`}<div class="minicard-body"><div class="minicard-name">${place.name}</div>${rating?`<div class="minicard-rating">${rating}</div>`:''} ${address?`<div class="minicard-address">${address}</div>`:''}</div><div class="minicard-arrow">›</div></div>`;
    el.querySelector('.minicard-wrap').addEventListener('click', (e) => { e.stopPropagation(); if (this.onPlaceSelect) this.onPlaceSelect(place); });
    const lat = place.location?.lat ?? place.lat;
    const lng = place.location?.lng ?? place.lng;
    this.map.easeTo({ center: [lng, lat], duration: 300 });
  }

  _closeMiniCard() {
    if (!this.miniCardMarker) return;
    const el = this.miniCardMarker.getElement();
    if (el && el._savedHtml !== undefined) { el.innerHTML = el._savedHtml; el.removeAttribute('style'); el._savedHtml = null; }
    this.miniCardMarker = null; this.miniCardIndex = -1; this.miniCardPlace = null;
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
    this.landmarkMarkers.forEach(m => m.remove()); this.landmarkMarkers = [];
    items.forEach(item => {
      const el = document.createElement('div'); el.className = 'landmark-el';
      if (item.type === 'sticker') {
        el.innerHTML = item.icon_url ? `<img src="${item.icon_url}" class="sticker-img" alt="${item.title||''}">` : `<div class="sticker-emoji">${item.emoji||'📍'}</div>`;
        if (item.title && item.show_label !== false) el.innerHTML += `<div class="landmark-label">${item.title}</div>`;
      } else {
        el.innerHTML = `<div class="landmark-circle" style="background:${item.color||'#00bcd4'}">${item.icon_url?`<img src="${item.icon_url}" style="width:18px;height:18px;object-fit:contain;">`:`<span>${item.emoji||'📍'}</span>`}</div>${item.title&&item.show_label!==false?`<div class="landmark-label">${item.title}</div>`:''}`;
      }
      this.landmarkMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([item.lng, item.lat]).addTo(this.map));
    });
  }

  flyTo(lng, lat, zoom = 17) { this.map.flyTo({ center: [lng, lat], zoom, duration: 600 }); }
  getMap() { return this.map; }
}
