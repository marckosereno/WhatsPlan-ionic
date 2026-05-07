// ====================================================================
// WHATSPLAN — SubcategoryRow.js
// Fila de chips: GPS + subcategorías + chip "buscando lugares"
// Copiado del comportamiento exacto de MapViewGL.js original
// ====================================================================

// Mapa de subcategorías hardcodeado (igual que categories.js original)
const R = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/';

const SUBCATEGORIES_MAP = {
  RESTAURANTS: [
    { label: 'Comida Mexicana', labelEN: 'Mexican Food',   value: 'mexican',  emoji: '🫔', icon3d: R+'Tamale/3D/tamale_3d.png' },
    { label: 'Tacos y Lonches', labelEN: 'Tacos & Lunch',  value: 'taco',     emoji: '🌮', icon3d: R+'Taco/3D/taco_3d.png' },
    { label: 'Mariscos',        labelEN: 'Seafood',         value: 'seafood',  emoji: '🦐', icon3d: R+'Shrimp/3D/shrimp_3d.png' },
    { label: 'Bares',           labelEN: 'Bars',            value: 'bar',      emoji: '🍶', icon3d: R+'Sake/3D/sake_3d.png' },
    { label: 'Cafeterías',      labelEN: 'Cafés',           value: 'cafe',     emoji: '🧋', icon3d: null },
    { label: 'Hamburguesas',    labelEN: 'Burgers',         value: 'burger',   emoji: '🍔', icon3d: R+'Hamburger/3D/hamburger_3d.png' },
  ],
  HEALTH: [
    { label: 'Dentistas',    labelEN: 'Dentists',      value: 'dental',   emoji: '🦷', icon3d: R+'Tooth/3D/tooth_3d.png' },
    { label: 'Farmacias',    labelEN: 'Pharmacies',    value: 'farmacia', emoji: '💊', icon3d: R+'Pill/3D/pill_3d.png' },
    { label: 'Salones',      labelEN: 'Beauty Salons', value: 'salon',    emoji: '💈', icon3d: null },
    { label: 'Médicos',      labelEN: 'Doctors',       value: 'medico',   emoji: '🩺', icon3d: R+'Stethoscope/3D/stethoscope_3d.png' },
    { label: 'Ópticas',      labelEN: 'Optometrists',  value: 'optica',   emoji: '👓', icon3d: R+'Glasses/3D/glasses_3d.png' },
    { label: 'Spa & Masaje', labelEN: 'Spa & Massage', value: 'spa',      emoji: '🧼', icon3d: R+'Soap/3D/soap_3d.png' },
  ],
  SHOPPING: [
    { label: 'Ropa y Moda',     labelEN: 'Fashion',         value: 'ropa',     emoji: '🎒', icon3d: R+'Backpack/3D/backpack_3d.png' },
    { label: 'Artesanías',      labelEN: 'Souvenirs',       value: 'souvenir', emoji: '🎈', icon3d: R+'Balloon/3D/balloon_3d.png' },
    { label: 'Joyería',         labelEN: 'Jewelry',         value: 'joyeria',  emoji: '💍', icon3d: R+'Ring/3D/ring_3d.png' },
    { label: 'Vinos y Licores', labelEN: 'Wines & Spirits', value: 'vinos',    emoji: '🍇', icon3d: R+'Grapes/3D/grapes_3d.png' },
    { label: 'Lentes',          labelEN: 'Eyewear',         value: 'lentes',   emoji: '👓', icon3d: R+'Glasses/3D/glasses_3d.png' },
  ],
  ENTERTAINMENT: [
    { label: 'Atracciones', labelEN: 'Attractions', value: 'atraccion', emoji: '🎟️', icon3d: R+'Ticket/3D/ticket_3d.png' },
    { label: 'Bares',       labelEN: 'Bars',         value: 'bar',       emoji: '🎤', icon3d: R+'Microphone/3D/microphone_3d.png' },
    { label: 'Hoteles',     labelEN: 'Hotels',       value: 'hotel',     emoji: '🏨', icon3d: R+'Hotel/3D/hotel_3d.png' },
    { label: 'Eventos',     labelEN: 'Events',       value: 'evento',    emoji: '🎈', icon3d: R+'Balloon/3D/balloon_3d.png' },
  ],
  PARKS: [
    { label: 'Plazas',  labelEN: 'Plazas', value: 'plaza',  emoji: '🌵', icon3d: R+'Cactus/3D/cactus_3d.png' },
    { label: 'Parques', labelEN: 'Parks',  value: 'parque', emoji: '🌱', icon3d: R+'Seedling/3D/seedling_3d.png' },
  ],
  WORKSHOPS: [
    { label: 'Mecánicos', labelEN: 'Auto Repair', value: 'mecanico', emoji: '🔧', icon3d: R+'Wrench/3D/wrench_3d.png' },
    { label: 'Servicios', labelEN: 'Services',    value: 'servicio', emoji: '🧰', icon3d: R+'Toolbox/3D/toolbox_3d.png' },
  ],
};

export class SubcategoryRow {
  constructor({ onSubcatSelect, onGpsClick, onFilterPlaces }) {
    this.onSubcatSelect  = onSubcatSelect;  // (value) → void   'all' = Todos
    this.onGpsClick      = onGpsClick;      // () → void
    this.onFilterPlaces  = onFilterPlaces;  // (value, places) → filteredPlaces[]
    this.currentMenuKey  = null;
    this.currentSubcat   = null;
    this.geoControl      = null;
    this._rowEl          = null;
    this._footerEl       = null;
    this._gpsEl          = null;
    this._loadingEl      = null;
    this._injectStyles();
    this._build();
  }

  // ── Construir el row ──────────────────────────────────────────────
  _build() {
    // Contenedor principal — fijo encima del panel
    const row = document.createElement('div');
    row.id = 'map-subcats-row';
    row.className = 'map-subcats-row';

    // GPS btn
    const gps = document.createElement('button');
    gps.id = 'map-gps-btn';
    gps.className = 'hm-gps-btn';
    gps.title = 'Mi ubicación';
    gps.innerHTML = `<svg class="hm-gps-icon" viewBox="0 0 122.88 122.88" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M120.3.14,1.24,40.38A1.82,1.82,0,0,0,.1,42.7a1.78,1.78,0,0,0,1.21,1.15h0L60.85,62,79,121.58h0a1.78,1.78,0,0,0,1.15,1.21,1.82,1.82,0,0,0,2.32-1.14L122.74,2.58A1.85,1.85,0,0,0,120.3.14Z"/>
    </svg>`;
    gps.addEventListener('click', () => this._handleGps());

    // Footer de subcategorías
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

  // ── Mostrar loading chip ─────────────────────────────────────────
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

  // ── Mostrar chips de subcategoría ─────────────────────────────────
  showSubcats(menuKey) {
    this.currentMenuKey = menuKey;
    const subcats = SUBCATEGORIES_MAP[menuKey] || [];

    if (subcats.length === 0) {
      this.hide();
      return;
    }

    const isTodosActive = !this.currentSubcat || this.currentSubcat === 'all';

    let html = `<button class="subcategory-footer-chip ${isTodosActive ? 'active' : ''}" data-val="all">Todos</button>`;

    html += subcats.map((s, i) => {
      const isActive  = s.value === this.currentSubcat;
      const iconHtml  = s.icon3d
        ? `<img src="${s.icon3d}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;margin-right:4px" onerror="this.style.display='none'">`
        : (s.emoji ? `<span style="margin-right:3px">${s.emoji}</span>` : '');
      return `<button class="subcategory-footer-chip ${isActive ? 'active' : ''}" data-val="${s.value}" style="animation-delay:${(i + 1) * 50}ms">${iconHtml}${s.label}</button>`;
    }).join('');

    this._footerEl.innerHTML = html;
    this._footerEl.classList.remove('hidden');
    requestAnimationFrame(() => this._footerEl.classList.add('visible'));

    // Listeners
    this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = chip.dataset.val;
        this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentSubcat = val;
        if (this.onSubcatSelect) this.onSubcatSelect(val);
      });
    });
  }

  // ── Ocultar chips con fade ────────────────────────────────────────
  hide() {
    if (!this._footerEl) return;
    this._footerEl.classList.remove('visible');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (!this._footerEl.classList.contains('visible')) {
        this._footerEl.innerHTML = '';
      }
    }, 260);
    this.currentSubcat = null;
  }

  // ── GPS ──────────────────────────────────────────────────────────
  _handleGps() {
    if (this.onGpsClick) { this.onGpsClick(); return; }
    // Si no hay callback externo, intentar geolocation directo
    if (!navigator.geolocation) return;
    const gps = this._gpsEl;
    gps.classList.add('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gps.classList.remove('loading');
        gps.classList.add('active');
        // El callback externo manejará el flyTo
      },
      () => { gps.classList.remove('loading'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  setGpsActive(active) {
    if (!this._gpsEl) return;
    this._gpsEl.classList.toggle('active', active);
    this._gpsEl.classList.remove('loading');
  }

  setGpsLoading(loading) {
    if (!this._gpsEl) return;
    this._gpsEl.classList.toggle('loading', loading);
    if (!loading) return;
    this._gpsEl.classList.remove('active');
  }

  // ── Posición (por si hay mini-panel abierto) ──────────────────────
  setBottom(px) {
    if (!this._rowEl) return;
    this._rowEl.style.bottom = px != null ? `${px}px` : '';
  }

  // ── Estilos — copiados exactos de map-view.css original ──────────
  _injectStyles() {
    if (document.getElementById('subcats-row-styles')) return;
    const s = document.createElement('style');
    s.id = 'subcats-row-styles';
    s.textContent = `
      /* ── Fila completa: GPS + chips ── */
      .map-subcats-row {
        position: fixed;
        bottom: 26dvh;
        left: 0; right: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        height: 46px;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        pointer-events: auto;
        padding: 0;
        gap: 8px;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-x;
      }
      .map-subcats-row::after {
        content: '';
        min-width: 16px;
        height: 1px;
        flex-shrink: 0;
        display: block;
      }
      .map-subcats-row::-webkit-scrollbar { display: none; }

      /* ── GPS botón ── */
      .hm-gps-btn {
        width: 34px; height: 34px;
        border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.1);
        background: white;
        color: #6b7280;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        margin-left: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        transition: border-color 0.2s, background 0.2s, color 0.2s;
        pointer-events: all;
        outline: none;
        -webkit-tap-highlight-color: transparent;
        position: relative;
        overflow: visible;
      }
      .hm-gps-icon {
        display: block;
        flex-shrink: 0;
        width: 12px; height: 12px;
        color: #6b7280;
      }
      /* Loading — spin */
      .hm-gps-btn.loading { pointer-events: none; border-color: transparent; }
      .hm-gps-btn.loading::before {
        content: '';
        position: absolute;
        inset: -2.5px;
        border-radius: 50%;
        border: 2.5px solid transparent;
        border-top-color: #6366f1;
        border-right-color: rgba(99,102,241,0.3);
        animation: _hmGpsSpin 0.75s linear infinite;
        pointer-events: none;
      }
      /* Activo — dot verde */
      .hm-gps-btn.active { border-color: rgba(0,0,0,0.1); background: white; color: #16a34a; }
      .hm-gps-btn.active::after {
        content: '';
        position: absolute;
        top: 1px; right: 1px;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #16a34a;
        border: 1.5px solid white;
        animation: _hmGpsDot 2s ease-in-out infinite;
      }
      @keyframes _hmGpsDot {
        0%,100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(0.75); opacity: 0.6; }
      }
      @keyframes _hmGpsSpin {
        to { transform: rotate(360deg); }
      }

      /* ── Footer de subcategorías ── */
      .map-subcategories-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        transition: opacity 0.25s ease;
        opacity: 0;
        pointer-events: none;
        flex-shrink: 0;
      }
      .map-subcategories-footer.visible  { opacity: 1; pointer-events: all; }
      .map-subcategories-footer.hidden   { opacity: 0; pointer-events: none; }
      .map-subcategories-footer::-webkit-scrollbar { display: none; }

      /* ── Chip de subcategoría ── */
      @keyframes waveIn {
        to { opacity: 1; transform: translateY(0); }
      }
      .subcategory-footer-chip {
        display: inline-flex;
        align-items: center;
        height: 34px;
        padding: 0 14px;
        background: white;
        border: 2px solid rgba(0,0,0,0.1);
        border-radius: 999px;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.3s ease;
        flex-shrink: 0;
        opacity: 0;
        transform: translateY(6px);
        animation: waveIn 0.4s ease forwards;
        align-self: center;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      .subcategory-footer-chip:nth-child(1) { animation-delay: 0.05s; }
      .subcategory-footer-chip:nth-child(2) { animation-delay: 0.10s; }
      .subcategory-footer-chip:nth-child(3) { animation-delay: 0.15s; }
      .subcategory-footer-chip:nth-child(4) { animation-delay: 0.20s; }
      .subcategory-footer-chip:nth-child(5) { animation-delay: 0.25s; }
      .subcategory-footer-chip:nth-child(6) { animation-delay: 0.30s; }
      .subcategory-footer-chip:nth-child(7) { animation-delay: 0.35s; }
      .subcategory-footer-chip:nth-child(8) { animation-delay: 0.40s; }
      .subcategory-footer-chip.active {
        background: #6366f1;
        border-color: #6366f1;
        color: white;
      }

      /* ── Loading chip ── */
      .hm-loading-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(99,102,241,0.2);
        border-radius: 999px;
        padding: 0 14px;
        height: 34px;
        font-size: 13px;
        font-weight: 600;
        color: #5b5fc7;
        box-shadow: 0 2px 10px rgba(99,102,241,0.12);
        white-space: nowrap;
        flex-shrink: 0;
        align-self: center;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }
      .hm-loading-chip__spin {
        width: 13px; height: 13px;
        border: 2px solid rgba(99,102,241,0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: _hmSpin 0.75s linear infinite;
        flex-shrink: 0;
      }
      @keyframes _hmSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }
}
