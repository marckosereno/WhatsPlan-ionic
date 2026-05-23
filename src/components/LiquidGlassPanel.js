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
      position: fixed; bottom: calc(140px + env(safe-area-inset-bottom,0px));
      right: 16px; z-index: 99990;
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(37,99,235,0.9);
      backdrop-filter: blur(12px);
      border: 1.5px solid rgba(255,255,255,0.3);
      box-shadow: 0 4px 16px rgba(37,99,235,0.4);
      font-size: 20px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      touch-action: manipulation;
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
    `;
    this.fab.addEventListener('click', () => this.toggle());
    document.body.appendChild(this.fab);

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'lg-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: calc(195px + env(safe-area-inset-bottom,0px));
      right: 12px;
      width: 280px;
      z-index: 99989;
      background: rgba(15,15,30,0.96);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px;
      padding: 14px;
      display: flex; flex-direction: column; gap: 8px;
      transform: scale(0.85) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      max-height: 70vh;
      overflow-y: auto;
      scrollbar-width: none;
    `;

    this.panel.innerHTML = this._html();
    document.body.appendChild(this.panel);
    this._attachEvents();
  }

  _html() {
    const p = this.params;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="color:rgba(255,255,255,0.8);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:'Inter Tight',system-ui,sans-serif;">Liquid Glass</span>
        <button id="lgp-close" style="background:transparent;border:none;color:rgba(255,255,255,0.4);font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>
      </div>

      ${this._slider('refractionLevel', 'Refraction', 0, 1, 0.01, p.refractionLevel)}
      ${this._slider('bezelWidth', 'Bezel Width', 0.1, 0.6, 0.01, p.bezelWidth)}
      ${this._slider('specularOpacity', 'Spec Opacity', 0, 1, 0.01, p.specularOpacity)}
      ${this._slider('specularSat', 'Spec Saturation', 1, 50, 1, p.specularSat)}
      ${this._slider('bgOpacity', 'BG Opacity', 0, 0.8, 0.01, p.bgOpacity)}

      <div style="height:1px;background:rgba(255,255,255,0.07);margin:2px 0;"></div>

      ${this._color('bgColor', 'BG Color', p.bgColor)}
      ${this._color('borderColor', 'Border Color', p.borderColor)}
      ${this._color('fontColor', 'Font Color', p.fontColor)}
      ${this._color('iconColor', 'Icon Color', p.iconColor)}

      <div style="height:1px;background:rgba(255,255,255,0.07);margin:2px 0;"></div>

      <button id="lgp-copy" style="
        background:#2563eb;color:white;border:none;border-radius:10px;
        padding:9px;font-size:11px;font-weight:700;cursor:pointer;width:100%;
        font-family:'Inter Tight',system-ui,sans-serif;
        touch-action:manipulation;
      ">📋 Copiar parámetros</button>

      <button id="lgp-reset" style="
        background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);border:none;border-radius:10px;
        padding:7px;font-size:11px;font-weight:600;cursor:pointer;width:100%;
        font-family:'Inter Tight',system-ui,sans-serif;
        touch-action:manipulation;
      ">↺ Reset</button>
    `;
  }

  _slider(key, label, min, max, step, value) {
    const decimals = step < 1 ? 2 : 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:500;width:100px;flex-shrink:0;font-family:'Inter Tight',system-ui,sans-serif;">${label}</span>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}"
          style="flex:1;height:3px;appearance:none;-webkit-appearance:none;background:rgba(255,255,255,0.15);border-radius:2px;outline:none;">
        <span id="lgp-v-${key}" style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:600;width:30px;text-align:right;font-family:'Inter Tight',system-ui,sans-serif;">${parseFloat(value).toFixed(decimals)}</span>
      </div>
    `;
  }

  _color(key, label, value) {
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:500;width:100px;flex-shrink:0;font-family:'Inter Tight',system-ui,sans-serif;">${label}</span>
        <input type="color" data-key="${key}" value="${value}"
          style="width:28px;height:22px;border:none;border-radius:6px;cursor:pointer;padding:1px;background:transparent;">
        <span id="lgp-v-${key}" style="color:rgba(255,255,255,0.6);font-size:10px;font-family:monospace;">${value}</span>
      </div>
    `;
  }

  _attachEvents() {
    // Sliders
    this.panel.querySelectorAll('input[type=range]').forEach(el => {
      el.addEventListener('input', () => {
        const key = el.dataset.key;
        const step = parseFloat(el.step);
        const decimals = step < 1 ? 2 : 0;
        this.params[key] = parseFloat(el.value);
        const valEl = document.getElementById(`lgp-v-${key}`);
        if (valEl) valEl.textContent = parseFloat(el.value).toFixed(decimals);
        this._applyParams();
      });
    });

    // Colors
    this.panel.querySelectorAll('input[type=color]').forEach(el => {
      el.addEventListener('input', () => {
        const key = el.dataset.key;
        this.params[key] = el.value;
        const valEl = document.getElementById(`lgp-v-${key}`);
        if (valEl) valEl.textContent = el.value;
        this._applyParams();
      });
    });

    // Close
    this.panel.querySelector('#lgp-close')?.addEventListener('click', () => this.hide());

    // Copy
    this.panel.querySelector('#lgp-copy')?.addEventListener('click', () => this._copy());

    // Reset
    this.panel.querySelector('#lgp-reset')?.addEventListener('click', () => this._reset());
  }

  _applyParams() {
    // Notificar a liquid-glass.js via evento custom
    document.dispatchEvent(new CustomEvent('wp:lgparams', { detail: { ...this.params } }));
  }

  _copy() {
    const p = this.params;
    const text = `// Liquid Glass params
refractionLevel: ${p.refractionLevel},
bezelWidth:      ${p.bezelWidth},
specularOpacity: ${p.specularOpacity},
specularSat:     ${p.specularSat},
bgOpacity:       ${p.bgOpacity},
bgColor:         '${p.bgColor}',
borderColor:     '${p.borderColor}',
fontColor:       '${p.fontColor}',
iconColor:       '${p.iconColor}',`;

    navigator.clipboard.writeText(text).then(() => {
      const btn = this.panel.querySelector('#lgp-copy');
      if (btn) {
        btn.textContent = '✅ Copiado!';
        setTimeout(() => { btn.textContent = '📋 Copiar parámetros'; }, 2000);
      }
    });
  }

  _reset() {
    this.params = { ...DEFAULT_PARAMS };
    // Rebuild panel HTML
    this.panel.innerHTML = this._html();
    this._attachEvents();
    this._applyParams();
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.panel.style.opacity = '1';
    this.panel.style.transform = 'scale(1) translateY(0)';
    this.panel.style.pointerEvents = 'all';
    this.fab.style.transform = 'scale(0.9) rotate(180deg)';
  }

  hide() {
    this.visible = false;
    this.panel.style.opacity = '0';
    this.panel.style.transform = 'scale(0.85) translateY(20px)';
    this.panel.style.pointerEvents = 'none';
    this.fab.style.transform = 'scale(1) rotate(0deg)';
  }
}
