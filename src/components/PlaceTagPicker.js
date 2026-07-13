// ====================================================================
// WHATSPLAN — PlaceTagPicker.js
// Singleton — un solo DOM, un solo set de listeners, estado siempre fresco
// ====================================================================

import { PLACE_TAGS } from '/src/services/PlaceTagService.js';

// ── Skeleton instantáneo — se monta una sola vez, sin dependencias ──
const _PILL_W = [110,90,130,100,120,85,140,95,115,105,80,125];
function _showSkeleton() {
  let sk = document.getElementById('wpt-sk');
  if (!sk) {
    const style = document.createElement('style');
    style.textContent = `
      #wpt-sk{display:none;position:fixed;inset:0;z-index:99996;flex-direction:column;
        align-items:center;padding:calc(20px + env(safe-area-inset-top,0px)) 24px calc(28px + env(safe-area-inset-bottom,0px));
        backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);-webkit-backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);
        background:rgba(255,255,255,0.12);transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);overflow-y:auto;}
      #wpt-sk.sk-in{transform:translateY(0);}
      @keyframes wpt-sk-sh{0%{background-position:200% center}100%{background-position:-200% center}}
      .wpt-sk-b{border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,0.25) 25%,rgba(255,255,255,0.55) 50%,rgba(255,255,255,0.25) 75%);
        background-size:400% 100%;animation:wpt-sk-sh 1.4s ease-in-out infinite;}`;
    document.head.appendChild(style);
    sk = document.createElement('div');
    sk.id = 'wpt-sk';
    sk.innerHTML =
      '<div class="wpt-sk-b" style="width:34px;height:34px;border-radius:50%;align-self:flex-end;margin-bottom:6px;flex-shrink:0;"></div>' +
      '<div class="wpt-sk-b" style="width:220px;height:27px;margin-bottom:8px;"></div>' +
      '<div class="wpt-sk-b" style="width:160px;height:27px;margin-bottom:18px;"></div>' +
      '<div class="wpt-sk-b" style="width:160px;height:28px;margin-bottom:22px;flex-shrink:0;"></div>' +
      _PILL_W.map((w,i) => {
        const a = i%3===0?'flex-start':i%3===1?'center':'flex-end';
        return `<div class="wpt-sk-b" style="width:${w}px;height:38px;margin-bottom:10px;align-self:${a};"></div>`;
      }).join('');
    document.body.appendChild(sk);
  }
  sk.style.display = 'flex';
  requestAnimationFrame(() => sk.classList.add('sk-in'));
}
function _hideSkeleton() {
  const sk = document.getElementById('wpt-sk');
  if (!sk) return;
  sk.classList.remove('sk-in');
  setTimeout(() => { sk.style.display = 'none'; }, 340);
}

// ── Singleton instance ────────────────────────────────────────────────
let _instance = null;

export class PlaceTagPicker {
  constructor({ onConfirm, onCancel } = {}) {
    if (_instance) {
      // Reusar singleton — solo actualizar callbacks
      _instance.onConfirm = onConfirm || (() => {});
      _instance.onCancel  = onCancel  || (() => {});
      return _instance;
    }
    this.onConfirm   = onConfirm || (() => {});
    this.onCancel    = onCancel  || (() => {});
    this._el         = null;
    this._userTags   = [];
    this._session    = [];
    this._remaining  = 3;
    this._build();
    _instance = this;
  }

  // ── API ──────────────────────────────────────────────────────────
  show(userTags = [], remaining = 3) {
    _showSkeleton();

    // Diferir el render pesado al siguiente frame — el skeleton ya es visible
    requestAnimationFrame(() => {
      this._userTags  = [...userTags];
      this._session   = [];
      this._remaining = remaining;
      this._render();
      this._el.style.display = 'flex';
      requestAnimationFrame(() => {
        this._el.classList.add('wpt-in');
        // Ocultar skeleton justo cuando el modal real está visible
        _hideSkeleton();
      });
    });
  }

  hide() {
    this._el.classList.remove('wpt-in');
    setTimeout(() => {
      this._el.style.display = 'none'; this._el.style.transform = '';
      // Limpiar sesión al cerrar
      this._session  = [];
      this._userTags = [];
    }, 300);
  }

  // ── Build — solo se llama UNA vez en toda la vida del app ────────
  _build() {
    // Eliminar cualquier instancia previa del DOM (por hot-reload)
    const old = document.getElementById('wpt-root');
    if (old) old.remove();

    const el = document.createElement('div');
    el.id = 'wpt-root';
    el.innerHTML = `
      <button class="wpt-close" id="wpt-close">✕</button>
      <div class="wpt-title">¿Cómo describirías<br>este lugar?</div>
      <div class="wpt-slots" id="wpt-slots"></div>
      <div class="wpt-list"  id="wpt-list"></div>
      <button class="wpt-confirm" id="wpt-confirm" style="display:none">Guardar</button>
      <style>${this._css()}</style>
    `;
    document.body.appendChild(el);
    this._el = el;

    // ── Listeners — uno solo, siempre lee this en tiempo de ejecución ──
    el.querySelector('#wpt-close').addEventListener('click', () => {
      this.hide();
      this.onCancel();
    });

    el.querySelector('#wpt-confirm').addEventListener('click', () => {
      if (!this._session.length) return;
      const payload = this._session.map(key => ({
        tag: PLACE_TAGS.find(t => t.key === key),
        action: 'add'
      }));
      this.hide();
      this.onConfirm(payload);
    });

    // Delegación en el root — un solo listener para todos los pills
    el.addEventListener('click', e => {
      // Tap fuera (en el root directamente) → cerrar
      if (e.target === el) { this.hide(); this.onCancel(); return; }
      const pill = e.target.closest('.wpt-pill');
      if (!pill) return;
      this._toggle(pill.dataset.key);
    });
  }

  // ── Render — reconstruye el contenido con estado actual ──────────
  _render() {
    const list  = this._el.querySelector('#wpt-list');
    const slots = this._el.querySelector('#wpt-slots');
    const btn   = this._el.querySelector('#wpt-confirm');
    const rem   = this._remaining;

    slots.innerHTML = rem > 0
      ? `<span class="wpt-dot-g"></span>${rem} etiqueta${rem!==1?'s':''} disponible${rem!==1?'s':''}`
      : '⚠ Sin etiquetas disponibles';
    slots.className = 'wpt-slots ' + (rem > 0 ? 'wpt-s-ok' : 'wpt-s-no');

    // Reconstruir pills con estado actual
    list.innerHTML = PLACE_TAGS.map(tag => {
      const already  = this._userTags.includes(tag.key);
      const selected = this._session.includes(tag.key);
      const active   = already || selected;
      return `<div class="wpt-pill${active ? ' wpt-active' : ''}" data-key="${tag.key}">
        <span class="wpt-em">${tag.emoji}</span>
        <span class="wpt-lbl">${tag.label}</span>
        <button class="wpt-pill-btn${active ? ' wpt-pill-btn-active' : ''}" tabindex="-1">
          ${active ? '−' : '+'}
        </button>
      </div>`;
    }).join('');

    const n = this._session.length;
    btn.style.display = n > 0 ? '' : 'none';
    btn.textContent   = `Guardar ${n} etiqueta${n!==1?'s':''}`;
  }

  // ── Toggle — modifica _session y re-renderiza ────────────────────
  _toggle(key) {
    const already = this._userTags.includes(key);

    if (already) {
      // Ya etiquetado → quitar directamente (no requiere "Guardar")
      this.hide();
      const tag = PLACE_TAGS.find(t => t.key === key);
      this.onConfirm([{ tag, action: 'remove' }]);
      return;
    }

    const idx = this._session.indexOf(key);
    if (idx > -1) {
      this._session.splice(idx, 1);
    } else {
      if (this._session.length >= this._remaining) {
        this._showToast(`Máximo ${this._remaining} etiquetas por lugar`);
        return;
      }
      this._session.push(key);
    }
    this._render();
  }

  _showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-family:var(--wp-font);z-index:99999;white-space:nowrap;pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ── CSS ──────────────────────────────────────────────────────────
  _css() { return `
    #wpt-root {
      display:none; position:fixed; inset:0; z-index:99997;
      flex-direction:column; align-items:center;
      padding:calc(20px + env(safe-area-inset-top,0px)) 24px
              calc(28px + env(safe-area-inset-bottom,0px));
      -webkit-backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);
      backdrop-filter:blur(28px) saturate(1.8) brightness(1.05);
      background:rgba(255,255,255,0.12);
      transform:translateY(100%); transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);
      overflow-y:auto;
    }
    #wpt-root.wpt-in { transform:translateY(0); }

    .wpt-close {
      align-self:flex-end; margin-bottom:6px;
      width:34px; height:34px; border-radius:50%; border:none;
      background:rgba(0,0,0,0.10); color:#1c1c1e;
      font-size:15px; cursor:pointer; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      -webkit-tap-highlight-color:transparent;
    }
    .wpt-close:active { background:rgba(0,0,0,0.20); }

    .wpt-title {
      font-size:27px; font-weight:800; color:#0a0a0a;
      font-family:var(--wp-font);
      text-align:center; line-height:1.2; letter-spacing:-0.03em;
      margin-bottom:10px;
      text-shadow:0 1px 8px rgba(255,255,255,0.5);
    }

    .wpt-slots {
      display:flex; align-items:center; gap:6px;
      padding:5px 14px; border-radius:999px;
      font-size:12px; font-weight:700;
      font-family:var(--wp-font);
      margin-bottom:18px; flex-shrink:0;
    }
    .wpt-s-ok { background:rgba(52,199,89,0.18); color:#15803d; }
    .wpt-s-no { background:rgba(255,59,48,0.15);  color:#c0392b; }
    .wpt-dot-g {
      width:7px; height:7px; border-radius:50%; background:#34c759;
      box-shadow:0 0 6px rgba(52,199,89,0.8); flex-shrink:0;
    }

    .wpt-list {
      display:flex; flex-direction:column; align-items:flex-start;
      gap:10px; width:100%; max-width:400px; padding:0 8px;
    }

    .wpt-pill:nth-child(odd)  { align-self:flex-start; }
    .wpt-pill:nth-child(even) { align-self:center; }
    .wpt-pill:nth-child(3n)   { align-self:flex-end; }
    .wpt-pill:nth-child(1)  { transform:rotate(-1.8deg); }
    .wpt-pill:nth-child(2)  { transform:rotate( 1.2deg); }
    .wpt-pill:nth-child(3)  { transform:rotate(-0.8deg); }
    .wpt-pill:nth-child(4)  { transform:rotate( 2.1deg); }
    .wpt-pill:nth-child(5)  { transform:rotate(-1.5deg); }
    .wpt-pill:nth-child(6)  { transform:rotate( 0.9deg); }
    .wpt-pill:nth-child(7)  { transform:rotate(-2.2deg); }
    .wpt-pill:nth-child(8)  { transform:rotate( 1.6deg); }
    .wpt-pill:nth-child(9)  { transform:rotate(-0.6deg); }
    .wpt-pill:nth-child(10) { transform:rotate( 1.9deg); }
    .wpt-pill:nth-child(11) { transform:rotate(-1.3deg); }
    .wpt-pill:nth-child(12) { transform:rotate( 2.4deg); }
    .wpt-pill:nth-child(13) { transform:rotate(-1.0deg); }
    .wpt-pill:nth-child(14) { transform:rotate( 0.7deg); }
    .wpt-pill:nth-child(15) { transform:rotate(-2.0deg); }
    .wpt-pill:nth-child(16) { transform:rotate( 1.4deg); }
    .wpt-pill:nth-child(17) { transform:rotate(-0.9deg); }
    .wpt-pill:nth-child(18) { transform:rotate( 2.2deg); }
    .wpt-pill:nth-child(19) { transform:rotate(-1.6deg); }
    .wpt-pill:nth-child(20) { transform:rotate( 1.1deg); }
    .wpt-pill:nth-child(21) { transform:rotate(-1.8deg); }
    .wpt-pill:nth-child(22) { transform:rotate( 0.8deg); }
    .wpt-pill:nth-child(23) { transform:rotate(-2.3deg); }

    .wpt-pill {
      display:inline-flex; align-items:center; gap:10px;
      padding:10px 16px 10px 14px; border-radius:999px;
      border:2px dashed rgba(0,0,0,0.22);
      background:rgba(255,255,255,0.22);
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.16s, border 0.16s, box-shadow 0.16s;
    }
    .wpt-pill:not(.wpt-active):active {
      transform:rotate(0deg) scale(0.96) !important;
    }
    .wpt-pill.wpt-active {
      transform:rotate(0deg) scale(1.03) !important;
      background:rgba(255,255,255,0.88);
      border:2px solid transparent;
      box-shadow:0 6px 20px rgba(0,0,0,0.10);
    }
    .wpt-em  { font-size:24px; flex-shrink:0; }
    .wpt-lbl {
      font-size:19px; font-weight:700; color:#0a0a0a;
      font-family:var(--wp-font);
      letter-spacing:-0.02em;
    }
    .wpt-pill-btn {
      width:28px; height:28px; border-radius:50%; border:none; flex-shrink:0;
      background:rgba(0,0,0,0.13); color:#fff;
      font-size:18px; font-weight:300; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      pointer-events:none; line-height:1;
    }
    .wpt-pill-btn-active { background:#007aff; }

    .wpt-confirm {
      margin-top:18px; width:100%; max-width:380px; flex-shrink:0;
      height:52px; border-radius:999px; border:none;
      background:#007aff; color:#fff;
      font-size:16px; font-weight:700; cursor:pointer;
      font-family:var(--wp-font);
      box-shadow:0 4px 20px rgba(0,122,255,0.35);
      -webkit-tap-highlight-color:transparent;
      transition:transform 0.15s, filter 0.15s;
    }
    .wpt-confirm:active { transform:scale(0.97); filter:brightness(0.92); }
  `;}
}
