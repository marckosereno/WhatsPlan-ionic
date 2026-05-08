// ====================================================================
// WHATSPLAN — SubcategoryRow.js
// GPS chip + avatar en mapa + modo LIVE + subcategorías
// Copiado exacto de MapViewGL.js original
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
    this.map            = map;           // instancia maplibregl.Map
    this.onSubcatSelect = onSubcatSelect;// (value) → void

    // GPS state
    this._gpsActive       = false;
    this._gpsWatchId      = null;
    this._lastGpsPos      = null;
    this._locationMarker  = null;

    // Live state
    this._liveActive        = false;
    this._liveBtn           = null;
    this._liveRecenterBtn   = null;
    this._liveHandler       = null;
    this._liveFrame         = null;
    this._liveRawHead       = 0;
    this._liveHead          = 0;
    this._liveCenterPaused  = false;

    // UI state
    this.currentMenuKey  = null;
    this.currentSubcat   = null;
    this._rowEl          = null;
    this._footerEl       = null;
    this._gpsEl          = null;
    this._hideTimer      = null;

    this._injectStyles();
    this._build();

    // Pausar live al mover mapa manualmente
    this.map.on('dragstart', () => {
      if (this._liveActive) {
        this._liveCenterPaused = true;
        if (this._liveRecenterBtn) this._liveRecenterBtn.style.display = 'flex';
      }
    });
  }

  // ── Construir row ────────────────────────────────────────────────
  _build() {
    const row = document.createElement('div');
    row.id = 'map-subcats-row';
    row.className = 'map-subcats-row';

    // GPS btn
    const gps = document.createElement('button');
    gps.id = 'map-gps-btn';
    gps.className = 'hm-gps-btn';
    gps.title = 'Mi ubicación';
    gps.innerHTML = `<svg class="hm-gps-icon" viewBox="0 0 122.88 122.88" fill="currentColor">
      <path d="M120.3.14,1.24,40.38A1.82,1.82,0,0,0,.1,42.7a1.78,1.78,0,0,0,1.21,1.15h0L60.85,62,79,121.58h0a1.78,1.78,0,0,0,1.15,1.21,1.82,1.82,0,0,0,2.32-1.14L122.74,2.58A1.85,1.85,0,0,0,120.3.14Z"/>
    </svg>`;
    gps.addEventListener('click', () => this._toggleGps());

    // Footer subcategorías
    const footer = document.createElement('div');
    footer.id = 'map-subcategories-footer';
    footer.className = 'map-subcategories-footer';

    row.appendChild(gps);
    row.appendChild(footer);
    document.body.appendChild(row);

    this._rowEl    = row;
    this._gpsEl    = gps;
    this._footerEl = footer;
  }

  // ════════════════════════════════════════════════════════════════
  // GPS
  // ════════════════════════════════════════════════════════════════

  _toggleGps() {
    if (this._gpsActive) this._stopGps();
    else this._startGps();
  }

  _startGps() {
    if (!navigator.geolocation) return;
    this._gpsEl.classList.add('loading');

    this._gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        this._lastGpsPos = { lat, lng };
        try { sessionStorage.setItem('wp_userpos', JSON.stringify({ lat, lng })); } catch(e) {}

        this._upsertLocationMarker(lat, lng);

        if (!this._gpsActive) {
          this.map.flyTo({ center: [lng, lat], zoom: 17, duration: 600 });
          this._gpsActive = true;
          this._gpsEl.classList.remove('loading');
          this._gpsEl.classList.add('active');
          this._createLiveBtn();
        }
      },
      (err) => {
        console.warn('⚠️ GPS:', err.message);
        this._gpsEl.classList.remove('loading');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }

  _stopGps() {
    if (this._gpsWatchId != null) {
      navigator.geolocation.clearWatch(this._gpsWatchId);
      this._gpsWatchId = null;
    }
    if (this._locationMarker) { this._locationMarker.remove(); this._locationMarker = null; }
    this._gpsActive  = false;
    this._lastGpsPos = null;
    this._gpsEl.classList.remove('active', 'loading');
    if (this._liveActive) this._stopLive();
    if (this._liveBtn)        { this._liveBtn.remove();        this._liveBtn = null; }
    if (this._liveRecenterBtn){ this._liveRecenterBtn.remove(); this._liveRecenterBtn = null; }
  }

  // ── Avatar en el mapa — copiado exacto del original ─────────────
  _buildLocationDot() {
    const wrap = document.createElement('div');
    wrap.className = 'hm-loc-avatar-wrap';

    // Obtener foto del usuario logueado
    const avatarUrl = window.wpApp?._cachedAvatarUrl
      || window.wpApp?.currentUser?.user_metadata?.avatar_url
      || '';

    if (avatarUrl) {
      wrap.innerHTML = `
        <img class="hm-loc-avatar-img" src="${avatarUrl}" alt="Tú"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="hm-loc-avatar-fallback" style="display:none">📍</div>`;
    } else {
      wrap.innerHTML = `<div class="hm-loc-avatar-fallback">📍</div>`;
    }
    return wrap;
  }

  _upsertLocationMarker(lat, lng) {
    if (!this._locationMarker) {
      const el = this._buildLocationDot();
      this._locationMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this._locationMarker.setLngLat([lng, lat]);
    }
  }

  // ════════════════════════════════════════════════════════════════
  // LIVE
  // ════════════════════════════════════════════════════════════════

  _createLiveBtn() {
    if (this._liveBtn) return;

    const btn = document.createElement('button');
    btn.id = 'hm-live-btn';
    btn.innerHTML = '<span class="hm-live-dot"></span>LIVE';
    btn.title = 'Modo live';
    btn.addEventListener('click',    () => this._toggleLive());
    btn.addEventListener('touchend', (e) => { e.preventDefault(); this._toggleLive(); });

    // Insertar justo después del GPS btn
    if (this._gpsEl?.parentNode) {
      this._gpsEl.parentNode.insertBefore(btn, this._gpsEl.nextSibling);
    }
    this._liveBtn = btn;

    // Botón re-centrar — aparece cuando live está pausado por arrastre
    const reBtn = document.createElement('button');
    reBtn.id = 'hm-live-recenter';
    reBtn.innerHTML = '⊕';
    reBtn.title = 'Volver a mi posición';
    reBtn.style.cssText = 'display:none;height:28px;width:28px;border-radius:50%;border:1.5px solid rgba(99,102,241,0.5);background:white;color:#6366f1;font-size:16px;cursor:pointer;flex-shrink:0;align-items:center;justify-content:center;pointer-events:all;outline:none;-webkit-tap-highlight-color:transparent;box-shadow:0 1px 4px rgba(99,102,241,0.2);';
    reBtn.addEventListener('click',    () => this._liveRecenter());
    reBtn.addEventListener('touchend', (e) => { e.preventDefault(); this._liveRecenter(); });
    if (this._gpsEl?.parentNode) {
      this._gpsEl.parentNode.insertBefore(reBtn, btn.nextSibling);
    }
    this._liveRecenterBtn = reBtn;
  }

  _toggleLive() {
    if (this._liveActive) this._stopLive();
    else this._startLive();
  }

  _startLive() {
    this._liveActive       = true;
    this._liveRawHead      = 0;
    this._liveHead         = 0;
    this._liveCenterPaused = false;

    if (this._liveBtn) this._liveBtn.classList.add('active');

    // Zoom a 17 si es menor
    if (this.map.getZoom() < 16 && this._lastGpsPos) {
      this.map.flyTo({ center: [this._lastGpsPos.lng, this._lastGpsPos.lat], zoom: 17, duration: 600 });
    }

    // Bloquear rotación manual
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();

    const handler = (e) => {
      if (e.webkitCompassHeading != null) this._liveRawHead = e.webkitCompassHeading;
      else if (e.alpha != null)           this._liveRawHead = (360 - e.alpha) % 360;
    };
    this._liveHandler = handler;

    const start = () => {
      if ('ondeviceorientationabsolute' in window)
        window.addEventListener('deviceorientationabsolute', handler, true);
      else
        window.addEventListener('deviceorientation', handler, true);
      this._liveLoop();
    };

    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(p => { if (p === 'granted') start(); })
        .catch(start);
    } else {
      start();
    }
  }

  _liveLoop() {
    if (!this._liveActive) return;

    // Interpolación suave del heading
    let diff = this._liveRawHead - this._liveHead;
    while (diff >  180) diff -= 360;
    while (diff < -180) diff += 360;
    this._liveHead += diff * 0.08;
    this.map.setBearing(this._liveHead);

    // Centrar en posición del usuario (salvo que haya arrastrado el mapa)
    if (!this._liveCenterPaused && this._lastGpsPos) {
      this.map.setCenter([this._lastGpsPos.lng, this._lastGpsPos.lat]);
    }

    this._liveFrame = requestAnimationFrame(() => this._liveLoop());
  }

  _stopLive() {
    this._liveActive = false;
    if (this._liveBtn)        this._liveBtn.classList.remove('active');
    if (this._liveRecenterBtn) this._liveRecenterBtn.style.display = 'none';

    // Restaurar rotación manual
    this.map.dragRotate.enable();
    this.map.touchZoomRotate.enableRotation();

    if (this._liveFrame) { cancelAnimationFrame(this._liveFrame); this._liveFrame = null; }
    if (this._liveHandler) {
      window.removeEventListener('deviceorientationabsolute', this._liveHandler, true);
      window.removeEventListener('deviceorientation',         this._liveHandler, true);
      this._liveHandler = null;
    }
    this.map.setBearing(0);
  }

  _liveRecenter() {
    if (!this._lastGpsPos) return;
    this._liveCenterPaused = false;
    this.map.flyTo({ center: [this._lastGpsPos.lng, this._lastGpsPos.lat], duration: 400 });
    if (this._liveRecenterBtn) this._liveRecenterBtn.style.display = 'none';
  }

  // ════════════════════════════════════════════════════════════════
  // SUBCATEGORÍAS
  // ════════════════════════════════════════════════════════════════

  showLoading(menuKey) {
    this.currentMenuKey = menuKey;
    this.currentSubcat  = null;
    this._footerEl.innerHTML = `
      <div class="hm-loading-chip">
        <div class="hm-loading-chip__spin"></div>
        Buscando lugares…
      </div>`;
    this._footerEl.classList.remove('hidden');
    requestAnimationFrame(() => this._footerEl.classList.add('visible'));
  }

  showSubcats(menuKey) {
    this.currentMenuKey = menuKey;
    const subcats = SUBCATEGORIES_MAP[menuKey] || [];
    if (!subcats.length) { this.hide(); return; }

    const isTodosActive = !this.currentSubcat || this.currentSubcat === 'all';
    let html = `<button class="subcategory-footer-chip${isTodosActive ? ' active' : ''}" data-val="all">Todos</button>`;
    html += subcats.map((s, i) => {
      const isActive = s.value === this.currentSubcat;
      const icon = s.icon3d
        ? `<img src="${s.icon3d}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'">`
        : `<span style="margin-right:3px">${s.emoji}</span>`;
      return `<button class="subcategory-footer-chip${isActive ? ' active' : ''}" data-val="${s.value}" style="animation-delay:${(i+1)*50}ms">${icon}${s.label}</button>`;
    }).join('');

    this._footerEl.innerHTML = html;
    this._footerEl.classList.remove('hidden');
    requestAnimationFrame(() => this._footerEl.classList.add('visible'));

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

  hide() {
    this._footerEl.classList.remove('visible');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (!this._footerEl.classList.contains('visible')) this._footerEl.innerHTML = '';
    }, 260);
    this.currentSubcat = null;
  }

  setBottom(px) {
    if (this._rowEl) this._rowEl.style.bottom = px != null ? `${px}px` : '';
  }

  // ════════════════════════════════════════════════════════════════
  // ESTILOS — copiados exactos del original
  // ════════════════════════════════════════════════════════════════
  _injectStyles() {
    if (document.getElementById('subcats-row-styles')) return;
    const s = document.createElement('style');
    s.id = 'subcats-row-styles';
    s.textContent = `
      .map-subcats-row {
        position:fixed; bottom:26dvh; left:0; right:0; z-index:50;
        display:flex; align-items:center; height:46px;
        overflow-x:auto; overflow-y:hidden; scrollbar-width:none;
        pointer-events:auto; padding:0; gap:8px;
        -webkit-overflow-scrolling:touch; touch-action:pan-x;
      }
      .map-subcats-row::after { content:''; min-width:16px; height:1px; flex-shrink:0; display:block; }
      .map-subcats-row::-webkit-scrollbar { display:none; }

      /* GPS btn */
      .hm-gps-btn {
        width:34px; height:34px; border-radius:50%;
        border:2px solid rgba(0,0,0,0.1); background:white; color:#6b7280;
        display:inline-flex; align-items:center; justify-content:center;
        cursor:pointer; flex-shrink:0; margin-left:12px; position:relative;
        box-shadow:0 1px 4px rgba(0,0,0,0.08);
        transition:border-color 0.2s, background 0.2s, color 0.2s;
        outline:none; -webkit-tap-highlight-color:transparent; overflow:visible;
      }
      .hm-gps-icon { display:block; flex-shrink:0; width:12px; height:12px; color:#6b7280; }
      .hm-gps-btn.loading { pointer-events:none; border-color:transparent; }
      .hm-gps-btn.loading::before {
        content:''; position:absolute; inset:-2.5px; border-radius:50%;
        border:2.5px solid transparent;
        border-top-color:#6366f1; border-right-color:rgba(99,102,241,0.3);
        animation:_hmGpsSpin 0.75s linear infinite; pointer-events:none;
      }
      .hm-gps-btn.active { border-color:rgba(0,0,0,0.1); background:white; color:#16a34a; }
      .hm-gps-btn.active::after {
        content:''; position:absolute; top:1px; right:1px;
        width:8px; height:8px; border-radius:50%;
        background:#16a34a; border:1.5px solid white;
        animation:_hmGpsDot 2s ease-in-out infinite;
      }
      @keyframes _hmGpsDot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.75);opacity:0.6} }
      @keyframes _hmGpsSpin { to{transform:rotate(360deg)} }

      /* Avatar en mapa */
      .hm-loc-avatar-wrap {
        width:36px; height:36px; border-radius:50%;
        border:2.5px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        overflow:hidden; background:#6366f1;
        display:flex; align-items:center; justify-content:center;
      }
      .hm-loc-avatar-img { width:100%; height:100%; object-fit:cover; }
      .hm-loc-avatar-fallback {
        width:100%; height:100%;
        display:flex; align-items:center; justify-content:center;
        font-size:20px; background:#6366f1;
      }

      /* LIVE btn */
      #hm-live-btn {
        height:28px; padding:0 10px; border-radius:999px;
        border:1.5px solid rgba(239,68,68,0.4); background:white; color:#dc2626;
        font-size:12px; font-weight:700; cursor:pointer;
        display:inline-flex; align-items:center; gap:5px; flex-shrink:0;
        outline:none; -webkit-tap-highlight-color:transparent;
        font-family:'Inter Tight',system-ui,sans-serif;
        transition:background 0.2s, color 0.2s;
      }
      #hm-live-btn.active { background:#dc2626; color:white; border-color:#dc2626; }
      .hm-live-dot {
        width:7px; height:7px; border-radius:50%; background:currentColor;
        animation:_hmLivePulse 1.2s ease-in-out infinite;
      }
      @keyframes _hmLivePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }

      /* Subcategorías footer */
      .map-subcategories-footer {
        display:flex; align-items:center; gap:8px;
        transition:opacity 0.25s ease;
        opacity:0; pointer-events:none; flex-shrink:0;
      }
      .map-subcategories-footer.visible  { opacity:1; pointer-events:all; }
      .map-subcategories-footer.hidden   { opacity:0; pointer-events:none; }
      .map-subcategories-footer::-webkit-scrollbar { display:none; }

      /* Chip */
      @keyframes waveIn { to { opacity:1; transform:translateY(0); } }
      .subcategory-footer-chip {
        display:inline-flex; align-items:center;
        height:34px; padding:0 14px;
        background:white; border:2px solid rgba(0,0,0,0.1);
        border-radius:999px; font-size:13px; font-weight:600; color:#111827;
        white-space:nowrap; cursor:pointer;
        transition:all 0.3s ease; flex-shrink:0;
        opacity:0; transform:translateY(6px);
        animation:waveIn 0.4s ease forwards; align-self:center;
        touch-action:manipulation; -webkit-tap-highlight-color:transparent;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .subcategory-footer-chip:nth-child(1){animation-delay:0.05s}
      .subcategory-footer-chip:nth-child(2){animation-delay:0.10s}
      .subcategory-footer-chip:nth-child(3){animation-delay:0.15s}
      .subcategory-footer-chip:nth-child(4){animation-delay:0.20s}
      .subcategory-footer-chip:nth-child(5){animation-delay:0.25s}
      .subcategory-footer-chip:nth-child(6){animation-delay:0.30s}
      .subcategory-footer-chip:nth-child(7){animation-delay:0.35s}
      .subcategory-footer-chip:nth-child(8){animation-delay:0.40s}
      .subcategory-footer-chip.active { background:#6366f1; border-color:#6366f1; color:white; }

      /* Loading chip */
      .hm-loading-chip {
        display:inline-flex; align-items:center; gap:7px;
        background:rgba(255,255,255,0.95); backdrop-filter:blur(10px);
        border:2px solid rgba(99,102,241,0.2); border-radius:999px;
        padding:0 14px; height:34px;
        font-size:13px; font-weight:600; color:#5b5fc7;
        box-shadow:0 2px 10px rgba(99,102,241,0.12);
        white-space:nowrap; flex-shrink:0; align-self:center;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .hm-loading-chip__spin {
        width:13px; height:13px;
        border:2px solid rgba(99,102,241,0.2); border-top-color:#6366f1;
        border-radius:50%; animation:_hmSpin 0.75s linear infinite; flex-shrink:0;
      }
      @keyframes _hmSpin { to{transform:rotate(360deg)} }
    `;
    document.head.appendChild(s);
  }
}
