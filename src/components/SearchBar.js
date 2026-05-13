// ====================================================================
// WHATSPLAN — src/components/SearchBar.js
// Búsqueda global idéntica a himarco:
//   - Overlay encima del mapa con animación expandSearch
//   - Icono Fluent 3D lupa | input | clear | count | filtro | close
//   - Minifichas en footer (scroll horizontal) con badge horario
//   - Chips de categoría en footer cuando no hay búsqueda activa
//   - Filtra pins en tiempo real sobre los ya cargados (sin API)
//   - Al tap en minicard → flyTo + showMiniCard del pin
// ====================================================================

export class SearchBar {
  constructor(opts) {
    this.mapView           = opts.mapView;           // instancia de MapView
    this.getCategories     = opts.getCategories;     // fn → [{key,label_es,emoji,icon3d_url}]
    this.onCategorySelect  = opts.onCategorySelect;  // fn(categoryKey)

    this._active    = false;
    this._query     = '';
    this._debounce  = null;
    this._catChips  = null;  // div de chips de categoría en footer

    this._injectStyles();
  }

  // ── API pública ───────────────────────────────────────────────────

  activate() {
    if (this._active) return;
    this._active = true;

    // Ocultar topbar (avatar + search btn)
    const topbar = document.getElementById('topbar');
    if (topbar) {
      const gsap = window.gsap;
      if (gsap) {
        gsap.to(topbar, { x: 120, opacity: 0, duration: 0.22, ease: 'power2.in',
          onComplete: () => { topbar.style.pointerEvents = 'none'; }
        });
      } else {
        topbar.style.transform = 'translateX(120px)';
        topbar.style.opacity   = '0';
        topbar.style.pointerEvents = 'none';
      }
    }

    // Ocultar panel inferior
    const panel = document.getElementById('map-results-panel');
    if (panel) {
      const gsap = window.gsap;
      if (gsap) {
        gsap.to(panel, { y: 40, opacity: 0, duration: 0.2, ease: 'power2.in',
          onComplete: () => { panel.style.pointerEvents = 'none'; }
        });
      } else {
        panel.style.transform = 'translateY(40px)';
        panel.style.opacity   = '0';
        panel.style.pointerEvents = 'none';
      }
    }

    this._showOverlay();
    this._showCategoryChips();
    console.log('🔍 Búsqueda global activada');
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    this._query  = '';

    // Restaurar topbar
    const topbar = document.getElementById('topbar');
    if (topbar) {
      topbar.style.pointerEvents = '';
      const gsap = window.gsap;
      if (gsap) {
        gsap.to(topbar, { x: 0, opacity: 1, duration: 0.28, ease: 'power2.out', clearProps: 'all' });
      } else {
        topbar.style.transform = '';
        topbar.style.opacity   = '';
      }
    }

    // Restaurar panel
    const panel = document.getElementById('map-results-panel');
    if (panel) {
      panel.style.pointerEvents = '';
      const gsap = window.gsap;
      if (gsap) {
        gsap.to(panel, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out', clearProps: 'all' });
      } else {
        panel.style.transform = '';
        panel.style.opacity   = '';
      }
    }

    this._hideOverlay();
    this._hideCategoryChips();
    this._hideResults();
    this._restoreMarkers();
    console.log('🔍 Búsqueda global desactivada');
  }

  isActive() { return this._active; }

  // ── Overlay (barra de búsqueda) ───────────────────────────────────

  _showOverlay() {
    const existing = document.getElementById('wp-search-overlay');
    if (existing) existing.remove();

    const count = this._getCount();
    const overlay = document.createElement('div');
    overlay.id = 'wp-search-overlay';

    overlay.innerHTML = `
      <img class="wps-icon"
        src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Magnifying%20glass%20tilted%20right/3D/magnifying_glass_tilted_right_3d.png"
        onerror="this.style.display='none'">
      <input id="wps-input" class="wps-input" type="search"
        placeholder="Buscar un lugar"
        autocomplete="new-password" autocorrect="off"
        autocapitalize="off" spellcheck="false"
        name="wp-search-x${Date.now()}" readonly>
      <button id="wps-clear" class="wps-clear">✕</button>
      <span id="wps-count" class="wps-count">${count}</span>
      <button id="wps-filter" class="wps-filter" title="Filtros">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M5.78584 3C4.24726 3 3 4.24726 3 5.78584C3 6.59295 3.28872 7.37343 3.81398 7.98623L6.64813 11.2927C7.73559 12.5614 8.33333 14.1773 8.33333 15.8483V18C8.33333 19.6569 9.67648 21 11.3333 21H12.6667C14.3235 21 15.6667 19.6569 15.6667 18V15.8483C15.6667 14.1773 16.2644 12.5614 17.3519 11.2927L20.186 7.98624C20.7113 7.37343 21 6.59294 21 5.78584C21 4.24726 19.7527 3 18.2142 3H5.78584Z"/>
        </svg>
      </button>
      <button id="wps-close" class="wps-close">✕</button>
    `;
    document.body.appendChild(overlay);

    // Activar input después de un frame
    const input = document.getElementById('wps-input');
    setTimeout(() => {
      input.removeAttribute('readonly');
      input.blur();
      requestAnimationFrame(() => input.focus());
    }, 50);

    input.addEventListener('input', (e) => this._onInput(e.target.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.deactivate(); });

    const clearBtn = document.getElementById('wps-clear');
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      clearBtn.classList.remove('visible');
      input.focus();
      this._onInput('');
    });

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('visible', input.value.length > 0);
    });

    document.getElementById('wps-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deactivate();
    });

    document.getElementById('wps-filter').addEventListener('click', (e) => {
      e.stopPropagation();
      this._openFilterSheet();
    });

    // Cerrar al tocar el mapa (fuera del overlay y resultados)
    setTimeout(() => {
      this._mapClickHandler = (e) => {
        const overlay = document.getElementById('wp-search-overlay');
        const results = document.getElementById('wp-search-results');
        if (overlay && overlay.contains(e.target)) return;
        if (results && results.contains(e.target)) return;
        this._hideResults();
        const inp = document.getElementById('wps-input');
        if (inp) inp.blur();
      };
      document.addEventListener('click', this._mapClickHandler);
    }, 300);
  }

  _hideOverlay() {
    const overlay = document.getElementById('wp-search-overlay');
    if (overlay) overlay.remove();
    if (this._mapClickHandler) {
      document.removeEventListener('click', this._mapClickHandler);
      this._mapClickHandler = null;
    }
  }

  // ── Input handler ─────────────────────────────────────────────────

  _onInput(value) {
    this._query = value.toLowerCase().trim();
    clearTimeout(this._debounce);

    const countEl = document.getElementById('wps-count');

    if (this._query.length === 0) {
      this._hideResults();
      this._restoreMarkers();
      if (countEl) countEl.textContent = this._getCount();
      return;
    }

    this._debounce = setTimeout(() => {
      const places = this._getPlaces();
      const matches = places.filter((p) => {
        const name    = (p.name || '').toLowerCase();
        const address = (p.formattedAddress || p.formatted_address || p.vicinity || '').toLowerCase();
        return name.includes(this._query) || address.includes(this._query);
      });

      if (countEl) {
        countEl.textContent = matches.length + ' resultado' + (matches.length !== 1 ? 's' : '');
      }

      this._highlightMarkers(matches);
      this._renderResults(matches);
    }, 200);
  }

  // ── Resultados (minifichas en footer) ─────────────────────────────

  _renderResults(places) {
    this._hideResults();

    const container = document.createElement('div');
    container.id = 'wp-search-results';

    if (places.length === 0) {
      container.innerHTML = `
        <div class="wps-no-results">
          <span class="wps-no-results-emoji">🥺</span>
          <span class="wps-no-results-text">No se encontraron resultados</span>
        </div>`;
      document.body.appendChild(container);
      return;
    }

    const self = this;
    places.slice(0, 20).forEach(function(place) {
      const allPlaces = self._getPlaces();
      const placeIdx  = allPlaces.indexOf(place);
      const raw   = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;
      const photo = raw ? ('/api/photo-proxy?url=' + encodeURIComponent(raw)) : null;
      const rating      = place.rating ? Number(place.rating).toFixed(1) : '';
      const ratingCount = place.userRatingCount ? '(' + place.userRatingCount + ')' : '';
      const address     = (place.vicinity || place.formattedAddress || '').substring(0, 35);

      // Badge horario
      let badgeClass = 'no-hours', badgeText = 'Sin horario';
      const oh = place.regularOpeningHours;
      if (oh && oh.periods && oh.periods.length > 0) {
        const now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
        let isOpen = false, closingSoon = false, closeTime = '', opensAt = '';
        oh.periods.filter(p => p.open && p.open.day === day).forEach(p => {
          if (!p.open || !p.close) return;
          const openM  = p.open.hour  * 60 + (p.open.minute  || 0);
          const closeM = p.close.hour * 60 + (p.close.minute || 0);
          if (mins >= openM && mins < closeM) {
            isOpen = true;
            const left = closeM - mins;
            const h12 = p.close.hour > 12 ? p.close.hour - 12 : (p.close.hour || 12);
            const m0  = (p.close.minute || 0).toString().padStart(2, '0');
            closeTime = h12 + ':' + m0 + ' ' + (p.close.hour >= 12 ? 'PM' : 'AM');
            if (left > 0 && left <= 60) closingSoon = true;
          }
        });
        if (isOpen) {
          badgeClass = closingSoon ? 'closing-soon' : 'open';
          badgeText  = closingSoon && closeTime ? 'Cierra ' + closeTime : 'Abierto';
        } else {
          badgeClass = 'closed'; badgeText = opensAt ? 'Abre ' + opensAt : 'Cerrado';
        }
      }

      const priceLevel  = place.priceLevel || (place.rating >= 4.5 ? 3 : place.rating >= 4 ? 2 : 1);
      const priceSymbol = '$'.repeat(Math.min(priceLevel, 3));

      const card = document.createElement('div');
      card.className = 'wps-minicard';
      card.dataset.placeIndex = placeIdx;
      card.innerHTML = (photo
        ? `<img src="${photo}" class="wps-minicard-photo" alt="${place.name}">`
        : `<div class="wps-minicard-icon">${(self.mapView && self.mapView.currentCatData && self.mapView.currentCatData.icon) || '💎'}</div>`)
        + `<div class="wps-minicard-body">
            <div class="wps-minicard-header">
              <span class="wps-minicard-badge ${badgeClass}">${badgeText}</span>
              <span class="wps-minicard-price">${priceSymbol}</span>
            </div>
            <div class="wps-minicard-name">${place.name}</div>
            <div class="wps-minicard-address">${address}${address.length >= 35 ? '...' : ''}</div>
            <div class="wps-minicard-rating">
              <span class="wps-minicard-star">⭐</span>
              <span class="wps-minicard-rating-val">${rating}</span>
              <span class="wps-minicard-rating-cnt">${ratingCount}</span>
            </div>
          </div>`;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        self._onResultClick(placeIdx);
      });

      container.appendChild(card);
    });

    document.body.appendChild(container);
    // Ocultar chips de categoría cuando hay minifichas
    this._syncCategoryChips();
  }

  _onResultClick(placeIdx) {
    const mv = this.mapView;
    if (!mv) return;
    const places = this._getPlaces();
    const place  = places[placeIdx];
    if (!place) return;
    const lat = (place.location && place.location.lat) || place.lat;
    const lng = (place.location && place.location.lng) || place.lng;
    if (lat && lng) {
      mv.getMap().flyTo({ center: [lng, lat], zoom: 17, duration: 400 });
    }
    const raw = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;
    mv._showMiniCard(place, placeIdx, raw);
    console.log('✅ Mini-ficha mostrada desde búsqueda');
  }

  _hideResults() {
    const existing = document.getElementById('wp-search-results');
    if (existing) existing.remove();
    this._syncCategoryChips();
  }

  // ── Highlight de pins ─────────────────────────────────────────────

  _highlightMarkers(matches) {
    const mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    const matchedPlaces = new Set(matches.map(p => p.place_id || p.name));
    mv.markerEls.forEach((el, i) => {
      const p   = mv.places && mv.places[i];
      const key = p && (p.place_id || p.name);
      if (matchedPlaces.has(key)) {
        el.style.opacity = '1';
        el.style.filter  = 'none';
      } else {
        el.style.opacity = '0.25';
        el.style.filter  = 'grayscale(1)';
      }
    });
  }

  _restoreMarkers() {
    const mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    mv.markerEls.forEach((el) => {
      el.style.opacity = '';
      el.style.filter  = '';
    });
  }

  // ── Chips de categoría en footer ──────────────────────────────────

  _showCategoryChips() {
    this._hideCategoryChips();

    const cats = this.getCategories ? this.getCategories() : [];
    if (!cats.length) return;

    const container = document.createElement('div');
    container.id = 'wp-search-cat-chips';
    container.style.cssText = [
      'position:fixed', 'bottom:16px', 'left:0', 'right:0',
      'z-index:99997', 'display:flex', 'gap:8px',
      'padding:0 16px', 'overflow-x:auto', 'scrollbar-width:none',
      'animation:wpsSlideUp 0.3s ease', 'transition:opacity 0.25s ease',
    ].join(';');

    const mv = this.mapView;
    const currentKey = mv && mv.currentCatId;

    cats.forEach((cat) => {
      const isActive = cat.key === currentKey;
      const chip = document.createElement('div');
      chip.className = 'wps-cat-chip';
      chip.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:6px',
        'padding:10px 16px',
        'background:' + (isActive ? '#6366f1' : 'white'),
        'color:' + (isActive ? 'white' : '#111827'),
        'border:2px solid ' + (isActive ? '#6366f1' : 'rgba(0,0,0,0.1)'),
        'border-radius:50px', 'font-size:14px', 'font-weight:600',
        'white-space:nowrap', 'cursor:pointer', 'flex-shrink:0',
        'box-shadow:0 2px 10px rgba(0,0,0,0.1)',
        'touch-action:manipulation',
        '-webkit-tap-highlight-color:transparent',
      ].join(';');

      chip.innerHTML = cat.icon3d_url
        ? `<img src="${cat.icon3d_url}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle" onerror="this.outerHTML='<span>${cat.emoji || ''}</span>'"><span>${cat.label_es}</span>`
        : `<span>${cat.emoji || ''}</span><span>${cat.label_es}</span>`;

      const self = this;
      chip.addEventListener('click', async () => {
        // Limpiar búsqueda activa
        self._query = '';
        const inp = document.getElementById('wps-input');
        if (inp) inp.value = '';
        const clearBtn = document.getElementById('wps-clear');
        if (clearBtn) clearBtn.classList.remove('visible');
        self._hideResults();
        self._restoreMarkers();

        // Notificar al app para cargar categoría
        if (self.onCategorySelect) self.onCategorySelect(cat.key);

        // Actualizar estilo de chips
        container.querySelectorAll('.wps-cat-chip').forEach((c) => {
          c.style.background = 'white';
          c.style.color = '#111827';
          c.style.borderColor = 'rgba(0,0,0,0.1)';
        });
        chip.style.background   = '#6366f1';
        chip.style.color        = 'white';
        chip.style.borderColor  = '#6366f1';

        // Actualizar count
        setTimeout(() => {
          const count = self._getCount();
          const countEl = document.getElementById('wps-count');
          if (countEl) countEl.textContent = count;
        }, 500);
      });

      container.appendChild(chip);
    });

    document.body.appendChild(container);
    this._catChips = container;

    // Scroll al chip activo
    setTimeout(() => {
      const activeChip = container.querySelector('[style*="#6366f1"]');
      if (activeChip) activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 60);
  }

  _hideCategoryChips() {
    const existing = document.getElementById('wp-search-cat-chips');
    if (existing) {
      existing.style.opacity   = '0';
      existing.style.transform = 'translateY(20px)';
      setTimeout(() => existing.remove(), 300);
    }
    this._catChips = null;
  }

  _syncCategoryChips() {
    const chips   = document.getElementById('wp-search-cat-chips');
    const results = document.getElementById('wp-search-results');
    if (!chips) return;
    const hasMinicards = results && results.querySelector('.wps-minicard');
    chips.style.opacity       = hasMinicards ? '0' : '1';
    chips.style.pointerEvents = hasMinicards ? 'none' : 'all';
  }

  // ── Filter sheet (placeholder) ────────────────────────────────────

  _openFilterSheet() {
    // TODO: migrar _openFilterSheet de himarco
    console.log('🔧 Filter sheet — próximamente');
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _getPlaces() {
    const mv = this.mapView;
    return (mv && mv.places) ? mv.places : [];
  }

  _getCount() {
    const places = this._getPlaces();
    return places.length + ' lugares';
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-search-styles')) return;
    const s = document.createElement('style');
    s.id = 'wp-search-styles';
    s.textContent = `
      @keyframes wpsExpand {
        from { opacity:0; transform:scaleX(0.85) translateY(-8px); }
        to   { opacity:1; transform:scaleX(1)    translateY(0);    }
      }
      @keyframes wpsSlideUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0);    }
      }
      #wp-search-cat-chips::-webkit-scrollbar { display:none; }

      /* ── Overlay bar ── */
      #wp-search-overlay {
        position: fixed;
        top: calc(12px + env(safe-area-inset-top, 0px));
        left: 12px; right: 12px;
        z-index: 99999;
        background: white;
        border-radius: 50px;
        height: 48px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: wpsExpand 0.25s ease;
      }
      .wps-icon  { width:20px; height:20px; object-fit:contain; flex-shrink:0; }
      .wps-input {
        flex:1; border:none; background:transparent; outline:none;
        font-size:15px; font-weight:600; color:#111827; min-width:0;
        font-family:'Inter Tight',system-ui,sans-serif;
        -webkit-appearance:none;
      }
      .wps-input::placeholder { color:#9ca3af; font-weight:400; }
      .wps-input::-webkit-search-cancel-button { display:none; }
      .wps-clear {
        display:none; width:28px; height:28px; border-radius:50%;
        border:none; background:rgba(0,0,0,0.08); color:#6b7280;
        font-size:13px; font-weight:700; cursor:pointer; flex-shrink:0;
        align-items:center; justify-content:center;
        -webkit-tap-highlight-color:transparent;
      }
      .wps-clear.visible { display:flex; }
      .wps-count {
        font-size:11px; font-weight:600; color:#9ca3af;
        white-space:nowrap; flex-shrink:1; overflow:hidden;
        text-overflow:ellipsis; max-width:90px;
      }
      .wps-filter, .wps-close {
        width:32px; min-width:32px; height:32px; border-radius:50%;
        border:none; background:rgba(0,0,0,0.08); color:#6b7280;
        font-size:14px; font-weight:700; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0; -webkit-tap-highlight-color:transparent;
        transition: background 0.2s;
      }
      .wps-filter:active, .wps-close:active { background:rgba(0,0,0,0.15); }

      /* ── Minifichas en footer ── */
      #wp-search-results {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 99996;
        display: flex;
        gap: 12px;
        padding: 12px 16px calc(24px + env(safe-area-inset-bottom, 0px));
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        background: transparent;
        scrollbar-width: none;
      }
      #wp-search-results::-webkit-scrollbar { display:none; }

      .wps-minicard {
        display:flex; align-items:center; gap:10px; padding:10px 14px;
        background:white; border:2px solid #e5e7eb; border-radius:16px;
        box-shadow:0 4px 12px rgba(0,0,0,0.08);
        cursor:pointer; min-width:280px; max-width:300px; flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .wps-minicard:active { transform:scale(0.97); box-shadow:0 2px 6px rgba(0,0,0,0.1); }

      .wps-minicard-photo {
        width:70px; height:70px; object-fit:cover;
        border-radius:12px; flex-shrink:0;
      }
      .wps-minicard-icon {
        width:70px; height:70px; display:flex;
        align-items:center; justify-content:center;
        background:linear-gradient(135deg,#8b5cf6,#7c3aed);
        border-radius:12px; font-size:32px; flex-shrink:0;
      }
      .wps-minicard-body { flex:1; min-width:0; }
      .wps-minicard-header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
      .wps-minicard-badge {
        padding:4px 10px; border-radius:6px;
        font-size:11px; font-weight:700; color:white; display:inline-block;
      }
      .wps-minicard-badge.open         { background:#10b981; }
      .wps-minicard-badge.closing-soon  { background:#f59e0b; }
      .wps-minicard-badge.closed        { background:#ef4444; }
      .wps-minicard-badge.no-hours      { background:#6b7280; }
      .wps-minicard-price  { font-size:14px; font-weight:700; color:#1f2937; }
      .wps-minicard-name   {
        font-size:15px; font-weight:800; color:#111827;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        margin-bottom:2px;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
      }
      .wps-minicard-address {
        font-size:12px; color:#6b7280;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        margin-bottom:4px;
      }
      .wps-minicard-rating { display:flex; align-items:center; gap:4px; }
      .wps-minicard-star   { font-size:13px; }
      .wps-minicard-rating-val { font-size:13px; font-weight:700; color:#f59e0b; }
      .wps-minicard-rating-cnt { font-size:11px; color:#9ca3af; }

      .wps-no-results {
        display:flex; align-items:center; gap:10px;
        padding:14px 18px; background:white; border-radius:16px;
        font-size:14px; color:#6b7280;
        box-shadow:0 4px 12px rgba(0,0,0,0.08); flex-shrink:0;
      }
      .wps-no-results-emoji { font-size:20px; }
    `;
    document.head.appendChild(s);
  }
}
