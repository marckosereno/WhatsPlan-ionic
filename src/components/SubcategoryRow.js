import { animateSubcatsIn, animateSubcatsOut } from '/src/utils/animations.js';
// ====================================================================
// WHATSPLAN — SubcategoryRow.js
// GPS chip (dentro del scroll) + chip LIVE (en el scroll) + subcategorías
// ====================================================================

const R = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

const SUBCATEGORIES_MAP = {
  RESTAURANTS: [
    { label: 'Comida Mexicana', value: 'mexican',  emoji: '🫔', icon3d: R+'Tamale/3D/tamale_3d.png' },
    { label: 'Tacos y Lonches', value: 'taco',     emoji: '🌮', icon3d: R+'Taco/3D/taco_3d.png' },
    { label: 'Mariscos',        value: 'seafood',  emoji: '🦐', icon3d: R+'Shrimp/3D/shrimp_3d.png' },
    { label: 'Bares',           value: 'bar',      emoji: '🍶', icon3d: R+'Sake/3D/sake_3d.png' },
    { label: 'Cafeterías',      value: 'cafe',     emoji: '🧋', icon3d: null },
    { label: 'Hamburguesas',    value: 'burger',   emoji: '🍔', icon3d: R+'Hamburger/3D/hamburger_3d.png' },
  ],
  HEALTH: [
    { label: 'Dentistas',    value: 'dental',   emoji: '🦷', icon3d: R+'Tooth/3D/tooth_3d.png' },
    { label: 'Farmacias',    value: 'farmacia', emoji: '💊', icon3d: R+'Pill/3D/pill_3d.png' },
    { label: 'Salones',      value: 'salon',    emoji: '💈', icon3d: null },
    { label: 'Médicos',      value: 'medico',   emoji: '🩺', icon3d: R+'Stethoscope/3D/stethoscope_3d.png' },
    { label: 'Ópticas',      value: 'optica',   emoji: '👓', icon3d: R+'Glasses/3D/glasses_3d.png' },
    { label: 'Spa & Masaje', value: 'spa',      emoji: '🧼', icon3d: R+'Soap/3D/soap_3d.png' },
  ],
  SHOPPING: [
    { label: 'Ropa y Moda',     value: 'ropa',     emoji: '🎒', icon3d: R+'Backpack/3D/backpack_3d.png' },
    { label: 'Artesanías',      value: 'souvenir', emoji: '🎈', icon3d: R+'Balloon/3D/balloon_3d.png' },
    { label: 'Joyería',         value: 'joyeria',  emoji: '💍', icon3d: R+'Ring/3D/ring_3d.png' },
    { label: 'Vinos y Licores', value: 'vinos',    emoji: '🍇', icon3d: R+'Grapes/3D/grapes_3d.png' },
    { label: 'Lentes',          value: 'lentes',   emoji: '👓', icon3d: R+'Glasses/3D/glasses_3d.png' },
  ],
  ENTERTAINMENT: [
    { label: 'Atracciones', value: 'atraccion', emoji: '🎟️', icon3d: R+'Ticket/3D/ticket_3d.png' },
    { label: 'Bares',       value: 'bar',       emoji: '🎤',  icon3d: R+'Microphone/3D/microphone_3d.png' },
    { label: 'Hoteles',     value: 'hotel',     emoji: '🏨',  icon3d: R+'Hotel/3D/hotel_3d.png' },
    { label: 'Eventos',     value: 'evento',    emoji: '🎈',  icon3d: R+'Balloon/3D/balloon_3d.png' },
  ],
  PARKS: [
    { label: 'Plazas',  value: 'plaza',  emoji: '🌵', icon3d: R+'Cactus/3D/cactus_3d.png' },
    { label: 'Parques', value: 'parque', emoji: '🌱', icon3d: R+'Seedling/3D/seedling_3d.png' },
  ],
  WORKSHOPS: [
    { label: 'Mecánicos', value: 'mecanico', emoji: '🔧', icon3d: R+'Wrench/3D/wrench_3d.png' },
    { label: 'Servicios', value: 'servicio', emoji: '🧰', icon3d: R+'Toolbox/3D/toolbox_3d.png' },
  ],
};

export class SubcategoryRow {
  constructor({ map, onSubcatSelect }) {
    this.map            = map;
    this.onSubcatSelect = onSubcatSelect;

    this._gpsActive       = false;
    this._gpsStarting     = false;  // bandera para el estado "arrancando"
    this._gpsWatchId      = null;
    this._lastGpsPos      = null;
    this._locationMarker  = null;

    this._liveActive        = false;
    this._liveBtn           = null;
    this._liveRecenterBtn   = null;
    this._liveHandler       = null;
    this._liveFrame         = null;
    this._liveRawHead       = 0;
    this._liveHead          = 0;
    this._liveCenterPaused  = false;

    this.currentMenuKey  = null;
    this.currentSubcat   = null;
    this._footerEl       = null;
    this._gpsEl          = null;

    this._injectStyles();
    this._build();

    this.map.on('dragstart', () => {
      if (this._liveActive) {
        this._liveCenterPaused = true;
        if (this._liveRecenterBtn) this._liveRecenterBtn.style.display = 'flex';
      }
    });
  }

  _build() {
    const footer = document.getElementById('map-subcategories-footer');
    if (!footer) return;

    // Remover skeleton placeholder si existe
    const sk = footer.querySelector('.hm-gps-skeleton');
    if (sk) sk.remove();

    const gps = document.createElement('button');
    gps.id = 'map-gps-btn';
    gps.className = 'hm-gps-btn';
    gps.title = 'Mi ubicación';
    gps.innerHTML = `<svg class="hm-gps-icon" viewBox="0 0 122.88 122.88" fill="currentColor">
      <path d="M120.3.14,1.24,40.38A1.82,1.82,0,0,0,.1,42.7a1.78,1.78,0,0,0,1.21,1.15h0L60.85,62,79,121.58h0a1.78,1.78,0,0,0,1.15,1.21,1.82,1.82,0,0,0,2.32-1.14L122.74,2.58A1.85,1.85,0,0,0,120.3.14Z"/>
    </svg>`;
    gps.addEventListener('click', () => this._toggleGps());

    footer.appendChild(gps);
    this._gpsEl    = gps;
    this._footerEl = footer;
  }

  _toggleGps() {
    // Si está activo O está arrancando, apagar
    if (this._gpsActive || this._gpsStarting) {
      this._stopGps();
    } else {
      this._startGps();
    }
  }

  async _startGps() {
    this._gpsStarting = true;
    this._gpsEl.classList.add('loading');

    const onPosition = (lat, lng) => {
      this._lastGpsPos = { lat, lng };
      this._upsertLocationMarker(lat, lng);
      if (!this._gpsActive) {
        this.map.flyTo({ center: [lng, lat], zoom: 17, duration: 600 });
        this._gpsActive   = true;
        this._gpsStarting = false;
        this._gpsEl.classList.remove('loading');
        this._gpsEl.classList.add('active');
        this._insertLiveChip();
      }
    };

    const onError = (err) => {
      console.warn('⚠️ GPS:', err.message || err);
      this._gpsStarting = false;
      this._gpsEl.classList.remove('loading');
    };

    // Usar Capacitor Geolocation si está disponible (APK), sino browser
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      // Pedir permiso primero
      await Geolocation.requestPermissions();
      this._gpsWatchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 },
        (pos, err) => {
          if (err) { onError(err); return; }
          onPosition(pos.coords.latitude, pos.coords.longitude);
        }
      );
    } catch (e) {
      // Fallback a browser geolocation
      if (!navigator.geolocation) { onError({ message: 'GPS no disponible' }); return; }
      this._gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => onPosition(pos.coords.latitude, pos.coords.longitude),
        onError,
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
      );
      this._gpsUsingBrowser = true;
    }
  }

  async _stopGps() {
    if (this._gpsWatchId != null) {
      if (this._gpsUsingBrowser) {
        navigator.geolocation.clearWatch(this._gpsWatchId);
        this._gpsUsingBrowser = false;
      } else {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          await Geolocation.clearWatch({ id: this._gpsWatchId });
        } catch(e) {}
      }
      this._gpsWatchId = null;
    }
    if (this._locationMarker) {
      this._locationMarker.remove();
      this._locationMarker = null;
    }
    this._gpsActive   = false;
    this._gpsStarting = false;
    this._lastGpsPos  = null;
    this._gpsEl.classList.remove('active', 'loading');
    if (this._liveActive) this._stopLive();
    this._removeLiveChip();
  }

  _upsertLocationMarker(lat, lng) {
    if (!this._locationMarker) {
      const el = document.createElement('div');
      el.className = 'hm-loc-avatar-wrap';
      const avatarUrl = (window.wpApp && window.wpApp._cachedAvatarUrl) ||
                        (window.wpApp && window.wpApp.currentUser &&
                         window.wpApp.currentUser.user_metadata &&
                         window.wpApp.currentUser.user_metadata.avatar_url) || '';
      el.innerHTML = avatarUrl
        ? '<img class="hm-loc-avatar-img" src="' + avatarUrl + '">'
        : '<div class="hm-loc-avatar-fallback">📍</div>';
      this._locationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this._locationMarker.setLngLat([lng, lat]);
    }
  }

  // ── Chip LIVE dentro del scroll (después del GPS) ─────────────────
  _insertLiveChip() {
    if (this._liveBtn) return;

    const chip = document.createElement('button');
    chip.id = 'hm-live-chip';
    chip.className = 'hm-live-chip';
    chip.innerHTML = '<span class="hm-live-dot"></span>LIVE';
    chip.addEventListener('click', () => this._toggleLive());

    // Insertar justo después del botón GPS (segundo elemento del scroll)
    const gpsEl = this._footerEl.querySelector('#map-gps-btn');
    if (gpsEl && gpsEl.nextSibling) {
      this._footerEl.insertBefore(chip, gpsEl.nextSibling);
    } else {
      this._footerEl.appendChild(chip);
    }

    this._liveBtn = chip;
  }

  _removeLiveChip() {
    if (this._liveBtn) {
      this._liveBtn.remove();
      this._liveBtn = null;
    }
    if (this._liveRecenterBtn) {
      this._liveRecenterBtn.remove();
      this._liveRecenterBtn = null;
    }
  }

  _toggleLive() {
    if (this._liveActive) this._stopLive();
    else this._startLive();
  }

  _startLive() {
    this._liveActive = true;
    if (this._liveBtn) this._liveBtn.classList.add('active');
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    const handler = (e) => {
      if (e.webkitCompassHeading != null) this._liveRawHead = e.webkitCompassHeading;
      else if (e.alpha != null) this._liveRawHead = 360 - e.alpha;
    };
    window.addEventListener('deviceorientation', handler, true);
    this._liveHandler = handler;
    const loop = () => {
      if (!this._liveActive) return;
      let diff = this._liveRawHead - this._liveHead;
      if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
      this._liveHead += diff * 0.1;
      this.map.setBearing(this._liveHead);
      if (!this._liveCenterPaused && this._lastGpsPos) {
        this.map.setCenter([this._lastGpsPos.lng, this._lastGpsPos.lat]);
      }
      this._liveFrame = requestAnimationFrame(loop);
    };
    this._liveFrame = requestAnimationFrame(loop);
  }

  _stopLive() {
    this._liveActive = false;
    if (this._liveBtn) this._liveBtn.classList.remove('active');
    if (this._liveHandler) window.removeEventListener('deviceorientation', this._liveHandler, true);
    if (this._liveFrame) cancelAnimationFrame(this._liveFrame);
    this.map.dragRotate.enable();
    this.map.touchZoomRotate.enableRotation();
  }

  showLoading(menuKey) {
    this.currentMenuKey = menuKey;
    this._clearSubcatChips();
    const loading = document.createElement('div');
    loading.className = 'hm-loading-chip';
    loading.innerHTML = '<div class="hm-loading-chip__spin"></div>Cargando...';
    this._footerEl.appendChild(loading);
    this._footerEl.classList.add('visible');
  }

  showSubcats(menuKey) {
    this.currentMenuKey = menuKey;
    const items = SUBCATEGORIES_MAP[menuKey] || [];
    if (!items.length) { this.hide(); return; }

    this._clearSubcatChips();

    const allActive = !this.currentSubcat || this.currentSubcat === 'all';

    const todosBtn = document.createElement('button');
    todosBtn.className = 'subcategory-footer-chip' + (allActive ? ' active' : '');
    todosBtn.dataset.val = 'all';
    todosBtn.textContent = 'Todos';
    this._footerEl.appendChild(todosBtn);

    items.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'subcategory-footer-chip' + (this.currentSubcat === s.value ? ' active' : '');
      btn.dataset.val = s.value;
      btn.style.animationDelay = ((i + 1) * 50) + 'ms';
      const icon = s.icon3d
        ? '<img src="' + s.icon3d + '" style="width:14px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px" onerror="this.style.display=\'none\'">'
        : '<span style="margin-right:3px">' + s.emoji + '</span>';
      btn.innerHTML = icon + s.label;
      this._footerEl.appendChild(btn);
    });

    this._footerEl.classList.add('visible');
    animateSubcatsIn(Array.from(this._footerEl.querySelectorAll('.subcategory-footer-chip')));

    this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentSubcat = chip.dataset.val;
        if (this.onSubcatSelect) this.onSubcatSelect(chip.dataset.val);
      });
    });
  }

  _clearSubcatChips() {
    this._footerEl.querySelectorAll('.subcategory-footer-chip, .hm-loading-chip').forEach(el => el.remove());
  }

  hide() {
    const self = this;
    animateSubcatsOut(this._footerEl, function() {
      self._clearSubcatChips();
      self._footerEl.classList.remove('visible');
    });
    this.currentSubcat = null;
  }

  _injectStyles() {
    if (document.getElementById('subcats-row-styles')) return;
    const s = document.createElement('style');
    s.id = 'subcats-row-styles';
    s.textContent = `
      /* GPS como chip circular dentro del scroll */
      .hm-gps-btn {
        width: 31px; height: 31px; border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.08); background: #f5f5f5;
        display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0; transition: all 0.2s;
      }
      .hm-gps-icon { width: 11px; height: 11px; color: #6b7280; }
      .hm-gps-btn.active { background: #e8f5e9; border-color: rgba(22,163,74,0.2); }
      .hm-gps-btn.active .hm-gps-icon { color: #16a34a; }
      .hm-gps-btn.loading { animation: gpsPulse 1s infinite; }
      @keyframes gpsPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

      /* Marcador de ubicación en el mapa */
      .hm-loc-avatar-wrap { width:36px; height:36px; border-radius:50%; border:2.5px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.25); overflow:hidden; background:#2563eb; }
      .hm-loc-avatar-img { width:100%; height:100%; object-fit:cover; }
      .hm-loc-avatar-fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:20px; background:#2563eb; }

      /* ── Chip LIVE dentro del scroll (mismo tamaño que subcategory chips) ── */
      .hm-live-chip {
        display: inline-flex; align-items: center; gap: 5px;
        height: 30px; padding: 0 11px;
        background: #f5f5f5;
        border: 1px solid rgba(239,68,68,0.25);
        border-radius: 999px;
        font-size: 12px; font-weight: 600;
        color: #dc2626; white-space: nowrap; cursor: pointer;
        transition: all 0.18s; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
      }
      .hm-live-chip.active {
        background: #dc2626;
        border-color: #dc2626;
        color: white;
        box-shadow: 0 2px 8px rgba(220,38,38,0.3);
      }
      .hm-live-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: currentColor;
        animation: livePulse 1.2s infinite;
        flex-shrink: 0;
      }
      @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

      /* Chips de subcategoría — estilo nativo */
      .subcategory-footer-chip {
        display: inline-flex; align-items: center;
        height: 30px; padding: 0 11px;
        background: #f5f5f5;
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 999px;
        font-size: 12px; font-weight: 500;
        color: #374151; white-space: nowrap; cursor: pointer;
        transition: all 0.18s; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
      }
      .subcategory-footer-chip:active { background: #ebebeb; }
      .subcategory-footer-chip.active {
        background: #2563eb;
        border-color: transparent;
        color: white;
        font-weight: 600;
      }

      /* Chip de carga */
      .hm-loading-chip {
        display: inline-flex; align-items: center; gap: 7px;
        background: #f5f5f5; border-radius: 999px; padding: 0 12px;
        height: 30px; font-size: 12px; font-weight: 500; color: #5b5fc7; flex-shrink: 0;
      }
      .hm-loading-chip__spin {
        width: 12px; height: 12px;
        border: 2px solid rgba(37,99,235,0.2); border-top-color: #2563eb;
        border-radius: 50%; animation: spin 0.75s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }
}