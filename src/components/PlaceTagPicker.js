// ====================================================================
// WHATSPLAN — PlaceTagPicker.js
// Full-screen blur + pills dashed/filled — selección múltiple
// ====================================================================

import { PLACE_TAGS } from '/src/services/PlaceTagService.js';

export class PlaceTagPicker {
  constructor({ onConfirm, onCancel } = {}) {
    this.onConfirm   = onConfirm || (() => {});
    this.onCancel    = onCancel  || (() => {});
    this._el         = null;
    this._userTags   = [];   // ya guardadas en Supabase
    this._session    = [];   // seleccionadas en esta sesión
    this._remaining  = 3;
    this._build();
  }

  // ── API ──────────────────────────────────────────────────────────
  show(userTags = [], remaining = 3) {
    this._userTags  = [...userTags];
    this._session   = [];
    this._remaining = remaining;
    this._render();
    this._el.style.display = 'flex';
    requestAnimationFrame(() => this._el.classList.add('wpt-in'));
  }

  hide() {
    this._el.classList.remove('wpt-in');
    setTimeout(() => { this._el.style.display = 'none'; }, 300);
  }

  // ── Build ────────────────────────────────────────────────────────
  _build() {
    if (document.getElementById('wpt-root')) {
      this._el = document.getElementById('wpt-root'); return;
    }
    const el = document.createElement('div');
    el.id = 'wpt-root';
    el.innerHTML = `
      <button class="wpt-close" id="wpt-close">✕</button>
      <div class="wpt-title">¿Cómo describirías<br>este lugar?</div>
      <div class="wpt-slots" id="wpt-slots"></div>
      <div class="wpt-list" id="wpt-list"></div>
      <button class="wpt-confirm" id="wpt-confirm" style="display:none">
        Guardar etiquetas
      </button>
      <style>${this._css()}</style>
    `;
    document.body.appendChild(el);
    this._el = el;
    this._wireEvents();
  }

  _render() {
    const list  = this._el.querySelector('#wpt-list');
    const slots = this._el.querySelector('#wpt-slots');
    const btn   = this._el.querySelector('#wpt-confirm');
    const rem   = this._remaining;

    slots.innerHTML = rem > 0
      ? `<span class="wpt-dot-g"></span>${rem} etiqueta${rem!==1?'s':''} disponible${rem!==1?'s':''}`
      : '⚠ Sin etiquetas disponibles';
    slots.className = 'wpt-slots ' + (rem > 0 ? 'wpt-s-ok' : 'wpt-s-no');

    list.innerHTML = PLACE_TAGS.map(tag => {
      const already  = this._userTags.includes(tag.key);
      const selected = this._session.includes(tag.key);
      const active   = already || selected;
      return `<div class="wpt-pill${active ? ' wpt-active' : ''}" data-key="${tag.key}">
        <span class="wpt-em">${tag.emoji}</span>
        <span class="wpt-lbl">${tag.label}</span>
        <button class="wpt-pill-btn${active ? ' wpt-pill-btn-active' : ''}">
          ${active ? '−' : '+'}
        </button>
      </div>`;
    }).join('');

    btn.style.display = this._session.length > 0 ? '' : 'none';
    const n = this._session.length;
    btn.textContent = `Guardar ${n} etiqueta${n!==1?'s':''}`;
  }

  _toggle(key) {
    const already = this._userTags.includes(key);
    if (already) {
      // Quitar — pasar directo al confirm handler
      this.hide();
      const tag = PLACE_TAGS.find(t => t.key === key);
      this.onConfirm([{ tag, action:'remove' }]);
      return;
    }
    const idx = this._session.indexOf(key);
    if (idx > -1) {
      this._session.splice(idx, 1);
    } else {
      if (this._session.length >= this._remaining) {
        this._showLimitToast(); return;
      }
      this._session.push(key);
    }
    this._render();
  }

  _showLimitToast() {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-family:"Inter Tight",sans-serif;z-index:99999;white-space:nowrap;pointer-events:none;';
    t.textContent = `Máximo ${this._remaining} etiquetas`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  _wireEvents() {
    this._el.querySelector('#wpt-close').addEventListener('click', () => {
      this.hide(); this.onCancel();
    });
    this._el.querySelector('#wpt-confirm').addEventListener('click', () => {
      if (!this._session.length) return;
      const payload = this._session.map(key => ({
        tag: PLACE_TAGS.find(t => t.key === key),
        action: 'add'
      }));
      this.hide();
      this.onConfirm(payload);
    });
    this._el.addEventListener('click', e => {
      const pill = e.target.closest('.wpt-pill');
      if (pill) this._toggle(pill.dataset.key);
    });
    // Tap fuera (en el blur) → cerrar
    this._el.addEventListener('click', e => {
      if (e.target === this._el) { this.hide(); this.onCancel(); }
    });
  }

  // ── CSS ──────────────────────────────────────────────────────────
  _css() { return `
    #wpt-root {
      display:none; position:fixed; inset:0; z-index:99997;
      flex-direction:column; align-items:center;
      padding:calc(24px + env(safe-area-inset-top,0px)) 24px
              calc(32px + env(safe-area-inset-bottom,0px));
      -webkit-backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);
      backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);
      background:rgba(255,255,255,0.12);
      opacity:0; transition:opacity 0.28s ease;
      overflow-y:auto;
    }
    #wpt-root.wpt-in { opacity:1; }

    /* Cerrar */
    .wpt-close {
      align-self:flex-end; margin-bottom:8px;
      width:34px; height:34px; border-radius:50%; border:none;
      background:rgba(0,0,0,0.12); color:#1c1c1e;
      font-size:15px; cursor:pointer; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.15s;
    }
    .wpt-close:active { background:rgba(0,0,0,0.22); }

    /* Título */
    .wpt-title {
      font-size:28px; font-weight:800; color:#0a0a0a;
      font-family:'Inter Tight',system-ui,sans-serif;
      text-align:center; line-height:1.2; letter-spacing:-0.03em;
      margin-bottom:12px;
      text-shadow:0 1px 8px rgba(255,255,255,0.5);
    }

    /* Slots badge */
    .wpt-slots {
      display:flex; align-items:center; gap:6px;
      padding:5px 14px; border-radius:999px;
      font-size:12px; font-weight:700;
      font-family:'Inter Tight',system-ui,sans-serif;
      margin-bottom:20px;
    }
    .wpt-s-ok { background:rgba(52,199,89,0.18); color:#15803d; }
    .wpt-s-no { background:rgba(255,59,48,0.15);  color:#c0392b; }
    .wpt-dot-g {
      width:7px; height:7px; border-radius:50%; background:#34c759;
      box-shadow:0 0 6px rgba(52,199,89,0.8); flex-shrink:0;
    }

    /* Lista de pills */
    .wpt-list {
      display:flex; flex-direction:column; gap:10px;
      width:100%; max-width:380px;
    }

    /* Pill */
    .wpt-pill {
      display:flex; align-items:center; gap:12px;
      padding:12px 14px 12px 18px;
      border-radius:999px;
      border:2px dashed rgba(0,0,0,0.22);
      background:rgba(255,255,255,0.18);
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.18s, border 0.18s, transform 0.12s;
    }
    .wpt-pill:active { transform:scale(0.97); }
    .wpt-pill.wpt-active {
      background:rgba(255,255,255,0.82);
      border:2px solid transparent;
      box-shadow:0 4px 20px rgba(0,0,0,0.10);
    }
    .wpt-em { font-size:26px; flex-shrink:0; }
    .wpt-lbl {
      flex:1; font-size:20px; font-weight:700; color:#0a0a0a;
      font-family:'Inter Tight',system-ui,sans-serif;
      letter-spacing:-0.02em;
    }
    .wpt-pill.wpt-active .wpt-lbl { color:#0a0a0a; }

    /* Botón +/− */
    .wpt-pill-btn {
      width:30px; height:30px; border-radius:50%; border:none; flex-shrink:0;
      background:rgba(0,0,0,0.15); color:#fff;
      font-size:18px; font-weight:300; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.15s;
      line-height:1;
    }
    .wpt-pill-btn-active {
      background:#007aff;
    }

    /* Confirmar */
    .wpt-confirm {
      margin-top:20px; width:100%; max-width:380px;
      height:52px; border-radius:999px; border:none;
      background:#007aff; color:#fff;
      font-size:16px; font-weight:700; cursor:pointer;
      font-family:'Inter Tight',system-ui,sans-serif;
      box-shadow:0 4px 20px rgba(0,122,255,0.35);
      -webkit-tap-highlight-color:transparent;
      transition:transform 0.15s, filter 0.15s;
      flex-shrink:0;
    }
    .wpt-confirm:active { transform:scale(0.97); filter:brightness(0.92); }
  `;}
}
