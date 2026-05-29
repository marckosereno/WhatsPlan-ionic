// ====================================================================
// WHATSPLAN — PlaceTagPicker.js
// Wheel full-screen con perspectiva 3D — fondo blur oscuro
// ====================================================================

import { PLACE_TAGS } from '/src/services/PlaceTagService.js';

const ITEM_H  = 54;
const PAD     = 5;   // ítems de padding arriba/abajo

export class PlaceTagPicker {
  constructor({ onConfirm, onCancel } = {}) {
    this.onConfirm      = onConfirm || (() => {});
    this.onCancel       = onCancel  || (() => {});
    this._el            = null;
    this._selectedIndex = 0;
    this._userTags      = [];
    this._remaining     = 3;
    this._build();
  }

  // ── API ──────────────────────────────────────────────────────────
  show(userTags = [], remaining = 3) {
    this._userTags      = userTags;
    this._remaining     = remaining;
    this._selectedIndex = 0;
    this._fillWheel();
    this._el.style.display = 'flex';
    requestAnimationFrame(() => this._el.classList.add('wpt-in'));
    this._scrollTo(0, false);
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
      <!-- Botón cerrar -->
      <button class="wpt-close" id="wpt-close">✕</button>
      <!-- Badge slots -->
      <div class="wpt-badge" id="wpt-badge"></div>
      <!-- Wheel -->
      <div class="wpt-wheel-wrap">
        <div class="wpt-fade-top"></div>
        <div class="wpt-fade-bot"></div>
        <div class="wpt-sel-bar"></div>
        <div class="wpt-wheel" id="wpt-wheel"></div>
      </div>
      <!-- Confirmar -->
      <button class="wpt-confirm" id="wpt-confirm">Etiquetar</button>
      <style>${this._css()}</style>
    `;
    document.body.appendChild(el);
    this._el = el;
    this._wireEvents();
  }

  _fillWheel() {
    const wheel = this._el.querySelector('#wpt-wheel');
    const badge = this._el.querySelector('#wpt-badge');
    const rem   = this._remaining;

    badge.innerHTML = rem > 0
      ? `<span class="wpt-dot-green"></span>${rem} etiqueta${rem !== 1 ? 's' : ''} disponible${rem !== 1 ? 's' : ''}`
      : '⚠ Sin etiquetas disponibles';
    badge.className = 'wpt-badge ' + (rem > 0 ? 'wpt-badge-ok' : 'wpt-badge-no');

    // Padding vacío para centrar primer/último ítem
    const pad = `<div style="height:${ITEM_H * PAD}px;flex-shrink:0"></div>`;
    wheel.innerHTML = pad + PLACE_TAGS.map((tag, i) => {
      const already = this._userTags.includes(tag.key);
      return `<div class="wpt-item${already ? ' wpt-done' : ''}" data-i="${i}">
        ${already ? '<span class="wpt-dot"></span>' : '<span class="wpt-dot wpt-dot-empty"></span>'}
        <span class="wpt-em">${tag.emoji}</span>
        <span class="wpt-lbl">${tag.label}</span>
      </div>`;
    }).join('') + pad;

    wheel.onscroll = () => this._onScroll();
  }

  _onScroll() {
    const wheel = this._el.querySelector('#wpt-wheel');
    const idx   = Math.max(0, Math.min(
      PLACE_TAGS.length - 1,
      Math.round(wheel.scrollTop / ITEM_H)
    ));
    if (idx !== this._selectedIndex) {
      this._selectedIndex = idx;
      this._updateScale();
      try { window.Capacitor?.Plugins?.Haptics?.impact({ style:'LIGHT' }); } catch(_){}
    }
  }

  _updateScale() {
    const items = this._el.querySelectorAll('.wpt-item');
    items.forEach((item, i) => {
      const dist = Math.abs(i - this._selectedIndex);
      // Escala de perspectiva — simula cilindro 3D
      const scale   = Math.max(0.38, 1 - dist * 0.14);
      const opacity = Math.max(0.12, 1 - dist * 0.22);
      const blur    = dist === 0 ? 0 : Math.min(dist * 0.8, 2.4);
      item.style.transform  = `scale(${scale})`;
      item.style.opacity    = opacity;
      item.style.filter     = blur > 0 ? `blur(${blur}px)` : 'none';
      item.style.fontWeight = dist === 0 ? '800' : dist === 1 ? '600' : '400';
      // marcar centro
      item.classList.toggle('wpt-center', dist === 0);
    });
    // Actualizar label del botón confirmar
    const tag  = PLACE_TAGS[this._selectedIndex];
    const btn  = this._el.querySelector('#wpt-confirm');
    const done = tag && this._userTags.includes(tag.key);
    if (btn && tag) {
      btn.textContent = done ? `Quitar "${tag.label}"` : `Etiquetar · ${tag.emoji} ${tag.label}`;
      btn.style.background = done ? 'rgba(255,59,48,0.85)' : '';
    }
  }

  _scrollTo(idx, animate = true) {
    const wheel = this._el.querySelector('#wpt-wheel');
    if (!wheel) return;
    wheel.scrollTo({ top: idx * ITEM_H, behavior: animate ? 'smooth' : 'instant' });
    this._selectedIndex = idx;
    requestAnimationFrame(() => this._updateScale());
  }

  _wireEvents() {
    this._el.querySelector('#wpt-close').addEventListener('click', () => {
      this.hide(); this.onCancel();
    });
    this._el.querySelector('#wpt-confirm').addEventListener('click', () => {
      this._confirm();
    });
    // Tap en ítem → scroll a él; doble tap en centro → confirmar
    let _lastI = -1, _lastT = 0;
    this._el.addEventListener('click', e => {
      const item = e.target.closest('.wpt-item');
      if (!item) return;
      const i   = parseInt(item.dataset.i);
      const now = Date.now();
      if (i === this._selectedIndex && now - _lastT < 400) {
        this._confirm(); // doble tap
      } else {
        this._scrollTo(i, true);
      }
      _lastI = i; _lastT = now;
    });
  }

  _confirm() {
    const tag    = PLACE_TAGS[this._selectedIndex];
    if (!tag) return;
    const action = this._userTags.includes(tag.key) ? 'remove' : 'add';
    this.hide();
    this.onConfirm({ tag, action });
  }

  // ── CSS ──────────────────────────────────────────────────────────
  _css() { return `
    #wpt-root {
      display:none; position:fixed; inset:0; z-index:99997;
      flex-direction:column; align-items:center; justify-content:center;
      gap:0;
      /* Fondo blur oscuro — sin panel */
      background:rgba(255,255,255,0.08);
      -webkit-backdrop-filter:blur(24px) saturate(1.6);
      backdrop-filter:blur(24px) saturate(1.6);
      opacity:0; transition:opacity 0.28s ease;
    }
    #wpt-root.wpt-in { opacity:1; }

    /* Cerrar */
    .wpt-close {
      position:absolute; top:calc(20px + env(safe-area-inset-top,0px)); right:20px;
      width:36px; height:36px; border-radius:50%; border:none;
      background:rgba(0,0,0,0.10); color:#1c1c1e;
      font-size:16px; cursor:pointer; display:flex;
      align-items:center; justify-content:center;
      -webkit-tap-highlight-color:transparent;
      transition:background 0.15s;
    }
    .wpt-close:active { background:rgba(0,0,0,0.18); }

    /* Badge */
    .wpt-badge {
      position:absolute; top:calc(24px + env(safe-area-inset-top,0px));
      left:50%; transform:translateX(-50%);
      display:flex; align-items:center; gap:6px;
      padding:5px 14px; border-radius:999px;
      font-size:12px; font-weight:700;
      font-family:'Inter Tight',system-ui,sans-serif;
      white-space:nowrap;
    }
    .wpt-badge-ok { background:rgba(52,199,89,0.15); color:#15803d; }
    .wpt-badge-no { background:rgba(255,59,48,0.15);  color:#c0392b; }
    .wpt-dot-green {
      width:7px; height:7px; border-radius:50%;
      background:#34c759; flex-shrink:0;
      box-shadow:0 0 6px rgba(52,199,89,0.7);
    }

    /* Wheel wrap */
    .wpt-wheel-wrap {
      position:relative; width:100%; max-width:400px;
      height:${ITEM_H * 9}px; overflow:hidden;
    }

    /* Barra de selección central */
    .wpt-sel-bar {
      position:absolute; left:10%; right:10%;
      top:calc(50% - ${ITEM_H/2}px); height:${ITEM_H}px;
      border-top:1px solid rgba(0,0,0,0.12);
      border-bottom:1px solid rgba(0,0,0,0.12);
      border-radius:12px;
      z-index:2; pointer-events:none;
    }

    /* Fades top/bot */
    .wpt-fade-top, .wpt-fade-bot {
      position:absolute; left:0; right:0;
      height:${ITEM_H * 3.2}px; z-index:3; pointer-events:none;
    }
    .wpt-fade-top {
      top:0;
      background:linear-gradient(to bottom,rgba(255,255,255,0.85),rgba(255,255,255,0));
    }
    .wpt-fade-bot {
      bottom:0;
      background:linear-gradient(to top,rgba(255,255,255,0.85),rgba(255,255,255,0));
    }

    /* Wheel */
    .wpt-wheel {
      height:100%; overflow-y:scroll; overflow-x:hidden;
      scroll-snap-type:y mandatory;
      -webkit-overflow-scrolling:touch;
      scrollbar-width:none;
    }
    .wpt-wheel::-webkit-scrollbar { display:none; }

    /* Ítems */
    .wpt-item {
      height:${ITEM_H}px; flex-shrink:0;
      scroll-snap-align:center;
      display:flex; align-items:center; justify-content:center; gap:10px;
      cursor:pointer; transform-origin:center;
      transition:transform 0.18s ease, opacity 0.18s ease, filter 0.18s ease;
      -webkit-tap-highlight-color:transparent;
      padding:0 20px;
    }
    .wpt-dot {
      width:8px; height:8px; border-radius:50%; flex-shrink:0;
      background:#34c759;
      box-shadow:0 0 6px rgba(52,199,89,0.8);
    }
    .wpt-dot-empty { background:transparent; box-shadow:none; }
    .wpt-em { font-size:20px; flex-shrink:0; }
    .wpt-lbl {
      font-size:22px; font-weight:700; color:#0a0a0a;
      font-family:'Inter Tight',system-ui,sans-serif;
      letter-spacing:-0.02em; white-space:nowrap;
      transition:font-weight 0.18s ease;
    }
    .wpt-center .wpt-lbl { font-size:24px; }
    .wpt-done .wpt-lbl   { color:#4ade80; }

    /* Confirmar */
    .wpt-confirm {
      position:absolute;
      bottom:calc(32px + env(safe-area-inset-bottom,0px));
      left:24px; right:24px; height:52px; border-radius:999px; border:none;
      background:#007aff;
      font-size:16px; font-weight:700; color:#fff; cursor:pointer;
      font-family:'Inter Tight',system-ui,sans-serif;
      -webkit-tap-highlight-color:transparent;
      transition:transform 0.15s, filter 0.15s, background 0.2s;
      box-shadow:0 4px 20px rgba(0,122,255,0.35);
    }
    .wpt-confirm:active { transform:scale(0.97); filter:brightness(0.92); }
  `;}
}
