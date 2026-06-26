import { animateSubcatsIn, animateSubcatsOut } from '/src/utils/animations.js';
// ====================================================================
// WHATSPLAN — SubcategoryRow.js
// GPS chip (dentro del scroll) + chip LIVE (en el scroll) + subcategorías
// ====================================================================

const R = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

// SUBCATEGORIES_MAP ya NO es estático — se carga dinámicamente desde Supabase
// vía CategoryService.getSubcategoriesMap() (ver constructor/_loadSubcatsMap).
// Esto permite editar/agregar subcategorías desde SuperUserPanel sin tocar código.

export class SubcategoryRow {
  constructor({ map, onSubcatSelect }) {
    this.map            = map;
    this.onSubcatSelect = onSubcatSelect;

    // Caché local de subcategorías — se llena desde Supabase (CategoryService)
    this._subcatsMap   = {};
    this._subcatsReady = this._loadSubcatsMap();

    this._gpsActive       = false;
    this._gpsStarting     = false;
    this._gpsWatchId      = null;
    this._lastGpsPos      = null;
    this._locationMarker  = null;
    this._gpsUsingBrowser = false;

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

    // El botón de GPS ya no vive en este scroll — ahora es el slot inferior
    // del panel lateral (#wp-side-slot-3). Solo limpiamos el skeleton viejo.
    const sk = footer.querySelector('.hm-gps-skeleton');
    if (sk) sk.remove();
    this._footerEl = footer;

    const gpsEl = document.getElementById('wp-side-slot-3');
    if (gpsEl) {
      gpsEl.title = 'Mi ubicación';
      gpsEl.addEventListener('click', () => this._toggleGps());
      this._gpsEl = gpsEl;
    }
  }

  _toggleGps() {
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

    const onError = async (err) => {
      const msg = err.message || err || '';
      console.warn('⚠️ GPS error:', msg);
      this._gpsStarting = false;
      this._gpsEl.classList.remove('loading');

      // Si ubicación del sistema está apagada, abrir ajustes
      const isLocationOff = typeof msg === 'string' && (
        msg.includes('not enabled') ||
        msg.includes('disabled') ||
        msg.includes('unavailable')
      );
      if (isLocationOff) {
        const isCapacitor = window.Capacitor &&
                            window.Capacitor.isNativePlatform &&
                            window.Capacitor.isNativePlatform();
        if (isCapacitor && window.Capacitor.Plugins.NativeSettings) {
          // Abrir ajustes de ubicación directamente
          try {
            await window.Capacitor.Plugins.NativeSettings.openAndroid({
              option: 'location'
            });
          } catch(e) {}
        } else if (isCapacitor && window.Capacitor.Plugins.Diagnostic) {
          try {
            await window.Capacitor.Plugins.Diagnostic.switchToLocationSettings();
          } catch(e) {}
        } else {
          // Fallback: mostrar alerta nativa
          alert('Activa la ubicación en Ajustes del teléfono para usar el GPS.');
        }
      }
    };

    // Detectar si estamos en Capacitor nativo
    const isCapacitor = window.Capacitor &&
                        window.Capacitor.isNativePlatform &&
                        window.Capacitor.isNativePlatform();

    if (isCapacitor) {
      try {
        const Geolocation = window.Capacitor.Plugins.Geolocation;

        // Pedir permisos primero
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          onError('Permiso denegado'); return;
        }

        // Verificar que GPS esté activo con getCurrentPosition de alta precisión
        try {
          const cur = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true, timeout: 8000
          });
          // Usar esta posición real para el flyTo inicial
          onPosition(cur.coords.latitude, cur.coords.longitude);
        } catch(e) {
          await onError(e);
          return;
        }

        // watchPosition para actualizaciones continuas
        this._gpsWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
          (pos, err) => {
            if (err) { onError(err); return; }
            if (pos) onPosition(pos.coords.latitude, pos.coords.longitude);
          }
        );
      } catch (e) {
        onError(e.message || e);
      }
    } else {
      // Fallback browser (web)
      if (!navigator.geolocation) { onError('GPS no disponible'); return; }
      this._gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => onPosition(pos.coords.latitude, pos.coords.longitude),
        onError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
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
          const Geolocation = window.Capacitor.Plugins.Geolocation;
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

  // ── Chip LIVE — debajo del avatar (mismo diseño que antes, otra ubicación) ──
  _insertLiveChip() {
    if (this._liveBtn) return;

    const chip = document.createElement('button');
    chip.id = 'hm-live-chip';
    chip.className = 'hm-live-chip hm-live-chip-under-avatar';
    chip.innerHTML = '<span class="hm-live-dot"></span>LIVE';
    chip.addEventListener('click', () => this._toggleLive());

    document.body.appendChild(chip);
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
    document.getElementById('topbar-auth-btn')?.classList.add('avatar-live-active');
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
    document.getElementById('topbar-auth-btn')?.classList.remove('avatar-live-active');
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

  // ── Carga dinámica de subcategorías desde Supabase (CategoryService) ──
  async _loadSubcatsMap() {
    try {
      const mod = await import('/src/services/CategoryService.js');
      this._subcatsMap = await mod.getSubcategoriesMap();
    } catch (e) {
      console.warn('⚠️ SubcategoryRow: no se pudieron cargar subcategorías —', e.message);
      this._subcatsMap = {};
    }
  }

  // Llamar después de crear/editar/eliminar subcategorías en SuperUserPanel
  async refreshSubcats() {
    this._subcatsReady = this._loadSubcatsMap();
    await this._subcatsReady;
    // Si hay una fila visible en este momento, re-renderizarla con datos frescos
    if (this.currentMenuKey && this._footerEl.classList.contains('visible')) {
      this.showSubcats(this.currentMenuKey);
    }
  }

  async showSubcats(menuKey) {
    await this._subcatsReady; // espera la carga inicial si aún no resolvió
    this.currentMenuKey = menuKey;
    const items = this._subcatsMap[menuKey] || [];
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
      /* GPS — ahora vive en #wp-side-slot-3 (panel lateral), no aquí.
         Activo: borde verde en el slot + ícono pulsando en verde. */
      #wp-side-slot-3.active {
        box-sizing: border-box;
        border: 2px solid #16a34a;
        color: #16a34a;
      }
      #wp-side-slot-3.active svg,
      #wp-side-slot-3.loading svg { animation: gpsPulse 1.2s infinite; }
      #wp-side-slot-3.active svg { color: #16a34a; }
      @keyframes gpsPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

      /* Marcador de ubicación en el mapa */
      .hm-loc-avatar-wrap { width:36px; height:36px; border-radius:50%; border:2.5px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.25); overflow:hidden; background:#1a5cf5; }
      .hm-loc-avatar-img { width:100%; height:100%; object-fit:cover; }
      .hm-loc-avatar-fallback { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:20px; background:#1a5cf5; }

      /* ── Chip LIVE — fijo debajo del avatar (mismo diseño de siempre) ── */
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
      .hm-live-chip-under-avatar {
        position: fixed;
        left: 12px;
        top: calc(12px + env(safe-area-inset-top, 0px) + 44px + 8px);
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
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

      /* Avatar — borde rojo pulsante (anillo expansivo) mientras LIVE está activo,
         reemplaza el borde blanco normal de #topbar-auth-btn */
      #topbar-auth-btn.avatar-live-active {
        border-color: #dc2626 !important;
        animation: wpAvatarLivePulse 1.8s ease-in-out infinite;
      }
      @keyframes wpAvatarLivePulse {
        0%, 100% { box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 0 rgba(220,38,38,0.55); }
        50%      { box-shadow: 0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 7px rgba(220,38,38,0); }
      }

      /* Chips de subcategoría — estilo nativo */
      .subcategory-footer-chip {
        display: inline-flex; align-items: center;
        height: 32px; padding: 0 14px;
        background: linear-gradient(170deg,
          rgba(255,255,255,0.95) 0%,
          rgba(240,244,255,0.88) 100%);
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 999px;
        font-size: 12.5px; font-weight: 600;
        color: #374151; white-space: nowrap; cursor: pointer;
        transition: all 0.18s cubic-bezier(0.34,1.2,0.64,1); flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
        box-shadow:
          0 3px 10px rgba(0,0,0,0.08),
          0 1px 3px rgba(0,0,0,0.05),
          inset 0 1.5px 0 rgba(255,255,255,1),
          inset 0 -1px 0 rgba(0,0,0,0.04);
        backdrop-filter: blur(12px) saturate(1.6);
        -webkit-backdrop-filter: blur(12px) saturate(1.6);
      }
      .subcategory-footer-chip:active {
        transform: scale(0.94);
        box-shadow: 0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8);
      }
      .subcategory-footer-chip.active {
        background: linear-gradient(150deg, #4a74f5 0%, #1a5cf5 60%, #1540cc 100%);
        border-color: rgba(74,116,245,0.3);
        color: white; font-weight: 700;
        box-shadow:
          0 2px 8px rgba(26,92,245,0.25),
          inset 0 1.5px 0 rgba(255,255,255,0.26),
          inset 0 -1px 0 rgba(0,0,0,0.12);
        text-shadow: 0 1px 2px rgba(0,0,0,0.10);
      }

      /* Chip de carga */
      .hm-loading-chip {
        display: inline-flex; align-items: center; gap: 7px;
        background: #f5f5f5; border-radius: 999px; padding: 0 12px;
        height: 30px; font-size: 12px; font-weight: 500; color: #5b5fc7; flex-shrink: 0;
      }
      .hm-loading-chip__spin {
        width: 12px; height: 12px;
        border: 2px solid rgba(26,92,245,0.2); border-top-color: #1a5cf5;
        border-radius: 50%; animation: spin 0.75s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }
}
