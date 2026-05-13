// ====================================================================
// WHATSPLAN — src/components/SearchBar.js
// Barra de búsqueda global con autocompletado desde Airtable
// ====================================================================

export class SearchBar {
  /**
   * @param {Object} opts
   * @param {Function} opts.onPlaceSelect  — callback({ place_id, name, lat, lng, ... })
   * @param {Function} opts.onClose        — callback cuando se cierra la barra
   * @param {Function} opts.getCurrentCategory — devuelve la categoria activa o null
   */
  constructor(opts = {}) {
    this.onPlaceSelect       = opts.onPlaceSelect       || null;
    this.onClose             = opts.onClose             || null;
    this.getCurrentCategory  = opts.getCurrentCategory  || function() { return null; };

    this._el        = null;   // contenedor raíz
    this._input     = null;
    this._results   = null;
    this._debounce  = null;
    this._open      = false;

    this._injectStyles();
    this._build();
  }

  // ── API pública ───────────────────────────────────────────────────

  /** Abre la barra con animación */
  open() {
    if (this._open) return;
    this._open = true;
    this._el.style.display = 'flex';
    const gsap = window.gsap;
    if (gsap) {
      gsap.fromTo(this._el,
        { y: -20, opacity: 0 },
        { y: 0,   opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' }
      );
    }
    setTimeout(() => { if (this._input) this._input.focus(); }, 280);
  }

  /** Cierra la barra */
  close() {
    if (!this._open) return;
    this._open = false;
    this._hideResults();
    const gsap = window.gsap;
    if (gsap) {
      gsap.to(this._el, {
        y: -16, opacity: 0, duration: 0.18, ease: 'power2.in',
        onComplete: () => { this._el.style.display = 'none'; this._input.value = ''; }
      });
    } else {
      this._el.style.display = 'none';
      this._input.value = '';
    }
    if (this.onClose) this.onClose();
  }

  isOpen() { return this._open; }

  // ── Build ─────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.id        = 'wp-search-bar';
    el.className = 'wp-search-bar';
    el.style.display = 'none';

    el.innerHTML = `
      <div class="wp-search-inner">
        <span class="wp-search-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input
          id="wp-search-input"
          class="wp-search-input"
          type="search"
          placeholder="Buscar un lugar..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <button class="wp-search-clear hidden" id="wp-search-clear" aria-label="Limpiar">✕</button>
      </div>
      <div class="wp-search-results hidden" id="wp-search-results"></div>
    `;

    document.body.appendChild(el);
    this._el      = el;
    this._input   = el.querySelector('#wp-search-input');
    this._results = el.querySelector('#wp-search-results');
    const clearBtn = el.querySelector('#wp-search-clear');

    // Cerrar al tocar fuera
    document.addEventListener('click', (e) => {
      if (this._open && !el.contains(e.target)) this.close();
    }, { passive: true });

    // Input con debounce
    this._input.addEventListener('input', () => {
      const val = this._input.value.trim();
      clearBtn.classList.toggle('hidden', val.length === 0);
      clearTimeout(this._debounce);
      if (val.length < 2) { this._hideResults(); return; }
      this._debounce = setTimeout(() => { this._search(val); }, 280);
    });

    clearBtn.addEventListener('click', () => {
      this._input.value = '';
      clearBtn.classList.add('hidden');
      this._hideResults();
      this._input.focus();
    });

    // Cerrar con Escape
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  // ── Search ────────────────────────────────────────────────────────

  async _search(query) {
    this._showLoading();

    try {
      const cat = this.getCurrentCategory();
      const params = new URLSearchParams({ q: query, limit: '7' });
      if (cat) params.append('category', cat);

      const res = await fetch('/api/airtable-search?' + params.toString());
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();

      if (data.success && data.results && data.results.length > 0) {
        this._renderResults(data.results);
      } else {
        this._renderEmpty(query);
      }
    } catch (err) {
      console.warn('SearchBar error:', err.message);
      this._renderEmpty(query);
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  _renderResults(results) {
    this._results.innerHTML = '';
    const self = this;

    results.forEach(function(place) {
      const item = document.createElement('button');
      item.className = 'wp-search-item';

      const photo = place.photo_url
        ? `<img src="${place.photo_url}" class="wp-search-item-photo" onerror="this.style.display='none'">`
        : `<div class="wp-search-item-icon">📍</div>`;

      const stars = place.rating
        ? `<span class="wp-search-item-rating">⭐ ${Number(place.rating).toFixed(1)}</span>`
        : '';

      const featured = place.featured
        ? `<span class="wp-search-item-featured">★</span>`
        : '';

      item.innerHTML = `
        ${photo}
        <div class="wp-search-item-body">
          <div class="wp-search-item-name">${featured}${place.name}</div>
          ${stars}
          <div class="wp-search-item-address">${place.address || ''}</div>
        </div>
        <span class="wp-search-item-arrow">›</span>
      `;

      item.addEventListener('click', function() {
        self.close();
        if (self.onPlaceSelect) self.onPlaceSelect(place);
      });

      self._results.appendChild(item);
    });

    this._showResults();
  }

  _renderEmpty(query) {
    this._results.innerHTML = `
      <div class="wp-search-empty">
        <span>🔍</span>
        <span>Sin resultados para "<strong>${query}</strong>"</span>
      </div>
    `;
    this._showResults();
  }

  _showLoading() {
    this._results.innerHTML = `
      <div class="wp-search-loading">
        <div class="wp-search-spinner"></div>
        <span>Buscando...</span>
      </div>
    `;
    this._showResults();
  }

  _showResults() {
    this._results.classList.remove('hidden');
  }

  _hideResults() {
    this._results.classList.add('hidden');
    this._results.innerHTML = '';
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-search-styles')) return;
    const s = document.createElement('style');
    s.id = 'wp-search-styles';
    s.textContent = `
      /* ── Contenedor principal ── */
      #wp-search-bar {
        position: fixed;
        top: calc(12px + env(safe-area-inset-top, 0px));
        left: 12px;
        right: 12px;
        z-index: 10000;
        flex-direction: column;
        gap: 0;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }

      /* ── Input row ── */
      .wp-search-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        border-radius: 20px;
        padding: 10px 14px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      }

      .wp-search-icon {
        color: #9ca3af;
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }

      .wp-search-input {
        flex: 1;
        border: none;
        outline: none;
        font-size: 15px;
        font-weight: 500;
        color: #111827;
        background: transparent;
        font-family: inherit;
        min-width: 0;
        -webkit-appearance: none;
      }
      .wp-search-input::placeholder { color: #9ca3af; font-weight: 400; }
      .wp-search-input::-webkit-search-cancel-button { display: none; }

      .wp-search-clear {
        background: #e5e7eb;
        border: none;
        border-radius: 50%;
        width: 22px; height: 22px;
        font-size: 11px; color: #6b7280;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; flex-shrink: 0;
        -webkit-tap-highlight-color: transparent;
      }
      .wp-search-clear.hidden { display: none; }

      /* ── Resultados ── */
      .wp-search-results {
        background: white;
        border-radius: 16px;
        margin-top: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.14);
        overflow: hidden;
        max-height: 60vh;
        overflow-y: auto;
        scrollbar-width: none;
      }
      .wp-search-results::-webkit-scrollbar { display: none; }
      .wp-search-results.hidden { display: none; }

      /* ── Item ── */
      .wp-search-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 14px;
        background: none;
        border: none;
        border-bottom: 1px solid #f3f4f6;
        cursor: pointer;
        text-align: left;
        -webkit-tap-highlight-color: transparent;
      }
      .wp-search-item:last-child { border-bottom: none; }
      .wp-search-item:active { background: #f9fafb; }

      .wp-search-item-photo {
        width: 42px; height: 42px;
        object-fit: cover;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .wp-search-item-icon {
        width: 42px; height: 42px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0;
        background: #f3f4f6; border-radius: 10px;
      }

      .wp-search-item-body {
        flex: 1; min-width: 0; overflow: hidden;
      }
      .wp-search-item-name {
        font-size: 14px; font-weight: 700;
        color: #111827;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        font-family: 'Yahoo Sans Bold Regular', 'Inter Tight', system-ui, sans-serif;
      }
      .wp-search-item-featured { color: #f59e0b; margin-right: 2px; }
      .wp-search-item-rating   { font-size: 11px; color: #92400e; font-weight: 600; }
      .wp-search-item-address  { font-size: 10px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .wp-search-item-arrow    { font-size: 18px; color: #d1d5db; flex-shrink: 0; }

      /* ── Estados ── */
      .wp-search-empty, .wp-search-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
        font-size: 13px;
        color: #6b7280;
      }
      @keyframes wp-spin { to { transform: rotate(360deg); } }
      .wp-search-spinner {
        width: 16px; height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: wp-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(s);
  }
}
