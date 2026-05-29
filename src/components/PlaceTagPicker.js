// ====================================================================
// WHATSPLAN — PlaceTagPicker.js
// Wheel de etiquetas — desliza desde la izquierda, fondo blur
// ====================================================================

import { PLACE_TAGS } from '/src/services/PlaceTagService.js';

const ITEM_H    = 56;   // alto de cada ítem
const VISIBLE   = 7;    // ítems visibles en el wheel (impar)
const PAD_ITEMS = Math.floor(VISIBLE / 2); // 3 ítems de padding

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

  // ── API pública ──────────────────────────────────────────────────
  show(userTags = [], remaining = 3) {
    this._userTags  = userTags;
    this._remaining = remaining;
    this._selectedIndex = 0;
    this._fillWheel();
    document.body.classList.add('wpt-open');
    this._el.style.display = 'flex';
    requestAnimationFrame(() => {
      this._el.classList.add('wpt-visible');
      this._el.querySelector('.wpt-panel').classList.add('wpt-panel-in');
    });
    this._scrollTo(0, false);
  }

  hide() {
    this._el.classList.remove('wpt-visible');
    this._el.querySelector('.wpt-panel').classList.remove('wpt-panel-in');
    document.body.classList.remove('wpt-open');
    setTimeout(() => { this._el.style.display = 'none'; }, 340);
  }

  // ── Build ────────────────────────────────────────────────────────
  _build() {
    if (document.getElementById('wpt-root')) {
      this._el = document.getElementById('wpt-root'); return;
    }
    const el = document.createElement('div');
    el.id = 'wpt-root';
    el.innerHTML = `
      <div class="wpt-overlay"></div>
      <div class="wpt-panel">
        <!-- Líneas de selección -->
        <div class="wpt-line wpt-line-top"></div>
        <div class="wpt-line wpt-line-bot"></div>
        <!-- Fades -->
        <div class="wpt-fade wpt-fade-top"></div>
        <div class="wpt-fade wpt-fade-bot"></div>
        <!-- Wheel -->
        <div class="wpt-wheel" id="wpt-wheel"></div>
        <!-- Badge slots -->
        <div class="wpt-badge" id="wpt-badge"></div>
      </div>
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

    // Badge
    badge.textContent = rem > 0
      ? `${rem} etiqueta${rem !== 1 ? 's' : ''} disponible${rem !== 1 ? 's' : ''}`
      : '⚠ Sin etiquetas disponibles';
    badge.style.background = rem > 0
      ? 'rgba(52,199,89,0.18)' : 'rgba(255,59,48,0.15)';
    badge.style.color = rem > 0 ? '#1a7a35' : '#c0392b';

    // Padding arriba/abajo para centrar primer y último ítem
    const pad = `<div style="height:${ITEM_H * PAD_ITEMS}px;flex-shrink:0"></div>`;
    wheel.innerHTML = pad + PLACE_TAGS.map((tag, i) => {
      const already = this._userTags.includes(tag.key);
      return `<div class="wpt-item${already ? ' wpt-already' : ''}"
                   data-i="${i}" data-key="${tag.key}">
        <span class="wpt-em">${tag.emoji}</span>
        <div class="wpt-info">
          <span class="wpt-lbl">${tag.label}</span>
          <span class="wpt-cat">${tag.cat}</span>
        </div>
        ${already ? '<span class="wpt-done">✓</span>' : ''}
      </div>`;
    }).join('') + pad;

    // Scroll listener
    wheel.onscroll = () => this._onScroll();
  }

  _onScroll() {
    const wheel = this._el.querySelector('#wpt-wheel');
    const idx   = Math.round(wheel.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(PLACE_TAGS.length - 1, idx));
    if (clamped !== this._selectedIndex) {
      this._selectedIndex = clamped;
      this._updateScale();
      // Haptic leve si disponible
      if (window.Capacitor?.Plugins?.Haptics)
        window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' }).catch(()=>{});
    }
  }

  _updateScale() {
    const items = this._el.querySelectorAll('.wpt-item');
    items.forEach((item, i) => {
      const dist = Math.abs(i - this._selectedIndex);
      const scale   = [1.0, 0.78, 0.60, 0.46][Math.min(dist, 3)];
      const opacity = [1.0, 0.65, 0.40, 0.20][Math.min(dist, 3)];
      item.style.transform = `scaleY(${scale}) scaleX(${0.92 + (1 - scale) * 0.1})`;
      item.style.opacity   = opacity;
      // Marcar el central
      if (dist === 0) {
        item.setAttribute('data-selected', '1');
      } else {
        item.removeAttribute('data-selected');
      }
    });
  }

  _scrollTo(idx, animate = true) {
    const wheel = this._el.querySelector('#wpt-wheel');
    if (!wheel) return;
    wheel.scrollTo({ top: idx * ITEM_H, behavior: animate ? 'smooth' : 'instant' });
    this._selectedIndex = idx;
    this._updateScale();
  }

  // ── Events ───────────────────────────────────────────────────────
  _wireEvents() {
    // Overlay → cerrar
    this._el.querySelector('.wpt-overlay')
      .addEventListener('click', () => { this.hide(); this.onCancel(); });

    // Tap en ítem → scroll + confirmar con doble tap o tras 400ms
    let _tapTimer = null;
    let _lastTap  = -1;
    this._el.addEventListener('click', e => {
      const item = e.target.closest('.wpt-item');
      if (!item) return;
      const i = parseInt(item.dataset.i);

      if (i === this._selectedIndex) {
        // Segundo tap en el ítem central → confirmar
        clearTimeout(_tapTimer);
        this._confirm();
      } else {
        // Primer tap → scroll al ítem
        this._scrollTo(i, true);
        clearTimeout(_tapTimer);
        // Auto-confirmar si el usuario no toca nada en 1.8s
        // (no — mejor esperar tap explícito)
      }
    });

    // Swipe derecha sobre el panel → cerrar
    const panel = this._el.querySelector('.wpt-panel');
    let _sx = 0;
    panel.addEventListener('touchstart', e => { _sx = e.touches[0].clientX; }, { passive:true });
    panel.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientX - _sx > 60) { this.hide(); this.onCancel(); }
    }, { passive:true });
  }

  _confirm() {
    const tag = PLACE_TAGS[this._selectedIndex];
    if (!tag) return;
    const action = this._userTags.includes(tag.key) ? 'remove' : 'add';
    this.hide();
    this.onConfirm({ tag, action });
  }

  // ── CSS ──────────────────────────────────────────────────────────
  _css() { return `
    #wpt-root {
      display:none; position:fixed; inset:0; z-index:99997;
      align-items:stretch; pointer-events:none;
    }
    #wpt-root.wpt-visible { pointer-events:all; }

    /* Blur overlay */
    .wpt-overlay {
      position:absolute; inset:0;
      background:rgba(0,0,0,0.25);
      -webkit-backdrop-filter:blur(12px) saturate(1.4);
      backdrop-filter:blur(12px) saturate(1.4);
      opacity:0; transition:opacity 0.32s ease;
    }
    #wpt-root.wpt-visible .wpt-overlay { opacity:1; }

    /* Panel izquierdo */
    .wpt-panel {
      position:relative; width:240px; flex-shrink:0;
      display:flex; flex-direction:column; align-items:stretch;
      justify-content:center;
      background:rgba(255,255,255,0.92);
      -webkit-backdrop-filter:blur(24px) saturate(1.8);
      backdrop-filter:blur(24px) saturate(1.8);
      box-shadow:8px 0 40px rgba(0,0,0,0.18);
      transform:translateX(-100%);
      transition:transform 0.34s cubic-bezier(0.32,0.72,0,1);
      overflow:hidden;
      padding:16px 0;
      border-radius:0 28px 28px 0;
    }
    .wpt-panel.wpt-panel-in { transform:translateX(0); }

    /* Líneas de selección */
    .wpt-line {
      position:absolute; left:12px; right:12px; height:1px;
      background:rgba(0,0,0,0.12); z-index:3; pointer-events:none;
    }
    .wpt-line-top { top:calc(50% - ${ITEM_H/2}px); }
    .wpt-line-bot { top:calc(50% + ${ITEM_H/2}px); }

    /* Fades */
    .wpt-fade {
      position:absolute; left:0; right:0; height:${ITEM_H * 2.5}px;
      z-index:2; pointer-events:none;
    }
    .wpt-fade-top {
      top:0;
      background:linear-gradient(to bottom,rgba(255,255,255,0.98),rgba(255,255,255,0));
    }
    .wpt-fade-bot {
      bottom:${ITEM_H + 16}px;
      background:linear-gradient(to top,rgba(255,255,255,0.98),rgba(255,255,255,0));
    }

    /* Wheel scroll */
    .wpt-wheel {
      overflow-y:scroll; overflow-x:hidden;
      height:${ITEM_H * VISIBLE}px;
      scroll-snap-type:y mandatory;
      -webkit-overflow-scrolling:touch;
      scrollbar-width:none;
      position:relative; z-index:1;
    }
    .wpt-wheel::-webkit-scrollbar { display:none; }

    /* Ítems */
    .wpt-item {
      height:${ITEM_H}px; flex-shrink:0;
      scroll-snap-align:center;
      display:flex; align-items:center; gap:10px;
      padding:0 16px 0 20px;
      transform-origin:center;
      transition:transform 0.16s ease, opacity 0.16s ease;
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
      box-sizing:border-box;
    }
    .wpt-em {
      font-size:22px; width:30px; text-align:center; flex-shrink:0;
    }
    .wpt-info {
      display:flex; flex-direction:column; gap:1px; flex:1; min-width:0;
    }
    .wpt-lbl {
      font-size:14px; font-weight:600; color:#1c1c1e;
      font-family:'Inter Tight',system-ui,sans-serif;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .wpt-cat {
      font-size:10px; color:#8e8e93;
      font-family:'Inter Tight',system-ui,sans-serif;
    }
    .wpt-done {
      font-size:12px; font-weight:700; color:#34c759; flex-shrink:0;
    }
    .wpt-already .wpt-lbl { color:#34c759; }

    /* Badge slots */
    .wpt-badge {
      margin:10px 14px 0;
      padding:6px 12px; border-radius:999px;
      font-size:11px; font-weight:700;
      font-family:'Inter Tight',system-ui,sans-serif;
      text-align:center;
      position:relative; z-index:4;
    }

    /* Instrucción hint — aparece en el ítem central */
    .wpt-item[data-selected] .wpt-lbl::after {
      content:' · toca para etiquetar';
      font-weight:400; color:#8e8e93; font-size:11px;
    }

    /* Body blur cuando está abierto */
    body.wpt-open #wp-place-modal .wp-pm-card,
    body.wpt-open #topbar { pointer-events:none; }
  `; }
}
