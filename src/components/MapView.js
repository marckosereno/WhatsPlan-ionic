// ====================================================================
// MapView.js — WhatsPlan
// Mapa MapLibre + pins de lugares + minicard + landmarks
// ====================================================================

import { ActivityService } from '/src/services/SupabaseService.js';
import { LandmarkService, CustomPlaceService } from '/src/services/SuperUserService.js';

const CENTER = [-98.005, 26.064];
const ZOOM   = 15;
const TILES  = 'https://tiles.openfreemap.org/styles/liberty';

// Mapeo de menuKey de Airtable → id de categoría local
const CATEGORY_MAP = {
  RESTAURANTS:   'rest',
  HEALTH:        'health',
  SHOPPING:      'shop',
  ENTERTAINMENT: 'enter',
  PARKS:         'parks',
  WORKSHOPS:     'work',
};

// Categorías con sus icon3d (mismo orden que BottomPanel)
const CATEGORIES = [
  { id: 'rest',   menuKey: 'RESTAURANTS',   label: 'Restaurantes', icon: '🍔',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Hamburger/3D/hamburger_3d.png' },
  { id: 'health', menuKey: 'HEALTH',        label: 'Salud',        icon: '🩺',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Stethoscope/3D/stethoscope_3d.png' },
  { id: 'shop',   menuKey: 'SHOPPING',      label: 'Compras',      icon: '🛍️', icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Shopping%20bags/3D/shopping_bags_3d.png' },
  { id: 'enter',  menuKey: 'ENTERTAINMENT', label: 'Entrete.',     icon: '🎈',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Balloon/3D/balloon_3d.png' },
  { id: 'parks',  menuKey: 'PARKS',         label: 'Parques',      icon: '🌵',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Cactus/3D/cactus_3d.png' },
  { id: 'work',   menuKey: 'WORKSHOPS',     label: 'Talleres',     icon: '🔧',  icon3d: 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Wrench/3D/wrench_3d.png' },
];

// Proxy para fotos (evita CORS y protege Airtable key)
function proxyPhoto(url) {
  if (!url) return null;
  if (url.startsWith('/api/photo-proxy') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
}

// ====================================================================
// CLASE PRINCIPAL
// ====================================================================

export class MapView {
  constructor() {
    this.map           = null;
    this.markers       = [];       // markers de lugares
    this.markerEls     = [];       // elementos DOM de markers
    this.landmarkMarkers = [];     // markers de landmarks/stickers
    this.activities    = [];       // actividades activas cargadas
    this.allPlaces     = [];       // todos los lugares cargados
    this.currentCatId  = null;     // categoría activa

    // MiniCard
    this.miniCardMarker = null;
    this.miniCardIndex  = -1;
    this.miniCardPlace  = null;

    // Callbacks públicos (los asigna app.js)
    this.onPlaceSelect = null;     // (place) → abre PlaceSheet

    this._init();
  }

  // ────────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────────

  _init() {
    this.map = new maplibregl.Map({
      container: 'map',
      style: TILES,
      center: CENTER,
      zoom: ZOOM,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }), 'top-right');

    this.map.on('load', () => {
      console.log('✅ MapView lista');
      this._loadLandmarks();
      this._loadActivities();
    });

    // Tap fuera de minicard → cerrar
    this.map.on('click', (e) => {
      if (e.originalEvent.target.closest('.minicard-wrap')) return;
      this._closeMiniCard();
    });

    // Badge de actividades visible solo en zoom ≥ 15
    this.map.on('zoom', () => {
      const show = this.map.getZoom() >= 15 ? '1' : '0';
      document.querySelectorAll('.place-act-badge').forEach(b => b.style.opacity = show);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // DATOS
  // ────────────────────────────────────────────────────────────────

  async _loadActivities() {
    try {
      this.activities = await ActivityService.getActiveActivities();
      // Refrescar badges en markers ya existentes
      this._refreshActivityBadges();
    } catch (e) {
      console.warn('⚠️ Actividades no disponibles:', e.message);
    }
  }

  async _loadLandmarks() {
    try {
      const items = await LandmarkService.getAll();
      this._renderLandmarks(items);
    } catch (e) {
      console.warn('⚠️ Landmarks no disponibles:', e.message);
    }
  }

  // Cargar lugares de una categoría desde /api/airtable-places
  async loadCategory(catId) {
    this.currentCatId = catId;
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    this._clearPlaceMarkers();

    try {
      const res  = await fetch(`/api/airtable-places?category=${cat.menuKey}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error API');

      // Mezclar con custom places de Supabase para esta categoría
      let customPlaces = [];
      try {
        customPlaces = await CustomPlaceService.getByCategory(cat.menuKey);
      } catch (_) {}

      const places = [...(json.places || []), ...customPlaces];
      this.allPlaces = places;
      this._renderPlaceMarkers(places, cat);
    } catch (e) {
      console.error('❌ loadCategory:', e);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // MARKERS DE LUGARES
  // ────────────────────────────────────────────────────────────────

  _clearPlaceMarkers() {
    this.markers.forEach(m => m?.remove());
    this.markers  = [];
    this.markerEls = [];
    this._closeMiniCard();
  }

  _renderPlaceMarkers(places, cat) {
    const catIcon = cat.icon3d
      ? `<img src="${cat.icon3d}" style="width:22px;height:22px;object-fit:contain;" onerror="this.style.display='none'">`
      : cat.icon;

    places.forEach((place, index) => {
      const lat = place.location?.lat ?? place.lat;
      const lng = place.location?.lng ?? place.lng;
      if (!lat || !lng) return;

      const rawPhoto = place.photoUrl || place.photo_url || (place.photosUrls?.[0]) || null;
      const photoUrl = proxyPhoto(rawPhoto);

      const el = document.createElement('div');
      el.className = 'place-marker-el';
      el.innerHTML = this._buildPinHtml(place, photoUrl, catIcon);

      // Touch: prevenir que MapLibre inicie pan al tocar un pin
      el.addEventListener('touchstart', e => {
        if (e.target.closest('.place-marker-el')) e.stopPropagation();
      }, { passive: true });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.miniCardMarker === this.markers[index]) {
          // Tap en minicard activa → abrir detalle
          if (this.onPlaceSelect) this.onPlaceSelect(place);
          return;
        }
        this._showMiniCard(place, index, photoUrl, cat);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);

      // Lazy-load foto en el pin
      if (photoUrl) {
        const img = new Image();
        img.onload = () => {
          const pinInner = el.querySelector('.pin-inner');
          if (!pinInner || pinInner.classList.contains('loaded')) return;
          pinInner.style.background = `url('${photoUrl}') center/cover no-repeat`;
          pinInner.innerHTML = '';
          pinInner.classList.remove('loading');
          pinInner.classList.add('loaded');
        };
        img.onerror = () => {
          // Foto falló → convertir a pin punto
          const pinInner = el.querySelector('.pin-inner');
          if (pinInner) {
            pinInner.style.background = '#6366f1';
            pinInner.innerHTML = '';
            pinInner.style.borderRadius = '50%';
            pinInner.style.width = '14px';
            pinInner.style.height = '14px';
            pinInner.classList.remove('loading');
          }
        };
        img.src = photoUrl;
      }

      this.markerEls.push(el);
      this.markers.push(marker);
    });

    this._refreshActivityBadges();
  }

  // ────────────────────────────────────────────────────────────────
  // HTML DE PINS
  // ────────────────────────────────────────────────────────────────

  _buildPinHtml(place, photoUrl, catIcon) {
    const actCount   = this._activityCount(place);
    const hasAct     = actCount > 0;
    const borderGrad = hasAct
      ? 'linear-gradient(145deg,#fde68a 0%,#f59e0b 40%,#f97316 100%)'
      : '#ffffff';

    const pulseHtml = hasAct ? `
      <div class="pin-pulse-ring"></div>
      <div class="pin-pulse-ring" style="animation-delay:0.6s"></div>` : '';

    const badgeHtml = hasAct
      ? `<div class="place-act-badge" style="opacity:${this.map.getZoom()>=15?'1':'0'}">${actCount}</div>`
      : '';

    // Pin con foto
    if (photoUrl) {
      const featuredHtml = place.featured
        ? `<div class="pin-featured-badge" style="background:${place.featured==='verified'?'#059669':place.featured==='premium'?'#7c3aed':'rgba(0,0,0,0.65)'}">${place.featured==='verified'?'✓':'⭐'}</div>`
        : '';
      return `
        <div class="place-pin-root">
          <div class="place-pin-rel">
            ${featuredHtml}
            ${badgeHtml}
            ${pulseHtml}
            <div class="place-pin-wrapper" style="background:${borderGrad}">
              <div class="pin-inner loading" data-photo="${photoUrl}">${catIcon}</div>
            </div>
          </div>
        </div>`;
    }

    // Pin sin foto → punto azul
    return `
      <div class="place-pin-root">
        <div style="position:relative;display:inline-block;overflow:visible;">
          ${badgeHtml}
          ${pulseHtml}
          <div class="pin-inner pin-dot"></div>
        </div>
      </div>`;
  }

  // ────────────────────────────────────────────────────────────────
  // MINICARD
  // ────────────────────────────────────────────────────────────────

  _showMiniCard(place, index, photoUrl, cat) {
    // Restaurar marker anterior
    this._closeMiniCard();

    this.miniCardPlace  = place;
    this.miniCardMarker = this.markers[index];
    this.miniCardIndex  = index;

    const markerEl = this.miniCardMarker.getElement();
    markerEl._savedHtml = markerEl.innerHTML;

    const rating  = place.rating  ? `⭐ ${Number(place.rating).toFixed(1)}` : '';
    const address = (place.formattedAddress || place.formatted_address || '').substring(0, 32);
    const hasAct  = this._activityCount(place) > 0;
    const cardGrad = hasAct
      ? 'linear-gradient(135deg,#f59e0b,#ef4444)'
      : 'linear-gradient(135deg,#c4b5fd,#7dd3fc)';

    markerEl.style.cssText = 'width:auto;height:auto;overflow:visible;z-index:9999;margin-top:-45px;';
    markerEl.innerHTML = `
      <div class="minicard-wrap">
        ${photoUrl
          ? `<img src="${photoUrl}" class="minicard-photo">`
          : `<div class="minicard-icon" style="background:${cardGrad}">${cat?.icon || '💎'}</div>`}
        <div class="minicard-body">
          <div class="minicard-name">${place.name}</div>
          ${rating  ? `<div class="minicard-rating">${rating}</div>` : ''}
          ${address ? `<div class="minicard-address">${address}</div>` : ''}
        </div>
        <div class="minicard-arrow">›</div>
      </div>`;

    markerEl.querySelector('.minicard-wrap').addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onPlaceSelect) this.onPlaceSelect(place);
    });

    // Centrar en el lugar
    this.map.easeTo({ center: [place.location?.lng ?? place.lng, place.location?.lat ?? place.lat], duration: 300 });
  }

  _closeMiniCard() {
    if (!this.miniCardMarker) return;
    const el = this.miniCardMarker.getElement();
    if (el && el._savedHtml) {
      el.innerHTML = el._savedHtml;
      el.removeAttribute('style');
      el._savedHtml = null;
    }
    this.miniCardMarker = null;
    this.miniCardIndex  = -1;
    this.miniCardPlace  = null;
  }

  // ────────────────────────────────────────────────────────────────
  // ACTIVIDADES — BADGES
  // ────────────────────────────────────────────────────────────────

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
      const place = this.allPlaces[i];
      if (!place) return;
      const count  = this._activityCount(place);
      let badge = el.querySelector('.place-act-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'place-act-badge';
          el.querySelector('.place-pin-rel, div')?.appendChild(badge);
        }
        badge.textContent = count;
        badge.style.opacity = this.map.getZoom() >= 15 ? '1' : '0';
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // Llamado externamente cuando cambian actividades (suscripción Supabase)
  updateActivities(activities) {
    this.activities = activities;
    this._refreshActivityBadges();
  }

  // ────────────────────────────────────────────────────────────────
  // LANDMARKS / STICKERS
  // ────────────────────────────────────────────────────────────────

  _renderLandmarks(items) {
    this.landmarkMarkers.forEach(m => m.remove());
    this.landmarkMarkers = [];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'landmark-el';

      if (item.type === 'sticker') {
        // Sticker: emoji o imagen grande
        el.innerHTML = item.icon_url
          ? `<img src="${item.icon_url}" class="sticker-img" alt="${item.title||''}">`
          : `<div class="sticker-emoji">${item.emoji || '📍'}</div>`;
        if (item.title && item.show_label !== false) {
          el.innerHTML += `<div class="landmark-label">${item.title}</div>`;
        }
      } else {
        // Landmark: círculo de color con emoji
        el.innerHTML = `
          <div class="landmark-circle" style="background:${item.color||'#00bcd4'}">
            ${item.icon_url
              ? `<img src="${item.icon_url}" style="width:18px;height:18px;object-fit:contain;">`
              : `<span>${item.emoji || '📍'}</span>`}
          </div>
          ${item.title && item.show_label !== false ? `<div class="landmark-label">${item.title}</div>` : ''}`;
      }

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([item.lng, item.lat])
        .addTo(this.map);

      this.landmarkMarkers.push(marker);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // UTILIDADES PÚBLICAS
  // ────────────────────────────────────────────────────────────────

  flyTo(lng, lat, zoom = 17) {
    this.map.flyTo({ center: [lng, lat], zoom, duration: 600 });
  }

  getMap() { return this.map; }
}
