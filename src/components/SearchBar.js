// ====================================================================
// WHATSPLAN — src/components/SearchBar.js  (v4)
// ====================================================================

export class SearchBar {
  constructor(opts) {
    this.mapView          = opts.mapView;
    this.getCategories    = opts.getCategories;
    this.onCategorySelect = opts.onCategorySelect;

    this._active          = false;
    this._query           = '';
    this._debounce        = null;
    this._currentMatches  = [];  // matches actuales de búsqueda

    this._injectStyles();
    this._installViewportListener();
    this._hookMiniCardClose();
  }

  // ── API pública ───────────────────────────────────────────────────

  activate() {
    if (this._active) return;
    this._active = true;
    var gsap  = window.gsap;
    var panel = document.getElementById('map-results-panel');

    // Cerrar minicard si hay una abierta
    var mv = this.mapView;
    if (mv && mv.miniCardMarker) {
      mv._closeMiniCard ? mv._closeMiniCard() : (function() {
        var w = mv.miniCardMarker.getElement();
        if (w && w._savedPinHTML !== undefined) {
          w.style.width = '44px'; w.style.height = '44px';
          w.style.overflow = 'visible'; w.style.zIndex = '';
          w.style.marginTop = ''; w.innerHTML = w._savedPinHTML;
          delete w._savedPinHTML;
        }
        mv.miniCardMarker = null; mv.miniCardIndex = -1; mv.miniCardPlace = null;
      })();
    }

    // Topbar NO se oculta — el chip se expande in-place
    // Solo ocultar el panel
    if (panel) {
      panel.style.pointerEvents = 'none';
      if (gsap) gsap.to(panel, { y: 40, opacity: 0, duration: 0.18, ease: 'power2.in',
        onComplete: function() { panel.style.display = 'none'; }
      });
      else { panel.style.display = 'none'; }
    }

    this._moveSubcatsToBody();
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

    // Topbar nunca se ocultó — solo restaurar pointer events
    var topbar = document.getElementById('topbar');
    if (topbar) topbar.style.pointerEvents = '';
    if (panel) {
      panel.style.display = '';
      panel.style.pointerEvents = '';
      if (gsap) gsap.fromTo(panel,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'all' }
      );
      else { panel.style.transform = ''; panel.style.opacity = ''; }
    }

    this._returnSubcatsToPanel();
    this._hideOverlay();
    this._hideResults();
    this._hideCategoryChips();
    this._restoreMarkers();
  }

  isActive() { return this._active; }

  _hookMiniCardClose() {}

  _moveSubcatsToBody() {
    var el = document.getElementById('map-subcategories-footer');
    if (!el) return;
    this._subcatsOriginalParent  = el.parentNode;
    this._subcatsOriginalSibling = el.nextSibling;
    el.classList.add('wps-subcats-floating');
    document.body.appendChild(el);
  }

  _returnSubcatsToPanel() {
    var el = document.getElementById('map-subcategories-footer');
    if (!el || !this._subcatsOriginalParent) return;
    el.classList.remove('wps-subcats-floating');
    if (this._subcatsOriginalSibling) {
      this._subcatsOriginalParent.insertBefore(el, this._subcatsOriginalSibling);
    } else {
      this._subcatsOriginalParent.appendChild(el);
    }
    this._subcatsOriginalParent  = null;
    this._subcatsOriginalSibling = null;
  }

  onMapClick() {
    var mv  = this.mapView;
    var res = document.getElementById('wp-sresults');
    var hasResults = res && res.querySelector('.wps-card');

    if (mv && mv.miniCardMarker) {
      var wrapper = mv.miniCardMarker.getElement();
      mv.miniCardMarker    = null;
      mv.miniCardIndex     = -1;
      mv.miniCardPlace     = null;
      mv._miniCardPinRoot  = null;
      mv._miniCardMarkerEl = null;
      if (wrapper && wrapper._savedPinHTML !== undefined) {
        wrapper.style.width     = '44px';
        wrapper.style.height    = '44px';
        wrapper.style.overflow  = 'visible';
        wrapper.style.zIndex    = '';
        wrapper.style.marginTop = '';
        wrapper.innerHTML = wrapper._savedPinHTML;
        delete wrapper._savedPinHTML;
        var z = mv.map ? mv.map.getZoom() : 0;
        wrapper.querySelectorAll('.place-act-badge').forEach(function(b) {
          b.style.opacity = z >= 15 ? '1' : '0';
        });
      }
    }

    if (hasResults) {
      this._hideResults();
    }
  }

  // ── Overlay ───────────────────────────────────────────────────────

  _showOverlay() {
    var self  = this;
    var count = this._getCount();
    var gsap  = window.gsap;

    var actBtn    = document.getElementById('topbar-activity-btn');
    var chip      = document.getElementById('topbar-right-chip');
    var searchBtn = document.getElementById('topbar-search-btn');
    var msgBtn    = document.getElementById('topbar-messages-btn');
    var authBtn   = document.getElementById('topbar-auth-btn');

    // ── PASO 0: Fijar chip PRIMERO antes de tocar cualquier otro elemento ──
    var chipRect  = chip ? chip.getBoundingClientRect() : null;
    var chipInitW = chipRect ? chipRect.width : 120;
    this._chipInitW = chipInitW;
    var targetW   = window.innerWidth - 24;

    if (chip && chipRect) {
      chip.style.position = 'fixed';
      chip.style.top      = chipRect.top + 'px';
      chip.style.right    = (window.innerWidth - chipRect.right) + 'px';
      chip.style.left     = 'auto';
      chip.style.width    = chipInitW + 'px';
      chip.style.zIndex   = '99999';
    }

    // ── PASO 1: Ahora sí ocultar actBtn — el chip ya está fijo, no se moverá ──
    if (actBtn) {
      // Quitar TODA transición CSS antes de manipular
      actBtn.style.transition = 'none';
      actBtn.style.transform  = 'none';
      actBtn.getBoundingClientRect(); // reflow
      actBtn.style.opacity = '0';
      setTimeout(function() { actBtn.style.display = 'none'; }, 16);
    }

    // ── PASO 2: Ocultar msg/avatar ──
    if (msgBtn)    { msgBtn.dataset.wpHidden  = '1'; msgBtn.style.display  = 'none'; }
    if (authBtn)   { authBtn.dataset.wpHidden = '1'; authBtn.style.display = 'none'; }
    if (searchBtn) searchBtn.style.display = 'none';

    // ── PASO 3: Inyectar contenido ──
    var inner = document.createElement('div');
    inner.id  = 'wps-inner';
    inner.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;opacity:0;';
    inner.innerHTML =
      '<img class="wps-icon" style="width:20px;height:20px;object-fit:contain;flex-shrink:0" ' +
      'src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Magnifying%20glass%20tilted%20right/3D/magnifying_glass_tilted_right_3d.png">' +
      '<input id="wps-input" class="wps-input" type="search" placeholder="Buscar un lugar" ' +
      'autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" readonly>' +
      '<button id="wps-clear" class="wps-clear" aria-label="Limpiar">' +
        '<svg viewBox="0 0 14 14" width="10" height="10" fill="white">' +
          '<path d="M1 1l12 12M13 1L1 13" stroke="white" stroke-width="2.5" stroke-linecap="round"/>' +
        '</svg></button>' +
      '<span id="wps-count" class="wps-count">' + count + '</span>';

    var filterBtn = document.createElement('button');
    filterBtn.id = 'wps-filter-chip';
    filterBtn.className = 'topbar-icon-btn';
    filterBtn.style.cssText = 'opacity:0;transform:scale(0.3);flex-shrink:0;';
    filterBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="#374151"><path d="M5.786 3C4.247 3 3 4.247 3 5.786c0 .807.289 1.588.814 2.2l2.834 3.307C7.736 12.561 8.333 14.177 8.333 15.848V18c0 1.657 1.343 3 3 3h1.334c1.657 0 3-1.343 3-3v-2.152c0-1.671.597-3.287 1.685-4.562l2.834-3.307A3.786 3.786 0 0021 5.786C21 4.247 19.753 3 18.214 3H5.786z"/></svg>';

    var closeBtn = document.createElement('button');
    closeBtn.id = 'wps-close-chip';
    closeBtn.className = 'topbar-icon-btn';
    closeBtn.style.cssText = 'opacity:0;transform:scale(0.3);flex-shrink:0;font-size:15px;font-weight:700;color:#374151;';
    closeBtn.textContent = '✕';

    if (chip) {
      chip.insertBefore(inner, chip.firstChild);
      chip.appendChild(filterBtn);
      chip.appendChild(closeBtn);
    }

    // ── PASO 4: Animar expansión ──
    if (chip && gsap) {
      gsap.timeline()
        .to(chip,      { width: targetW, duration: 0.2,  ease: 'expo.out' })
        .to(inner,     { opacity: 1,     duration: 0.12, ease: 'power1.out' }, '-=0.08')
        .to(filterBtn, { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(3)' }, '-=0.04')
        .to(closeBtn,  { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(3)',
          onComplete: function() {
            var inp = document.getElementById('wps-input');
            if (inp) { inp.removeAttribute('readonly'); inp.focus(); }
          }
        }, '-=0.1');
    } else if (chip) {
      chip.style.width = targetW + 'px';
      inner.style.opacity = '1';
      filterBtn.style.opacity = '1'; filterBtn.style.transform = '';
      closeBtn.style.opacity  = '1'; closeBtn.style.transform  = '';
    }

    // ── PASO 5: Eventos ──
    setTimeout(function() {
      var input      = document.getElementById('wps-input');
      var clearBtnEl = document.getElementById('wps-clear');
      var filterEl   = document.getElementById('wps-filter-chip');
      var closeEl    = document.getElementById('wps-close-chip');
      if (!input) return;

      input.addEventListener('input', function(ev) {
        if (clearBtnEl) clearBtnEl.classList.toggle('visible', input.value.length > 0);
        self._onInput(ev.target.value);
      });
      input.addEventListener('search', function() {
        if (clearBtnEl) clearBtnEl.classList.toggle('visible', input.value.length > 0);
        self._onInput(input.value);
      });
      input.addEventListener('keydown', function(ev) { if (ev.key === 'Escape') self.deactivate(); });
      if (clearBtnEl) {
        clearBtnEl.addEventListener('click', function(ev) {
          ev.stopPropagation(); input.value = ''; clearBtnEl.classList.remove('visible');
          input.focus(); self._onInput('');
        });
      }
      if (closeEl)  closeEl.addEventListener('click',  function(ev){ ev.stopPropagation(); self.deactivate(); });
      if (filterEl) filterEl.addEventListener('click', function(ev){ ev.stopPropagation(); console.log('Filtros próximamente'); });

      self._mapClick = function(ev) {
        var ch  = document.getElementById('topbar-right-chip');
        var res = document.getElementById('wp-sresults');
        if (ch  && ch.contains(ev.target)) return;
        if (res && res.contains(ev.target)) return;
        input.blur();
      };
      document.addEventListener('click', self._mapClick);
    }, 300);
  }

  _hideOverlay() {
    var gsap      = window.gsap;
    var chip      = document.getElementById('topbar-right-chip');
    var actBtn    = document.getElementById('topbar-activity-btn');
    var msgBtn    = document.getElementById('topbar-messages-btn');
    var authBtn   = document.getElementById('topbar-auth-btn');
    var searchBtn = document.getElementById('topbar-search-btn');
    var inner     = document.getElementById('wps-inner');
    var filterEl  = document.getElementById('wps-filter-chip');
    var closeEl   = document.getElementById('wps-close-chip');

    var restoreAll = function() {
      if (inner)    inner.remove();
      if (filterEl) filterEl.remove();
      if (closeEl)  closeEl.remove();
      if (chip) {
        chip.style.position = ''; chip.style.top    = '';
        chip.style.right    = ''; chip.style.left   = '';
        chip.style.width    = ''; chip.style.zIndex = '';
      }
      if (searchBtn) searchBtn.style.display = '';
      if (msgBtn  && msgBtn.dataset.wpHidden)  { msgBtn.style.display  = ''; delete msgBtn.dataset.wpHidden; }
      if (authBtn && authBtn.dataset.wpHidden) { authBtn.style.display = ''; delete authBtn.dataset.wpHidden; }
      // +Actividad: restore display, sin transform
      if (actBtn) {
        if (gsap) gsap.killTweensOf(actBtn);
        actBtn.style.transition = 'none';
        actBtn.style.opacity    = '0';
        actBtn.style.transform  = 'none';
        actBtn.style.display    = '';
        actBtn.getBoundingClientRect();
        actBtn.style.transition = 'opacity 0.2s';
        actBtn.style.opacity    = '';
        setTimeout(function() {
          actBtn.style.transition = '';
          actBtn.style.transform  = '';
        }, 220);
      }
    };

    if (chip && gsap) {
      gsap.timeline()
        .to([filterEl, closeEl].filter(Boolean), { opacity: 0, scale: 0.3, duration: 0.16, ease: 'back.in(3)', stagger: 0.04 })
        .to(inner, { opacity: 0, duration: 0.1, ease: 'power1.in' }, '-=0.08')
        .to(chip,  { width: (this._chipInitW || 120) + 'px', duration: 0.2, ease: 'expo.out', onComplete: restoreAll }, '-=0.06');
    } else {
      restoreAll();
    }

    if (this._mapClick) { document.removeEventListener('click', this._mapClick); this._mapClick = null; }
  }


  // ── Input ─────────────────────────────────────────────────────────

  _onInput(value) {
    this._query = value.toLowerCase().trim();
    clearTimeout(this._debounce);
    var countEl = document.getElementById('wps-count');

    if (this._query.length === 0) {
      this._currentMatches = [];
      this._hideResults();
      this._restoreMarkers();
      if (countEl) countEl.textContent = this._getCount();
      return;
    }

    var self = this;
    this._debounce = setTimeout(function() {
      var all     = self._getAllPlaces();
      var matches = all.filter(function(p) {
        var name = (p.name || p.place_name || p.displayName || '').toLowerCase();
        var addr = (p.formattedAddress || p.formatted_address || p.vicinity || '').toLowerCase();
        return name.includes(self._query) || addr.includes(self._query);
      });

      var label = matches.length + ' resultado' + (matches.length !== 1 ? 's' : '');
      if (countEl) countEl.textContent = label;

      self._currentMatches = matches;
      self._highlightMarkers(matches);
      self._renderResults(matches);
    }, 200);
  }

  // ── Minifichas ────────────────────────────────────────────────────

  _renderResults(places) {
    this._hideResults();
    var container = document.createElement('div');
    container.id  = 'wp-sresults';

    if (places.length === 0) {
      container.classList.add('wps-results-noresult-mode');
      container.innerHTML =
        '<div class="wps-noresult">' +
          '<span class="wps-noresult-emoji">🥺</span>' +
          '<span class="wps-noresult-text">No se encontraron resultados</span>' +
        '</div>';
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

    var gsap = window.gsap;
    if (mv.miniCardMarker) {
      var oldWrapper = mv.miniCardMarker.getElement();
      var oldCard = oldWrapper && oldWrapper.querySelector('.minicard-marker-content');
      if (gsap && oldCard) gsap.killTweensOf(oldCard);
      mv.miniCardMarker    = null;
      mv.miniCardIndex     = -1;
      mv.miniCardPlace     = null;
      mv._miniCardPinRoot  = null;
      mv._miniCardMarkerEl = null;
      if (oldWrapper && oldWrapper._savedPinHTML !== undefined) {
        oldWrapper.style.cssText = '';
        oldWrapper.style.width    = '44px';
        oldWrapper.style.height   = '44px';
        oldWrapper.style.overflow = 'visible';
        oldWrapper.innerHTML      = oldWrapper._savedPinHTML;
        delete oldWrapper._savedPinHTML;
      }
    }

    this._highlightSingle(place);

    var lat = (place.location && place.location.lat) || place.lat;
    var lng = (place.location && place.location.lng) || place.lng;
    if (lat && lng) {
      var map = mv.getMap();
      var vv  = window.visualViewport;
      // Detectar teclado usando flag global — funciona en Capacitor donde
      // el teclado cierra antes de que JS capture el tap
      var vvHeightAtTap = vv ? vv.height : window.innerHeight;
      var canvasAtTap   = map.getCanvas().clientHeight;
      var kbH = Math.max(
        Math.max(0, canvasAtTap - vvHeightAtTap), // Chrome/WebView
        window._wpKeyboardWasOpen ? 200 : 0        // Capacitor flag
      );

      var raw = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;

      var doFlyTo = function() {
        var vvNow   = window.visualViewport;
        var canvasH = map.getCanvas().clientHeight;
        var topbar  = document.getElementById('topbar-right-chip');
        var topEdge = topbar ? topbar.getBoundingClientRect().bottom + 8 : 68;
        // Usar vv.height actual (teclado ya cerrado en este punto)
        var vvH      = vvNow ? vvNow.height : canvasH;
        var visibleH = Math.min(vvH, canvasH);
        // Bot edge: chips de subcategorías o resultados si están visibles
        var scats    = document.getElementById('wp-scats');
        var results  = document.getElementById('wp-sresults');
        var botEl    = (scats && scats.offsetParent !== null) ? scats :
                       (results && results.offsetParent !== null) ? results : null;
        var botEdge  = botEl
          ? botEl.getBoundingClientRect().top - 8
          : visibleH;
        // Nunca menor a la mitad del área visible
        botEdge = Math.max(botEdge, visibleH * 0.5);
        var areaCenter = topEdge + (botEdge - topEdge) / 2;
        // +45: minicard aparece 45px ENCIMA del pin (igual que MapView)
        var offsetY    = Math.round(areaCenter + 45 - canvasH / 2);
        mv._showMiniCard(place, idx, raw);
        map.flyTo({ center: [lng, lat], zoom: 17, duration: 400, offset: [0, offsetY] });
      };

      if (kbH > 50) {
        var inp = document.getElementById('wps-input');
        if (inp) inp.blur();
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        // Esperar cierre del teclado — detectar via innerHeight (WebView) o vv resize (Chrome)
        var refInnerH = window.innerHeight;
        var waited    = 0;
        var kbClosePoll = setInterval(function() {
          waited += 30;
          var vvNow  = window.visualViewport;
          var kbNow  = vvNow ? Math.max(0, window.innerHeight - vvNow.height) : 0;
          var grew   = window.innerHeight > refInnerH + 30; // WebView: innerHeight crece
          if (kbNow < 100 || grew || waited > 700) {
            clearInterval(kbClosePoll);
            // Delay extra para que el layout se estabilice
            setTimeout(doFlyTo, 80);
          }
        }, 30);
      } else {
        requestAnimationFrame(doFlyTo);
      }
    }
  }

  _hideResults() {
    var r = document.getElementById('wp-sresults');
    if (r) r.remove();
    this._syncCategoryChips();
  }

  _positionResults() {
    var kbH = window.visualViewport ? (window.innerHeight - window.visualViewport.height) : 0;

    // Mover minifichas arriba del teclado
    var r = document.getElementById('wp-sresults');
    if (r) {
      var isNoResult = r.classList.contains('wps-results-noresult-mode');
      if (isNoResult) {
        r.style.display = kbH > 100 ? 'flex' : 'none';
      } else {
        r.style.display = '';
      }
      r.style.bottom = kbH > 100 ? (kbH + 10) + 'px' : '0px';
    }

    // Mover chips de categoría arriba del teclado también
    var chips = document.getElementById('wp-scats');
    if (chips) {
      chips.style.bottom = kbH > 100
        ? (kbH + 10) + 'px'
        : 'calc(16px + env(safe-area-inset-bottom,0px))';
    }
  }

  _installViewportListener() {
    var self = this;

    // Detectar apertura del teclado globalmente — cerrar minicard inmediatamente
    var lastKbH = 0;
    var closeMiniCardNow = function() {
      var mv = self.mapView;
      if (!mv) return;
      // Intentar _closeMiniCard primero
      if (typeof mv._closeMiniCard === 'function') {
        mv._closeMiniCard();
        return;
      }
      // Fallback manual
      if (mv.miniCardMarker) {
        var w = mv.miniCardMarker.getElement();
        if (w && w._savedPinHTML !== undefined) {
          w.style.width    = '44px';
          w.style.height   = '44px';
          w.style.overflow = 'visible';
          w.style.zIndex   = '';
          w.style.marginTop = '';
          w.innerHTML = w._savedPinHTML;
          delete w._savedPinHTML;
        }
        mv.miniCardMarker = null;
        mv.miniCardIndex  = -1;
        mv.miniCardPlace  = null;
        mv._miniCardPinRoot  = null;
        mv._miniCardMarkerEl = null;
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        var kbH = window.innerHeight - window.visualViewport.height;
        // Teclado se abrió (kbH creció > 100) — cerrar minicard
        if (kbH > 100 && lastKbH <= 100) {
          closeMiniCardNow();
        }
        lastKbH = kbH;
        if (self._active) self._positionResults();
      });
    }
    // Actualizar count cuando MapView carga nuevos lugares
    document.addEventListener('wp:placesloaded', function(e) {
      if (!self._active) return;
      var countEl = document.getElementById('wps-count');
      if (countEl && self._query.length === 0) {
        countEl.textContent = (e.detail.count) + ' lugares';
      }
    });
  }

  // ── Highlight pins ─────────────────────────────────────────────────

  _highlightMarkers(matches) {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;

    // Debug — ver qué keys hay en matches vs markers
    var matchKeys = matches.map(function(p) { return p.place_id || p.placeId || p.name; });
    var matched   = new Set(matchKeys);

    // Loggear primer match y primer marker para comparar
    if (matches.length > 0) {
      var firstMatch = matches[0];
      console.log('🔍 HIGHLIGHT DEBUG — primer match:', {
        place_id:  firstMatch.place_id,
        placeId:   firstMatch.placeId,
        name:      firstMatch.name,
        key_usado: firstMatch.place_id || firstMatch.placeId || firstMatch.name
      });
    }
    if (mv.markerEls.length > 0) {
      var firstEl = mv.markerEls[0];
      var firstP  = firstEl._place;
      console.log('🗺️ HIGHLIGHT DEBUG — primer marker._place:', {
        place_id: firstP && firstP.place_id,
        placeId:  firstP && firstP.placeId,
        name:     firstP && firstP.name,
        key_usado: firstP && (firstP.place_id || firstP.placeId || firstP.name)
      });
      console.log('matched Set tiene', matched.size, 'items, markerEls:', mv.markerEls.length);
    }

    var hitCount = 0;
    mv.markerEls.forEach(function(el) {
      var p   = el._place;
      var key = p && (p.place_id || p.placeId || p.name);
      var hit = matched.has(key);
      if (hit) hitCount++;
      // Aplicar al .maplibregl-marker (padre) que es lo que MapLibre controla
      var marker = el.closest('.maplibregl-marker') || el.parentElement || el;
      marker.style.opacity   = hit ? '1'    : '0.15';
      marker.style.filter    = hit ? 'none' : 'grayscale(1)';
      marker.style.transform = marker.style.transform || '';
      marker.style.zIndex    = hit ? '2' : '1';
    });
  }

  _highlightSingle(place) {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    var selectedKey = place && (place.place_id || place.placeId || place.name);
    var matched     = new Set(this._currentMatches.map(function(p) {
      return p.place_id || p.placeId || p.name;
    }));

    mv.markerEls.forEach(function(el) {
      var p   = el._place;
      var key = p && (p.place_id || p.placeId || p.name);
      var isMatch    = matched.has(key);
      var isSelected = key === selectedKey;

      var wrapper = el.querySelector('.place-pin-wrapper') || el.querySelector('.pin-dot');
      if (isSelected) {
        el.style.opacity   = '1';
        el.style.filter    = 'none';
        el.style.transform = 'scale(1.25)';
        el.style.zIndex    = '9999';
        if (wrapper) wrapper.classList.add('pin-iridescent');
      } else if (isMatch) {
        el.style.opacity   = '1';
        el.style.filter    = 'none';
        el.style.transform = '';
        el.style.zIndex    = '';
        if (wrapper) wrapper.classList.remove('pin-iridescent');
      } else {
        el.style.opacity   = '0.2';
        el.style.filter    = 'grayscale(1)';
        el.style.transform = '';
        el.style.zIndex    = '';
        if (wrapper) wrapper.classList.remove('pin-iridescent');
      }
    });
  }

  _restoreMarkers() {
    var mv = this.mapView;
    if (!mv || !mv.markerEls) return;
    mv.markerEls.forEach(function(el) {
      var marker = el.closest('.maplibregl-marker') || el.parentElement || el;
      // Usar removeProperty para limpiar cualquier valor incluyendo !important
      marker.style.removeProperty('opacity');
      marker.style.removeProperty('filter');
      marker.style.removeProperty('z-index');
      marker.style.opacity = '';
      marker.style.filter  = '';
      marker.style.zIndex  = '';
      el.style.removeProperty('opacity');
      el.style.removeProperty('filter');
      el.style.opacity   = '';
      el.style.filter    = '';
      el.style.transform = '';
      el.style.zIndex    = '';
      var wrapper = el.querySelector('.place-pin-wrapper') || el.querySelector('.pin-dot');
      if (wrapper) wrapper.classList.remove('pin-iridescent');
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
        self._hideResults();
        self._restoreMarkers();
        container.querySelectorAll('.wps-cat-chip').forEach(function(c) { c.classList.remove('active'); });
        chip.classList.add('active');
        if (self.onCategorySelect) self.onCategorySelect(cat.key);
        // El count se actualiza via evento wp:placesloaded cuando MapView termina de cargar
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

      /* Chip derecho expandible en modo búsqueda */
      #topbar-right-chip { transition: width 0.38s cubic-bezier(0.32,0.72,0,1); overflow:hidden; }
      #wps-inner { display:flex; align-items:center; gap:6px; flex:1; min-width:0; }
      .wps-close-chip-btn { color:#374151; }
      .wps-icon { width:20px;height:20px;object-fit:contain;flex-shrink:0; }

      /* Input con clear nativo del browser — sin -webkit-appearance:none */
      .wps-input {
        flex:1;border:none;background:transparent;outline:none;
        font-size:15px;font-weight:600;color:#111827;min-width:0;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
      }
      .wps-input::placeholder{color:#9ca3af;font-weight:400;font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;}

      .wps-clear {
        display:none;
        width:18px; height:18px;
        border-radius:50%;
        border:none;
        background:#adb5bd;
        color:white;
        font-size:10px;
        font-weight:900;
        cursor:pointer;
        align-items:center;
        justify-content:center;
        flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
        padding:0;
        line-height:1;
        font-family:system-ui,sans-serif;
      }
      .wps-clear.visible { display:flex; }
      .wps-count{font-size:11px;font-weight:600;color:#9ca3af;white-space:nowrap;flex-shrink:1;overflow:hidden;text-overflow:ellipsis;max-width:90px;}
      .wps-filter,.wps-close{
        width:32px;min-width:32px;height:32px;border-radius:50%;
        border:none;background:rgba(0,0,0,0.08);color:#6b7280;
        font-size:14px;font-weight:700;cursor:pointer;display:flex;
        align-items:center;justify-content:center;flex-shrink:0;
        -webkit-tap-highlight-color:transparent;transition:background 0.2s;
      }
      .wps-filter:active,.wps-close:active{background:rgba(0,0,0,0.15);}

      .panel-subcats-scroll.wps-subcats-floating {
        position:fixed;
        top:calc(68px + env(safe-area-inset-top,0px));
        left:0; right:0; bottom:auto;
        z-index:99998;
        background:transparent;
        width:100%; box-sizing:border-box;
        padding:4px 12px; min-height:42px;
        display:flex; align-items:center;
        overflow-x:auto; scrollbar-width:none;
      }
      .panel-subcats-scroll.wps-subcats-floating::-webkit-scrollbar { display:none; }

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
      .wps-card-icon{width:70px;height:70px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--wp-blue),var(--wp-blue-dark));border-radius:12px;font-size:32px;flex-shrink:0;}
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

      .wps-results-noresult-mode { justify-content:center !important; }
      .wps-noresult {
        display:flex; align-items:center; gap:10px;
        padding:14px 18px; background:white;
        border:2px solid #e5e7eb; border-radius:16px;
        box-shadow:0 4px 12px rgba(0,0,0,0.08);
        min-width:280px; max-width:300px; flex-shrink:0;
      }
      .wps-noresult-emoji { font-size:24px; }
      .wps-noresult-text  { font-size:14px; font-weight:600; color:#6b7280; }

      #wp-scats{
        position:fixed;
        bottom:calc(20px + env(safe-area-inset-bottom,0px));
        left:0;right:0;z-index:99999;
        display:flex;gap:8px;
        padding:0 16px 6px;
        overflow-x:auto;
        overflow-y:visible;
        scrollbar-width:none;
        animation:wpsSlideUp 0.3s ease;
        transition:opacity 0.25s ease,transform 0.25s ease;
        pointer-events:all;
      }
      #wp-scats::-webkit-scrollbar{display:none;}
      .wps-cat-chip{
        display:inline-flex;align-items:center;gap:6px;
        padding:8px 14px;
        background:white;
        color:#374151;
        border:none;
        border-radius:50px;
        font-size:13px;font-weight:700;white-space:nowrap;
        cursor:pointer;flex-shrink:0;
        box-shadow:none;
        touch-action:manipulation;-webkit-tap-highlight-color:transparent;
        transition:all 0.15s ease;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
      }
      .wps-cat-chip.active{
        background:var(--wp-blue, #2563eb);
        color:white;
        box-shadow:0 4px 0 #1a4dbf;
      }
      .wps-cat-chip:active{
        transform:translateY(3px);
        box-shadow:0 1px 0 #1a4dbf;
      }
      .wps-cat-chip:active{
        transform:translateY(2px);
        box-shadow:0 2px 0 #1a4dbf;
      }
    `;
    document.head.appendChild(s);
  }
}
