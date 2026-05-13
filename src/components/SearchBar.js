// ====================================================================
// WHATSPLAN — src/components/SearchBar.js  (v4)
// ====================================================================

export class SearchBar {
  constructor(opts) {
    this.mapView          = opts.mapView;
    this.getCategories    = opts.getCategories;
    this.onCategorySelect = opts.onCategorySelect;

    this._active   = false;
    this._query    = '';
    this._debounce = null;

    this._injectStyles();
    this._installViewportListener();
  }

  // ── API pública ───────────────────────────────────────────────────

  activate() {
    if (this._active) return;
    this._active = true;
    var gsap   = window.gsap;
    var topbar = document.getElementById('topbar');
    var panel  = document.getElementById('map-results-panel');

    if (topbar) {
      topbar.style.pointerEvents = 'none';
      if (gsap) gsap.to(topbar, { x: 120, opacity: 0, duration: 0.2, ease: 'power2.in' });
      else { topbar.style.transform = 'translateX(120px)'; topbar.style.opacity = '0'; }
    }
    if (panel) {
      panel.style.pointerEvents = 'none';
      if (gsap) gsap.to(panel, { y: 40, opacity: 0, duration: 0.18, ease: 'power2.in' });
      else { panel.style.transform = 'translateY(40px)'; panel.style.opacity = '0'; }
    }

    // Mover row de subcats debajo de la barra
    var subcatsRow = document.getElementById('map-subcategories-footer');
    if (subcatsRow) subcatsRow.classList.add('in-search-mode');

    this._showOverlay();
    this._showCategoryChips();
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    this._query  = '';

    var gsap   = window.gsap;
    var topbar = document.getElementById('topbar');
    var panel  = document.getElementById('map-results-panel');

    if (topbar) {
      topbar.style.pointerEvents = '';
      if (gsap) gsap.to(topbar, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
      else { topbar.style.transform = ''; topbar.style.opacity = ''; }
    }
    if (panel) {
      panel.style.pointerEvents = '';
      if (gsap) gsap.to(panel, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'all' });
      else { panel.style.transform = ''; panel.style.opacity = ''; }
    }

    var subcatsRow = document.getElementById('map-subcategories-footer');
    if (subcatsRow) subcatsRow.classList.remove('in-search-mode');

    this._hideOverlay();
    this._hideResults();
    this._hideCategoryChips();
    this._restoreMarkers();
  }

  isActive() { return this._active; }

  // ── Overlay ───────────────────────────────────────────────────────

  _showOverlay() {
    var e = document.getElementById('wp-sbar');
    if (e) e.remove();
    var count   = this._getCount();
    var overlay = document.createElement('div');
    overlay.id  = 'wp-sbar';
    overlay.innerHTML =
      '<img class="wps-icon" src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Magnifying%20glass%20tilted%20right/3D/magnifying_glass_tilted_right_3d.png" onerror="this.style.display=\'none\'">' +
      '<input id="wps-input" class="wps-input" type="search" placeholder="Buscar un lugar" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" name="wps' + Date.now() + '" readonly>' +
      '<button id="wps-clear" class="wps-clear">✕</button>' +
      '<span id="wps-count" class="wps-count">' + count + '</span>' +
      '<button id="wps-filter" class="wps-filter" title="Filtros"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5.786 3C4.247 3 3 4.247 3 5.786c0 .807.289 1.588.814 2.2l2.834 3.307C7.736 12.561 8.333 14.177 8.333 15.848V18c0 1.657 1.343 3 3 3h1.334c1.657 0 3-1.343 3-3v-2.152c0-1.671.597-3.287 1.685-4.562l2.834-3.307A3.786 3.786 0 0021 5.786C21 4.247 19.753 3 18.214 3H5.786z"/></svg></button>' +
      '<button id="wps-close" class="wps-close">✕</button>';
    document.body.appendChild(overlay);

    var self  = this;
    var input = document.getElementById('wps-input');
    setTimeout(function() {
      input.removeAttribute('readonly');
      input.blur();
      requestAnimationFrame(function() { input.focus(); });
    }, 50);

    var clearBtn = document.getElementById('wps-clear');
    input.addEventListener('input', function(ev) {
      clearBtn.classList.toggle('visible', input.value.length > 0);
      self._onInput(ev.target.value);
    });
    input.addEventListener('keydown', function(ev) { if (ev.key === 'Escape') self.deactivate(); });

    clearBtn.addEventListener('click', function(ev) {
      ev.stopPropagation();
      input.value = '';
      clearBtn.classList.remove('visible');
      input.focus();
      self._onInput('');
    });
    document.getElementById('wps-close').addEventListener('click', function(ev) {
      ev.stopPropagation(); self.deactivate();
    });
    document.getElementById('wps-filter').addEventListener('click', function(ev) {
      ev.stopPropagation();
      console.log('🔧 Filtros próximamente');
    });

    setTimeout(function() {
      self._mapClick = function(ev) {
        var bar = document.getElementById('wp-sbar');
        var res = document.getElementById('wp-sresults');
        if (bar && bar.contains(ev.target)) return;
        if (res && res.contains(ev.target)) return;
        self._hideResults();
        input.blur();
      };
      document.addEventListener('click', self._mapClick);
    }, 300);
  }

  _hideOverlay() {
    var o = document.getElementById('wp-sbar');
    if (o) o.remove();
    if (this._mapClick) { document.removeEventListener('click', this._mapClick); this._mapClick = null; }
  }

  // ── Input ─────────────────────────────────────────────────────────

  _onInput(value) {
    this._query = value.toLowerCase().trim();
    clearTimeout(this._debounce);
    var countEl = document.getElementById('wps-count');

    if (this._query.length === 0) {
      this._hideResults();
      this._restoreMarkers();
      if (countEl) countEl.textContent = this._getCount();
      return;
    }

    var self = this;
    this._debounce = setTimeout(function() {
      var all     = self._getAllPlaces();
      var matches = all.filter(function(p) {
        var name = (p.name || '').toLowerCase();
        var addr = (p.formattedAddress || p.formatted_address || p.vicinity || '').toLowerCase();
        return name.includes(self._query) || addr.includes(self._query);
      });

      var label = matches.length + ' resultado' + (matches.length !== 1 ? 's' : '');
      if (countEl) countEl.textContent = label;

      // Highlight en mapa — matches normales, resto gris
      self._highlightMarkers(matches, all);
      self._renderResults(matches);
    }, 200);
  }

  // ── Minifichas ────────────────────────────────────────────────────

  _renderResults(places) {
    this._hideResults();
    var container = document.createElement('div');
    container.id  = 'wp-sresults';

    if (places.length === 0) {
      container.innerHTML = '<div class="wps-noresult"><span style="font-size:20px">🥺</span><span>No se encontraron resultados</span></div>';
      document.body.appendChild(container);
      this._positionResults();
      this._syncCategoryChips();
      return;
    }

    var self      = this;
    var allPlaces = this._getAllPlaces();

    places.slice(0, 20).forEach(function(place) {
      var idx   = allPlaces.indexOf(place);
      var raw   = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;
      var photo = raw ? ('/api/photo-proxy?url=' + encodeURIComponent(raw)) : null;
      var rating = place.rating ? Number(place.rating).toFixed(1) : '';
      var rCount = place.userRatingCount ? '(' + place.userRatingCount + ')' : '';
      var address = (place.vicinity || place.formattedAddress || '').substring(0, 35);
      var icon = (self.mapView && self.mapView.currentCatData && self.mapView.currentCatData.icon) || '💎';

      // Badge horario
      var badgeClass = 'no-hours', badgeText = 'Sin horario';
      var oh = place.regularOpeningHours;
      if (oh && oh.periods && oh.periods.length > 0) {
        var now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
        var isOpen = false, closingSoon = false, closeTime = '';
        oh.periods.filter(function(p) { return p.open && p.open.day === day; }).forEach(function(p) {
          if (!p.open || !p.close) return;
          var openM  = p.open.hour * 60 + (p.open.minute || 0);
          var closeM = p.close.hour * 60 + (p.close.minute || 0);
          if (mins >= openM && mins < closeM) {
            isOpen = true;
            var left = closeM - mins;
            var h12  = p.close.hour > 12 ? p.close.hour - 12 : (p.close.hour || 12);
            var m0   = (p.close.minute || 0).toString().padStart(2, '0');
            closeTime = h12 + ':' + m0 + ' ' + (p.close.hour >= 12 ? 'PM' : 'AM');
            if (left > 0 && left <= 60) closingSoon = true;
          }
        });
        if (isOpen) { badgeClass = closingSoon ? 'closing-soon' : 'open'; badgeText = closingSoon && closeTime ? 'Cierra ' + closeTime : 'Abierto'; }
        else { badgeClass = 'closed'; badgeText = 'Cerrado'; }
      }

      var price = '$'.repeat(Math.min(place.priceLevel || 1, 3));
      var card  = document.createElement('div');
      card.className = 'wps-card';
      card.dataset.idx = idx;
      card.innerHTML =
        (photo ? '<img src="' + photo + '" class="wps-card-photo" alt="' + place.name + '">'
               : '<div class="wps-card-icon">' + icon + '</div>') +
        '<div class="wps-card-body">' +
          '<div class="wps-card-header">' +
            '<span class="wps-card-badge ' + badgeClass + '">' + badgeText + '</span>' +
            '<span class="wps-card-price">' + price + '</span>' +
          '</div>' +
          '<div class="wps-card-name">' + place.name + '</div>' +
          '<div class="wps-card-addr">' + address + (address.length >= 35 ? '...' : '') + '</div>' +
          '<div class="wps-card-rating">' +
            '<span>⭐</span><span class="wps-card-rval">' + rating + '</span><span class="wps-card-rcnt">' + rCount + '</span>' +
          '</div>' +
        '</div>';

      card.addEventListener('click', function(ev) {
        ev.stopPropagation();
        self._onCardClick(parseInt(card.dataset.idx));
      });
      container.appendChild(card);
    });

    document.body.appendChild(container);
    this._positionResults();
    this._syncCategoryChips();
  }

  _onCardClick(idx) {
    var mv = this.mapView;
    if (!mv) return;
    var places = this._getAllPlaces();
    var place  = places[idx];
    if (!place) return;

    // Highlight solo ese marker
    this._highlightSingle(idx);

    // flyTo con zoom suave
    var lat = (place.location && place.location.lat) || place.lat;
    var lng = (place.location && place.location.lng) || place.lng;
    if (lat && lng) {
      mv.getMap().flyTo({ center: [lng, lat], zoom: 17, duration: 400 });
    }

    // Mostrar minicard
    var raw = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;
    mv._showMiniCard(place, idx, raw);
  }

  _hideResults() {
    var r = document.getElementById('wp-sresults');
    if (r) r.remove();
    this._syncCategoryChips();
  }

  // Posicionar minifichas sobre el teclado (visualViewport)
  _positionResults() {
    var r = document.getElementById('wp-sresults');
    if (!r) return;
    var kbH = window.visualViewport ? (window.innerHeight - window.visualViewport.height) : 0;
    r.style.bottom = kbH > 100 ? (kbH + 10) + 'px' : '0px';
  }

  _installViewportListener() {
    var self = this;
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        if (self._active) self._positionResults();
      });
    }
  }

  // ── Highlight pins en el mapa ─────────────────────────────────────

  _highlightMarkers(matches, all) {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    var matched = new Set(matches.map(function(p) { return p.place_id || p.name; }));
    mv.markerEls.forEach(function(el, i) {
      var p   = all[i];
      var key = p && (p.place_id || p.name);
      var hit = matched.has(key);
      el.style.opacity = hit ? '1'    : '0.2';
      el.style.filter  = hit ? 'none' : 'grayscale(1)';
    });
  }

  _highlightSingle(idx) {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    mv.markerEls.forEach(function(el, i) {
      el.style.opacity = i === idx ? '1'    : '0.2';
      el.style.filter  = i === idx ? 'none' : 'grayscale(1)';
    });
  }

  _restoreMarkers() {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    mv.markerEls.forEach(function(el) {
      el.style.opacity = '';
      el.style.filter  = '';
    });
  }

  // ── Chips de categoría ────────────────────────────────────────────

  _showCategoryChips() {
    this._hideCategoryChips();
    var cats = this.getCategories ? this.getCategories() : [];
    if (!cats.length) return;

    var container = document.createElement('div');
    container.id  = 'wp-scats';
    var mv  = this.mapView;
    var cur = mv && mv.currentCatId;
    var self = this;

    cats.forEach(function(cat) {
      var isActive = cat.key === cur;
      var chip = document.createElement('div');
      chip.className = 'wps-cat-chip' + (isActive ? ' active' : '');
      chip.innerHTML = cat.icon3d_url
        ? '<img src="' + cat.icon3d_url + '" style="width:18px;height:18px;object-fit:contain;vertical-align:middle" onerror="this.outerHTML=\'<span>' + (cat.emoji || '') + '</span>\'"><span>' + (cat.label_es || cat.key) + '</span>'
        : '<span>' + (cat.emoji || '') + '</span><span>' + (cat.label_es || cat.key) + '</span>';

      chip.addEventListener('click', function() {
        self._query = '';
        var inp = document.getElementById('wps-input');
        if (inp) inp.value = '';
        var clr = document.getElementById('wps-clear');
        if (clr) clr.classList.remove('visible');
        self._hideResults();
        self._restoreMarkers();
        container.querySelectorAll('.wps-cat-chip').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        if (self.onCategorySelect) self.onCategorySelect(cat.key);
        setTimeout(function() {
          var countEl = document.getElementById('wps-count');
          if (countEl) countEl.textContent = self._getCount();
        }, 700);
      });
      container.appendChild(chip);
    });

    document.body.appendChild(container);
    setTimeout(function() {
      var active = container.querySelector('.wps-cat-chip.active');
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 80);
  }

  _hideCategoryChips() {
    var e = document.getElementById('wp-scats');
    if (!e) return;
    e.style.opacity = '0'; e.style.transform = 'translateY(20px)';
    setTimeout(function() { e.remove(); }, 280);
  }

  _syncCategoryChips() {
    var chips   = document.getElementById('wp-scats');
    var results = document.getElementById('wp-sresults');
    if (!chips) return;
    var hasCards = results && results.querySelector('.wps-card');
    chips.style.opacity       = hasCards ? '0'    : '1';
    chips.style.pointerEvents = hasCards ? 'none' : 'all';
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _getAllPlaces() {
    var mv = this.mapView;
    return (mv && mv.allPlaces && mv.allPlaces.length) ? mv.allPlaces : [];
  }

  _getCount() {
    return this._getAllPlaces().length + ' lugares';
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wps-styles')) return;
    var s = document.createElement('style');
    s.id  = 'wps-styles';
    s.textContent = `
      @keyframes wpsExpand {
        from { opacity:0; transform:scaleX(0.85) translateY(-8px); }
        to   { opacity:1; transform:scaleX(1) translateY(0); }
      }
      @keyframes wpsSlideUp {
        from { opacity:0; transform:translateY(20px); }
        to   { opacity:1; transform:translateY(0); }
      }

      /* ── Overlay bar ── */
      #wp-sbar {
        position:fixed;
        top:calc(12px + env(safe-area-inset-top,0px));
        left:12px; right:12px;
        z-index:99999;
        background:white; border-radius:50px; height:48px;
        display:flex; align-items:center; gap:8px; padding:0 14px;
        box-shadow:0 4px 20px rgba(0,0,0,0.15);
        animation:wpsExpand 0.25s ease;
      }
      .wps-icon { width:20px;height:20px;object-fit:contain;flex-shrink:0; }
      .wps-input {
        flex:1;border:none;background:transparent;outline:none;
        font-size:15px;font-weight:600;color:#111827;min-width:0;
        font-family:'Inter Tight',system-ui,sans-serif;
        -webkit-appearance:none;
      }
      .wps-input::placeholder{color:#9ca3af;font-weight:400;}
      .wps-input::-webkit-search-cancel-button{display:none;}
      .wps-clear {
        display:none;width:28px;height:28px;border-radius:50%;
        border:none;background:rgba(0,0,0,0.08);color:#6b7280;
        font-size:13px;cursor:pointer;align-items:center;justify-content:center;
        flex-shrink:0;-webkit-tap-highlight-color:transparent;
      }
      .wps-clear.visible{display:flex;}
      .wps-count{font-size:11px;font-weight:600;color:#9ca3af;white-space:nowrap;flex-shrink:1;overflow:hidden;text-overflow:ellipsis;max-width:90px;}
      .wps-filter,.wps-close{
        width:32px;min-width:32px;height:32px;border-radius:50%;
        border:none;background:rgba(0,0,0,0.08);color:#6b7280;
        font-size:14px;font-weight:700;cursor:pointer;display:flex;
        align-items:center;justify-content:center;flex-shrink:0;
        -webkit-tap-highlight-color:transparent;transition:background 0.2s;
      }
      .wps-filter:active,.wps-close:active{background:rgba(0,0,0,0.15);}

      /* ── Subcats row en modo búsqueda — sube debajo de la barra ── */
      .panel-subcats-scroll.in-search-mode {
        position:fixed !important;
        top:calc(68px + env(safe-area-inset-top,0px)) !important;
        left:0 !important; right:0 !important;
        bottom:auto !important;
        z-index:99998 !important;
        background:transparent !important;
        width:100% !important;
        box-sizing:border-box !important;
        padding:0 12px !important;
      }

      /* ── Minifichas scroll horizontal ── */
      #wp-sresults {
        position:fixed;
        left:0;right:0;
        z-index:99996;
        display:flex; gap:12px;
        padding:12px 16px calc(16px + env(safe-area-inset-bottom,0px));
        overflow-x:auto;overflow-y:hidden;
        -webkit-overflow-scrolling:touch;
        background:transparent; scrollbar-width:none;
        transition:bottom 0.2s ease;
      }
      #wp-sresults::-webkit-scrollbar{display:none;}

      .wps-card{
        display:flex;align-items:center;gap:10px;padding:10px 14px;
        background:white;border:2px solid #e5e7eb;border-radius:16px;
        box-shadow:0 4px 12px rgba(0,0,0,0.08);cursor:pointer;
        min-width:280px;max-width:300px;flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s,box-shadow 0.15s;
      }
      .wps-card:active{transform:scale(0.97);box-shadow:0 2px 6px rgba(0,0,0,0.1);}
      .wps-card-photo{width:70px;height:70px;object-fit:cover;border-radius:12px;flex-shrink:0;}
      .wps-card-icon{width:70px;height:70px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#8b5cf6,#7c3aed);border-radius:12px;font-size:32px;flex-shrink:0;}
      .wps-card-body{flex:1;min-width:0;}
      .wps-card-header{display:flex;align-items:center;gap:6px;margin-bottom:4px;}
      .wps-card-badge{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;color:white;}
      .wps-card-badge.open{background:#10b981;}
      .wps-card-badge.closing-soon{background:#f59e0b;}
      .wps-card-badge.closed{background:#ef4444;}
      .wps-card-badge.no-hours{background:#6b7280;}
      .wps-card-price{font-size:14px;font-weight:700;color:#1f2937;}
      .wps-card-name{font-size:15px;font-weight:800;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px;font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;}
      .wps-card-addr{font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:4px;}
      .wps-card-rating{display:flex;align-items:center;gap:4px;}
      .wps-card-rval{font-size:13px;font-weight:700;color:#f59e0b;}
      .wps-card-rcnt{font-size:11px;color:#9ca3af;}
      .wps-noresult{display:flex;align-items:center;gap:10px;padding:14px 18px;background:white;border-radius:16px;font-size:14px;color:#6b7280;box-shadow:0 4px 12px rgba(0,0,0,0.08);flex-shrink:0;}

      /* ── Chips de categoría en footer ── */
      #wp-scats{
        position:fixed;
        bottom:calc(16px + env(safe-area-inset-bottom,0px));
        left:0;right:0;z-index:99997;
        display:flex;gap:8px;padding:0 16px;
        overflow-x:auto;scrollbar-width:none;
        animation:wpsSlideUp 0.3s ease;
        transition:opacity 0.25s ease,transform 0.25s ease;
      }
      #wp-scats::-webkit-scrollbar{display:none;}
      .wps-cat-chip{
        display:inline-flex;align-items:center;gap:6px;padding:10px 16px;
        background:white;color:#111827;border:2px solid rgba(0,0,0,0.1);
        border-radius:50px;font-size:14px;font-weight:600;white-space:nowrap;
        cursor:pointer;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,0.1);
        touch-action:manipulation;-webkit-tap-highlight-color:transparent;
        transition:background 0.15s,color 0.15s,border-color 0.15s;
      }
      .wps-cat-chip.active{background:#6366f1;color:white;border-color:#6366f1;}
      .wps-cat-chip:active{opacity:0.85;}
    `;
    document.head.appendChild(s);
  }
}
