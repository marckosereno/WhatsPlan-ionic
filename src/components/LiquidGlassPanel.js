// ====================================================================
// WHATSPLAN — src/components/LiquidGlassPanel.js
// Panel de control en tiempo real para Liquid Glass
// ====================================================================

const DEFAULT_PARAMS = {
  refractionLevel: 0.47,
  bezelWidth:      0.28,
  specularOpacity: 0.58,
  specularSat:     8,
  bgOpacity:       0.35,
  bgColor:         '#3b6bff',
  borderColor:     '#4488ff',
  fontColor:       '#ffffff',
  iconColor:       '#ffffff',
};

export class LiquidGlassPanel {
  constructor() {
    this.params = { ...DEFAULT_PARAMS };
    this.visible = false;
    this._build();
  }

  _build() {
    // FAB button
    this.fab = document.createElement('button');
    this.fab.id = 'lg-panel-fab';
    this.fab.textContent = '🔮';
    this.fab.style.cssText = `
      position:fixed;bottom:calc(140px + env(safe-area-inset-bottom,0px));
      right:16px;z-index:99990;
      width:44px;height:44px;border-radius:50%;
      background:rgba(37,99,235,0.9);
      backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
      border:1.5px solid rgba(255,255,255,0.3);
      box-shadow:0 4px 16px rgba(37,99,235,0.4);
      font-size:20px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      touch-action:manipulation;
      transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
    `;
    this.fab.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.fab);

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'lg-panel';
    this.panel.style.cssText = `
      position:fixed;
      bottom:calc(196px + env(safe-area-inset-bottom,0px));
      right:12px;width:280px;z-index:99989;
      background:rgba(12,12,24,0.97);
      backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:20px;padding:14px;
      display:flex;flex-direction:column;gap:8px;
      transform:scale(0.85) translateY(20px);
      opacity:0;pointer-events:none;
      transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),opacity 0.2s ease;
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
      max-height:72vh;overflow-y:auto;scrollbar-width:none;
      font-family:'Inter Tight',system-ui,sans-serif;
    `;
    this._renderPanel();
    document.body.appendChild(this.panel);
  }

  _renderPanel() {
    const p = this.params;
    this.panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🔮 Liquid Glass</span>
        <button id="lgp-close" style="background:transparent;border:none;color:rgba(255,255,255,0.35);font-size:18px;cursor:pointer;padding:0;line-height:1;touch-action:manipulation;">✕</button>
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
      ${this._s('refractionLevel','Refraction',0,1,0.01,p.refractionLevel)}
      ${this._s('bezelWidth','Bezel Width',0.1,0.6,0.01,p.bezelWidth)}
      ${this._s('specularOpacity','Spec Opacity',0,1,0.01,p.specularOpacity)}
      ${this._s('specularSat','Spec Saturation',1,50,1,p.specularSat)}
      ${this._s('bgOpacity','BG Opacity',0,0.8,0.01,p.bgOpacity)}
      <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
      ${this._c('bgColor','BG Color',p.bgColor)}
      ${this._c('borderColor','Border Color',p.borderColor)}
      ${this._c('fontColor','Font Color',p.fontColor)}
      ${this._c('iconColor','Icon Color',p.iconColor)}
      <div style="height:1px;background:rgba(255,255,255,0.07);"></div>
      <button id="lgp-copy" style="background:#2563eb;color:white;border:none;border-radius:10px;padding:9px;font-size:11px;font-weight:700;cursor:pointer;width:100%;touch-action:manipulation;">📋 Copiar parámetros</button>
      <button id="lgp-reset" style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);border:none;border-radius:10px;padding:7px;font-size:11px;font-weight:600;cursor:pointer;width:100%;touch-action:manipulation;">↺ Reset defaults</button>
    `;

    // Slider thumb style via injected style
    if (!document.getElementById('lgp-style')) {
      const st = document.createElement('style');
      st.id = 'lgp-style';
      st.textContent = `
        #lg-panel input[type=range]{flex:1;height:3px;appearance:none;-webkit-appearance:none;background:rgba(255,255,255,0.15);border-radius:2px;outline:none;}
        #lg-panel input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#2563eb;cursor:pointer;box-shadow:0 0 6px rgba(37,99,235,0.6);}
        #lg-panel::-webkit-scrollbar{display:none;}
      `;
      document.head.appendChild(st);
    }

    this._attachEvents();
  }

  _s(key, label, min, max, step, value) {
    const dec = step < 1 ? 2 : 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:500;width:96px;flex-shrink:0;">${label}</span>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
        <span id="lgpv-${key}" style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:600;width:28px;text-align:right;">${parseFloat(value).toFixed(dec)}</span>
      </div>`;
  }

  _c(key, label, value) {
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:500;width:96px;flex-shrink:0;">${label}</span>
        <input type="color" data-key="${key}" value="${value}" style="width:28px;height:22px;border:none;border-radius:6px;cursor:pointer;padding:1px;background:transparent;flex-shrink:0;">
        <span id="lgpv-${key}" style="color:rgba(255,255,255,0.5);font-size:10px;font-family:monospace;">${value}</span>
      </div>`;
  }

  _attachEvents() {
    this.panel.querySelectorAll('input[type=range]').forEach(el => {
      el.addEventListener('input', () => {
        const key = el.dataset.key;
        const dec = parseFloat(el.step) < 1 ? 2 : 0;
        this.params[key] = parseFloat(el.value);
        const v = document.getElementById(`lgpv-${key}`);
        if (v) v.textContent = parseFloat(el.value).toFixed(dec);
        this._dispatch();
      });
    });

    this.panel.querySelectorAll('input[type=color]').forEach(el => {
      el.addEventListener('input', () => {
        const key = el.dataset.key;
        this.params[key] = el.value;
        const v = document.getElementById(`lgpv-${key}`);
        if (v) v.textContent = el.value;
        this._dispatch();
      });
    });

    this.panel.querySelector('#lgp-close')?.addEventListener('click', () => this.hide());

    this.panel.querySelector('#lgp-copy')?.addEventListener('click', () => {
      const p = this.params;
      const txt = `refractionLevel: ${p.refractionLevel},\nbezelWidth:      ${p.bezelWidth},\nspecularOpacity: ${p.specularOpacity},\nspecularSat:     ${p.specularSat},\nbgOpacity:       ${p.bgOpacity},\nbgColor:         '${p.bgColor}',\nborderColor:     '${p.borderColor}',\nfontColor:       '${p.fontColor}',\niconColor:       '${p.iconColor}',`;
      navigator.clipboard?.writeText(txt);
      const btn = this.panel.querySelector('#lgp-copy');
      if (btn) { btn.textContent = '✅ Copiado!'; setTimeout(() => { btn.textContent = '📋 Copiar parámetros'; }, 2000); }
    });

    this.panel.querySelector('#lgp-reset')?.addEventListener('click', () => {
      this.params = { ...DEFAULT_PARAMS };
      this._renderPanel();
      this._dispatch();
    });
  }

  _dispatch() {
    // Disparar evento para liquid-glass.js
    document.dispatchEvent(new CustomEvent('wp:lgparams', { detail: { ...this.params } }));
    // También llamar directo si está disponible
    if (window.wpLiquidGlass && window.wpLiquidGlass.updateParam) {
      Object.entries(this.params).forEach(([k,v]) => window.wpLiquidGlass.updateParam(k,v));
    }
  }

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.panel.style.opacity = '1';
    this.panel.style.transform = 'scale(1) translateY(0)';
    this.panel.style.pointerEvents = 'all';
    this.fab.style.transform = 'rotate(180deg) scale(0.9)';
  }

  hide() {
    this.visible = false;
    this.panel.style.opacity = '0';
    this.panel.style.transform = 'scale(0.85) translateY(20px)';
    this.panel.style.pointerEvents = 'none';
    this.fab.style.transform = 'rotate(0deg) scale(1)';
  }
}
