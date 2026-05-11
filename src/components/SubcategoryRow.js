// WHATSPLAN — SubcategoryRow.js
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
    { label: 'Médicos',      value: 'medico',   emoji: '🩺', icon3d: R+'Stethoscope/3D/stethoscope_3d.png' },
  ],
  SHOPPING: [
    { label: 'Ropa y Moda',     value: 'ropa',     emoji: '🎒', icon3d: R+'Backpack/3D/backpack_3d.png' },
    { label: 'Joyería',         value: 'joyeria',  emoji: '💍', icon3d: R+'Ring/3D/ring_3d.png' },
  ],
  ENTERTAINMENT: [
    { label: 'Atracciones', value: 'atraccion', emoji: '🎟️', icon3d: R+'Ticket/3D/ticket_3d.png' },
    { label: 'Bares',       value: 'bar',       emoji: '🎤',  icon3d: R+'Microphone/3D/microphone_3d.png' },
  ],
};

export class SubcategoryRow {
  constructor({ map, onSubcatSelect }) {
    this.map = map; this.onSubcatSelect = onSubcatSelect;
    this.currentSubcat = null; this._footerEl = null;
    this._injectStyles(); this._build();
  }

  _build() {
    const gpsContainer = document.getElementById('panel-gps-container');
    const footer = document.getElementById('map-subcategories-footer');
    if (!gpsContainer || !footer) return;
    const gps = document.createElement('button');
    gps.className = 'hm-gps-btn';
    gps.innerHTML = `<svg style="width:12px;height:12px" viewBox="0 0 122.88 122.88" fill="currentColor"><path d="M120.3.14,1.24,40.38A1.82,1.82,0,0,0,.1,42.7a1.78,1.78,0,0,0,1.21,1.15h0L60.85,62,79,121.58h0a1.78,1.78,0,0,0,1.15,1.21,1.82,1.82,0,0,0,2.32-1.14L122.74,2.58A1.85,1.85,0,0,0,120.3.14Z"/></svg>`;
    gpsContainer.appendChild(gps);
    this._footerEl = footer;
  }

  showSubcats(menuKey) {
    const items = SUBCATEGORIES_MAP[menuKey] || [];
    if (!items.length) { this.hide(); return; }
    const allActive = !this.currentSubcat || this.currentSubcat === 'all';
    let html = `<button class="subcategory-footer-chip${allActive ? ' active' : ''}" data-val="all">Todos</button>`;
    html += items.map(s => {
      const isActive = this.currentSubcat === s.value;
      const icon = s.icon3d ? `<img src="${s.icon3d}" style="width:16px;height:16px;margin-right:4px">` : `<span>${s.emoji}</span>`;
      return `<button class="subcategory-footer-chip${isActive ? ' active' : ''}" data-val="${s.value}">${icon}${s.label}</button>`;
    }).join('');
    this._footerEl.innerHTML = html;
    this._footerEl.classList.add('visible');
    this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._footerEl.querySelectorAll('.subcategory-footer-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentSubcat = chip.dataset.val;
        if (this.onSubcatSelect) this.onSubcatSelect(chip.dataset.val);
      });
    });
  }

  hide() { this._footerEl.classList.remove('visible'); this.currentSubcat = null; }

  _injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      .hm-gps-btn { width:34px; height:34px; border-radius:50%; border:2px solid rgba(0,0,0,0.1); background:white; display:flex; align-items:center; justify-content:center; }
      .subcategory-footer-chip { display:inline-flex; align-items:center; height:34px; padding:0 14px; background:white; border:2px solid rgba(0,0,0,0.1); border-radius:999px; font-size:13px; font-weight:600; white-space:nowrap; cursor:pointer; }
      .subcategory-footer-chip.active { background:#6366f1; color:white; border-color:#6366f1; }
      .map-subcategories-footer { display:flex; gap:8px; opacity:0; transition:opacity 0.2s; }
      .map-subcategories-footer.visible { opacity:1; }
    `;
    document.head.appendChild(s);
  }
}
