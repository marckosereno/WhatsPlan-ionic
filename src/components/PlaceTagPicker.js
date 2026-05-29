// ====================================================================
// WHATSPLAN — PlaceTagPicker.js
// Drum picker de etiquetas estilo iOS
// ====================================================================

import { PLACE_TAGS } from '/src/services/PlaceTagService.js';

export class PlaceTagPicker {
  constructor({ onConfirm, onCancel } = {}) {
    this.onConfirm = onConfirm || (() => {});
    this.onCancel  = onCancel  || (() => {});
    this._el       = null;
    this._selectedIndex = 0;
    this._build();
  }

  // ── Show ─────────────────────────────────────────────────────────
  show(userTags = [], remainingSlots = 3) {
    this._userTags      = userTags;
    this._remainingSlots = remainingSlots;
    this._selectedIndex  = 0;
    this._renderItems();
    this._el.style.display = 'flex';
    requestAnimationFrame(() => {
      this._el.querySelector('.wpt-sheet').classList.add('open');
    });
    this._scrollToSelected(false);
  }

  hide() {
    const sheet = this._el.querySelector('.wpt-sheet');
    sheet.classList.remove('open');
    setTimeout(() => { this._el.style.display = 'none'; }, 320);
  }

  // ── Build ─────────────────────────────────────────────────────────
  _build() {
    if (document.getElementById('wpt-picker-root')) {
      this._el = document.getElementById('wpt-picker-root');
      return;
    }
    const el = document.createElement('div');
    el.id = 'wpt-picker-root';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;align-items:flex-end;justify-content:center;';
    el.innerHTML = `
      <div class="wpt-backdrop"></div>
      <div class="wpt-sheet">
        <div class="wpt-handle"></div>
        <div class="wpt-header">
          <span class="wpt-title">Etiquetar lugar</span>
          <span class="wpt-slots" id="wpt-slots"></span>
        </div>
        <div class="wpt-drum-wrap">
          <!-- Líneas de selección -->
          <div class="wpt-sel-top"></div>
          <div class="wpt-sel-bot"></div>
          <!-- Lista drum -->
          <div class="wpt-drum" id="wpt-drum"></div>
          <!-- Fade top/bot -->
          <div class="wpt-fade-top"></div>
          <div class="wpt-fade-bot"></div>
        </div>
        <div class="wpt-actions">
          <button class="wpt-btn-cancel" id="wpt-cancel">Cancelar</button>
          <button class="wpt-btn-confirm" id="wpt-confirm">Etiquetar</button>
        </div>
      </div>
      ${this._css()}
    `;
    document.body.appendChild(el);
    this._el = el;
    this._wireEvents();
  }

  _renderItems() {
    const drum  = this._el.querySelector('#wpt-drum');
    const slots = this._el.querySelector('#wpt-slots');
    const rem   = this._remainingSlots;
    slots.textContent = rem > 0
      ? `${rem} etiqueta${rem !== 1 ? 's' : ''} disponible${rem !== 1 ? 's' : ''}`
      : 'Sin etiquetas disponibles';
    slots.style.color = rem > 0 ? '#34c759' : '#ff3b30';

    const ITEM_H = 52;
    drum.style.cssText = `height:${ITEM_H * 5}px; position:relative; overflow-y:scroll; scroll-snap-type:y mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none;`;

    // Padding arriba/abajo para que el primer y último ítem puedan centrarse
    const pad = document.createElement('div');
    pad.style.height = `${ITEM_H * 2}px`;
    drum.appendChild(pad.cloneNode());

    PLACE_TAGS.forEach((tag, i) => {
      const already = this._userTags.includes(tag.key);
      const row = document.createElement('div');
      row.className = 'wpt-item' + (already ? ' wpt-item-done' : '');
      row.dataset.i = i;
      row.style.cssText = `height:${ITEM_H}px; scroll-snap-align:center; display:flex; align-items:center; gap:12px; padding:0 24px; cursor:pointer; flex-shrink:0;`;
      row.innerHTML = `
        <span class="wpt-emoji">${tag.emoji}</span>
        <div class="wpt-item-text">
          <span class="wpt-label">${tag.label}</span>
          <span class="wpt-cat">${tag.cat}</span>
        </div>
        ${already ? '<span class="wpt-check">✓ Ya etiquetado</span>' : ''}
      `;
      drum.appendChild(row);
    });

    // Padding abajo
    drum.appendChild(pad.cloneNode());

    // Scroll listener para actualizar selección
    drum.addEventListener('scroll', () => this._onScroll(), { passive: true });
  }

  _onScroll() {
    const drum   = this._el.querySelector('#wpt-drum');
    const ITEM_H = 52;
    const idx    = Math.round(drum.scrollTop / ITEM_H);
    if (idx !== this._selectedIndex) {
      this._selectedIndex = idx;
      this._updateScale();
    }
  }

  _updateScale() {
    const drum   = this._el.querySelector('#wpt-drum');
    const ITEM_H = 52;
    const items  = drum.querySelectorAll('.wpt-item');
    items.forEach((item, i) => {
      const dist = Math.abs(i - this._selectedIndex);
      const scale   = dist === 0 ? 1.0 : dist === 1 ? 0.82 : dist === 2 ? 0.66 : 0.52;
      const opacity = dist === 0 ? 1.0 : dist === 1 ? 0.7  : dist === 2 ? 0.45 : 0.25;
      item.style.transform = `scale(${scale})`;
      item.style.opacity   = opacity;
      item.style.transition= 'transform 0.18s ease, opacity 0.18s ease';
    });
    // highlight item central
    drum.querySelectorAll('.wpt-item').forEach((item, i) => {
      item.classList.toggle('wpt-item-center', i === this._selectedIndex);
    });
  }

  _scrollToSelected(animate = true) {
    const drum   = this._el.querySelector('#wpt-drum');
    const ITEM_H = 52;
    drum.scrollTo({ top: this._selectedIndex * ITEM_H, behavior: animate ? 'smooth' : 'instant' });
    this._updateScale();
  }

  _wireEvents() {
    const self = this;
    this._el.querySelector('.wpt-backdrop').addEventListener('click', () => this.hide());
    this._el.querySelector('#wpt-cancel').addEventListener('click',  () => {
      this.hide();
      this.onCancel();
    });
    this._el.querySelector('#wpt-confirm').addEventListener('click', () => {
      const tag = PLACE_TAGS[this._selectedIndex];
      if (!tag) return;
      if (this._userTags.includes(tag.key)) {
        // Ya etiquetado — offrece quitarlo
        this.onConfirm({ tag, action: 'remove' });
      } else if (this._remainingSlots <= 0) {
        window.wpApp?.showMapToast?.('Ya usaste tus 3 etiquetas en este lugar', '#ff3b30');
      } else {
        this.onConfirm({ tag, action: 'add' });
      }
      this.hide();
    });
    // Tap en ítem → scroll a él
    this._el.addEventListener('click', e => {
      const item = e.target.closest('.wpt-item');
      if (!item) return;
      const i = parseInt(item.dataset.i);
      this._selectedIndex = i;
      this._scrollToSelected(true);
    });
  }

  _css() {
    return `<style>
    .wpt-backdrop {
      position:fixed; inset:0; background:rgba(0,0,0,0.4);
      backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
    }
    .wpt-sheet {
      position:relative; width:100%; max-width:480px;
      background:#fff; border-radius:28px 28px 0 0;
      padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));
      box-shadow:0 -8px 40px rgba(0,0,0,0.18);
      transform:translateY(110%);
      transition:transform 0.32s cubic-bezier(0.34,1.1,0.64,1);
      z-index:1;
    }
    .wpt-sheet.open { transform:translateY(0); }
    .wpt-handle {
      width:36px; height:4px; border-radius:2px;
      background:rgba(0,0,0,0.15); margin:12px auto 0;
    }
    .wpt-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 24px 8px;
    }
    .wpt-title {
      font-size:17px; font-weight:700; color:#0a0a0a;
      font-family:'Inter Tight',system-ui,sans-serif;
    }
    .wpt-slots {
      font-size:12px; font-weight:600;
      font-family:'Inter Tight',system-ui,sans-serif;
    }
    /* Drum wrapper */
    .wpt-drum-wrap {
      position:relative; height:260px; overflow:hidden; margin:8px 0;
    }
    /* Líneas de selección */
    .wpt-sel-top, .wpt-sel-bot {
      position:absolute; left:16px; right:16px; height:1px;
      background:rgba(0,0,0,0.1); z-index:3; pointer-events:none;
    }
    .wpt-sel-top { top:calc(50% - 26px); }
    .wpt-sel-bot { top:calc(50% + 26px); }
    /* Fades */
    .wpt-fade-top, .wpt-fade-bot {
      position:absolute; left:0; right:0; height:90px;
      z-index:2; pointer-events:none;
    }
    .wpt-fade-top {
      top:0;
      background:linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%);
    }
    .wpt-fade-bot {
      bottom:0;
      background:linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%);
    }
    /* Drum scroll */
    #wpt-drum { scrollbar-width:none; }
    #wpt-drum::-webkit-scrollbar { display:none; }
    .wpt-item { box-sizing:border-box; transform-origin:center; }
    .wpt-item-center .wpt-label { font-weight:800; color:#0a0a0a; font-size:16px; }
    .wpt-item-center .wpt-emoji { font-size:28px; }
    .wpt-emoji {
      font-size:22px; width:36px; text-align:center; flex-shrink:0;
      transition:font-size 0.18s ease;
    }
    .wpt-item-text { display:flex; flex-direction:column; flex:1; gap:1px; }
    .wpt-label {
      font-size:15px; font-weight:600; color:#1c1c1e;
      font-family:'Inter Tight',system-ui,sans-serif;
      transition:font-size 0.18s ease, font-weight 0.18s ease;
    }
    .wpt-cat {
      font-size:11px; color:#8e8e93;
      font-family:'Inter Tight',system-ui,sans-serif;
    }
    .wpt-check {
      font-size:11px; font-weight:600; color:#34c759;
      font-family:'Inter Tight',system-ui,sans-serif;
      flex-shrink:0;
    }
    .wpt-item-done .wpt-label { color:#34c759; }
    /* Actions */
    .wpt-actions {
      display:flex; gap:10px; padding:12px 20px 0;
    }
    .wpt-btn-cancel {
      flex:1; height:48px; border-radius:999px; border:none;
      background:rgba(118,118,128,0.12);
      font-size:15px; font-weight:600; color:#3a3a3c; cursor:pointer;
      font-family:'Inter Tight',system-ui,sans-serif;
      -webkit-tap-highlight-color:transparent;
      transition:transform 0.15s;
    }
    .wpt-btn-cancel:active { transform:scale(0.97); }
    .wpt-btn-confirm {
      flex:2; height:48px; border-radius:999px; border:none;
      background:#007aff; color:#fff;
      font-size:15px; font-weight:700; cursor:pointer;
      font-family:'Inter Tight',system-ui,sans-serif;
      -webkit-tap-highlight-color:transparent;
      box-shadow:0 4px 14px rgba(0,122,255,0.3);
      transition:transform 0.15s, filter 0.15s;
    }
    .wpt-btn-confirm:active { transform:scale(0.97); filter:brightness(0.92); }
    </style>`;
  }
}
