import { photoSmall } from '/src/utils/photo-url.js';
import { addDragStrip } from '/src/components/place-plans/drag-strip.js';
import { wave } from '/src/components/place-plans/wave.js';
import { typeLabel } from '/src/components/map/label-declutter.js';
// ===================================================================
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

    document.body.classList.add('wp-search-active');
    // Ocultar footer menu, panel lateral y mini snap
    var footer = document.getElementById('wp-footer-menu');
    if (footer) { footer.style.transition='transform 0.22s ease,opacity 0.22s ease'; footer.style.transform='translateY(120%)'; footer.style.opacity='0'; footer.style.pointerEvents='none'; }
    ['wp-side-panel-top','wp-side-panel-bottom'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.transition='opacity 0.2s ease';el.style.opacity='0';el.style.pointerEvents='none';}});
    // Ocultar mini snap completamente — nunca visible en search
    var ms = document.getElementById('wp-minisnap-panel');
    if (ms) {
      ms._searchHidden = true;
      ms.style.transition    = 'none';
      ms.style.opacity       = '0';
      ms.style.visibility    = 'hidden';
      ms.style.pointerEvents = 'none';
    }

    // Mapa NO se toca - pines completamente independientes
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
    document.body.classList.remove('wp-search-active');
    // Restaurar footer menu y panel lateral
    var footer = document.getElementById('wp-footer-menu');
    if (footer) { footer.style.transition='transform 0.3s cubic-bezier(0.34,1.2,0.64,1),opacity 0.28s ease'; footer.style.transform=''; footer.style.opacity='1'; footer.style.pointerEvents=''; }
    ['wp-side-panel-top','wp-side-panel-bottom'].forEach(function(id){var el=document.getElementById(id);if(el){el.style.transition='opacity 0.28s ease';el.style.opacity='1';el.style.pointerEvents='';}});
    // Restaurar mini snap si estaba visible antes del search
    var ms = document.getElementById('wp-minisnap-panel');
    if (ms) {
      // pointerEvents se restaura SIEMPRE que el panel exista, sin
      // depender de _searchHidden — esa bandera solo queda bien puesta
      // si el panel YA existía en el momento exacto de activate(); si
      // no, deactivate() nunca la restauraba y el panel quedaba
      // visible pero sin poder tocarse. _showMiniSnap() en
      // PlaceModal2.js también se defiende de esto por su cuenta al
      // mostrar, pero conviene arreglarlo acá también.
      ms.style.pointerEvents = '';
    }
    if (ms && ms._searchHidden) {
      ms._searchHidden = false;
      ms.style.visibility    = 'visible';
      ms.style.pointerEvents = '';
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        ms.style.transition = 'opacity 0.28s ease';
        ms.style.opacity    = '1';
      }); });
    }
    // Resetear posición de chips
    this._updateChipsPosition();

    // Pines independientes - NO se restauran al desactivar
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

    // ── PASO 0: Limpiar cualquier estilo residual del chip (de sesión anterior
    //    o del PlaceModal que pudo dejar el topbar en medio de una animación) ──
    var topbarEl = document.getElementById('topbar');
    if (topbarEl && window.gsap) { window.gsap.killTweensOf(topbarEl); }
    if (chip) {
      // Asegurar que el chip está en su posición natural antes de leer rect
      chip.style.cssText = '';
      void chip.getBoundingClientRect(); // reflow
    }
    if (topbarEl) {
      // Asegurar que el topbar no tiene transform residual de la animación GSAP
      topbarEl.style.transform = '';
      topbarEl.style.opacity   = '1';
      topbarEl.style.scale     = '';
      void topbarEl.getBoundingClientRect(); // reflow
    }

    // ── PASO 0b: Fijar chip PRIMERO antes de tocar cualquier otro elemento ──
    var chipRect  = chip ? chip.getBoundingClientRect() : null;
    var chipInitW = chipRect ? chipRect.width : 120;
    this._chipInitW = chipInitW;
    var targetW   = window.innerWidth - 24;

    // Cache topEdge AQUÍ — antes del teclado, antes de la animación del chip.
    // doFlyTo usa este valor fijo sin re-medirlo, evitando la distorsión del teclado.
    this._cachedTopEdge = chipRect ? chipRect.bottom + 8 : 120;

    var chipRight = chipRect ? (window.innerWidth - chipRect.right) : 12;
    this._chipRight = chipRight;
    var avatarEl  = document.getElementById('topbar-auth-btn');
    var avRect    = avatarEl ? avatarEl.getBoundingClientRect() : null;
    var targetW   = avRect ? (window.innerWidth - avRect.left - chipRight) : (window.innerWidth - 24);
    this._targetW = targetW;
    if (chip && chipRect) {
      var stableTop = topbarEl
        ? topbarEl.getBoundingClientRect().top + (topbarEl.getBoundingClientRect().height - 44) / 2
        : chipRect.top;
      chip.style.position    = 'fixed';
      chip.style.top         = stableTop + 'px';
      chip.style.right       = chipRight + 'px';
      chip.style.left        = 'auto';
      chip.style.width       = chipInitW + 'px';
      chip.style.zIndex      = '1999';
      chip.style.paddingLeft = '12px';
      chip.style.paddingRight= '2px';
      chip.style.height      = '44px';
      this._chipHTML = chip.innerHTML;
      chip.innerHTML = '';
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
    if (authBtn)   { authBtn.dataset.wpHidden = '1'; authBtn.style.visibility = 'hidden'; authBtn.style.pointerEvents = 'none'; }
    // Notif NUNCA se oculta
    if (searchBtn) searchBtn.style.display = 'none';

    // ── PASO 3: Inyectar contenido ──
    var inner = document.createElement('div');
    inner.id  = 'wps-inner';
    inner.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;opacity:0;';
    inner.innerHTML =
      '<img class="wps-icon" style="width:20px;height:20px;object-fit:contain;flex-shrink:0" ' +
      'src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Magnifying%20glass%20tilted%20right/3D/magnifying_glass_tilted_right_3d.png">' +
      '<input id="wps-input" class="wps-input" type="text" placeholder="..." ' +
      'autocomplete="new-password" autocorrect="off" autocapitalize="sentences" spellcheck="false" readonly>' +
      '<button id="wps-clear" class="wps-clear" aria-label="Limpiar">' +
        '<svg viewBox="0 0 14 14" width="9" height="9" fill="none">' +
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
        .to(chip,      { width: self._targetW || targetW, duration: 0.2, ease: 'expo.out' })
        .to(inner,     { opacity: 1,     duration: 0.12, ease: 'power1.out' }, '-=0.08')
        .to(filterBtn, { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(3)' }, '-=0.04')
        .to(closeBtn,  { opacity: 1, scale: 1, duration: 0.16, ease: 'back.out(3)',
          onComplete: function() {
            var inp = document.getElementById('wps-input');
            if (inp) { inp.removeAttribute('readonly'); inp.focus(); }
          }
        }, '-=0.1');
    } else if (chip) {
      chip.style.width = (self._targetW || targetW) + 'px';
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
        var v = ev.target.value;
        if (v.length === 1) { v = v.charAt(0).toUpperCase() + v.slice(1); input.value = v; }
        if (clearBtnEl) clearBtnEl.classList.toggle('visible', v.length > 0);
        self._onInput(v);
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

    var self2 = this;
    var self2 = this;
    var restoreAll = function() {
      if (inner)    inner.remove();
      if (filterEl) filterEl.remove();
      if (closeEl)  closeEl.remove();
      if (chip) {
        chip.style.cssText = '';
        if (self2._chipHTML !== undefined) { chip.innerHTML = self2._chipHTML; self2._chipHTML = undefined; }
      }
      if (searchBtn) searchBtn.style.display = '';
      if (msgBtn && msgBtn.dataset.wpHidden) { msgBtn.style.display=''; delete msgBtn.dataset.wpHidden; }
      // Avatar - restauración instantánea, sin GSAP ni transforms
      if (authBtn && authBtn.dataset.wpHidden) {
        delete authBtn.dataset.wpHidden;
        if (gsap) gsap.killTweensOf(authBtn);
        // Solo cambiar visibility - NADA MAS
        authBtn.style.visibility = '';
        authBtn.style.pointerEvents = '';
      }
      // Notif no se ocultó, no hay que restaurar
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
      // Pines INDEPENDIENTES - no se tocan al cerrar barra
    };

    if (chip && gsap) {
      gsap.timeline()
        .to([filterEl, closeEl].filter(Boolean), { opacity: 0, scale: 0.3, duration: 0.16, ease: 'back.in(3)', stagger: 0.04 })
        .to(inner, { opacity: 0, duration: 0.1, ease: 'power1.in' }, '-=0.08')
        .to(chip,  { width: (this._chipInitW || 120) + 'px', right: (this._chipRight || 12), duration: 0.2, ease: 'expo.out', onComplete: restoreAll }, '-=0.06');
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
          '<span class="wps-noresult-text"><b>Nada por aquí</b><small>Prueba con otra palabra o categoría</small></span>' +
        '</div>';
      document.body.appendChild(container);
      this._positionResults();
      this._syncCategoryChips();
      return;
    }

    var self      = this;
    var allPlaces = this._getAllPlaces();
    // Las tarjetas van en una tira con nuestro arrastre y rebote (drag-strip)
    var track = document.createElement('div');
    track.className = 'wps-track';
    container.appendChild(track);

    places.slice(0, 20).forEach(function(place) {
      var idx   = allPlaces.indexOf(place);
      var raw   = place.photoUrl || place.photo_url || (place.photosUrls && place.photosUrls[0]) || null;
      var photo = raw ? photoSmall(raw) : null; // miniatura si existe; Supabase directo
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
        if (isOpen) { badgeClass = closingSoon ? 'closing-soon' : 'open'; badgeText = closingSoon && closeTime ? 'Cierra ' + closeTime.toLowerCase() : 'Abierto'; }
        else { badgeClass = 'closed'; badgeText = 'Cerrado'; }
      }

      var price = place.priceLevel ? '$'.repeat(Math.min(place.priceLevel, 3)) : '';
      var kind  = typeLabel(place);
      var card  = document.createElement('div');
      card.className = 'wps-card';
      card.dataset.idx = idx;
      card.innerHTML =
        (photo ? '<img src="' + photo + '" class="wps-card-photo" alt="' + place.name + '">'
               : '<div class="wps-card-icon">' + icon + '</div>') +
        '<div class="wps-card-body">' +
          '<div class="wps-card-name">' + place.name + '</div>' +
          '<div class="wps-card-addr">' + (kind ? kind + ' · ' : '') + address + (address.length >= 35 ? '…' : '') + '</div>' +
          '<div class="wps-card-header">' +
            (badgeClass !== 'no-hours' ? '<span class="wps-card-badge ' + badgeClass + '">' + badgeText + '</span>' : '') +
            (rating ? '<span class="wps-card-rating"><span class="wps-card-star">★</span><span class="wps-card-rval">' + rating + '</span><span class="wps-card-rcnt">' + rCount + '</span></span>' : '') +
            (price ? '<span class="wps-card-price">' + price + '</span>' : '') +
          '</div>' +
        '</div>';

      card.addEventListener('click', function(ev) {
        ev.stopPropagation();
        self._onCardClick(parseInt(card.dataset.idx));
      });
      track.appendChild(card);
    });

    document.body.appendChild(container);
    addDragStrip(container);
    wave(container, '.wps-card', { max: 6 });
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
        var vvH      = vvNow ? vvNow.height : canvasH;
        var visibleH = Math.min(vvH, canvasH);
        var scats    = document.getElementById('wp-scats');
        var results  = document.getElementById('wp-sresults');
        var botEl    = (scats && scats.offsetParent !== null) ? scats :
                       (results && results.offsetParent !== null) ? results : null;
        var botEdge  = botEl
          ? botEl.getBoundingClientRect().top - 8
          : visibleH;
        botEdge = Math.max(botEdge, visibleH * 0.5);
        var areaCenter = topEdge + (botEdge - topEdge) / 2;
        var offsetY    = Math.round(areaCenter + 45 - canvasH / 2);
        mv._showMiniCard(place, idx, raw, true);
        map.easeTo({ center: [lng, lat], zoom: map.getZoom(), duration: 400, offset: [0, offsetY] });
      };

      var vv = window.visualViewport;
      var kbH = vv ? Math.max(0, window.innerHeight - vv.height) : 0;
      if (kbH > 50 && vv) {
        var done = false;
        var onResize = function() { if (!done) { done = true; vv.removeEventListener('resize', onResize); requestAnimationFrame(doFlyTo); } };
        vv.addEventListener('resize', onResize);
        setTimeout(function() { if (!done) { done = true; vv.removeEventListener('resize', onResize); doFlyTo(); } }, 350);
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
      console.log('🧭 HIGHLIGHT DEBUG — primer marker._place:', {
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
      // Limpiar estilos del marker padre (donde _highlightMarkers aplica opacity)
      marker.style.removeProperty('opacity');
      marker.style.removeProperty('filter');
      marker.style.removeProperty('z-index');
      marker.style.removeProperty('transform');
      marker.style.opacity   = '1';
      marker.style.filter    = '';
      marker.style.zIndex    = '';
      // Limpiar estilos del elemento hijo también
      el.style.removeProperty('opacity');
      el.style.removeProperty('filter');
      el.style.removeProperty('transform');
      el.style.removeProperty('z-index');
      el.style.opacity   = '1';
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

    var self2 = this;
    setTimeout(function() {
      var active = container.querySelector('.wps-cat-chip.active');
      if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 80);
    // Escuchar mini snap visible para reposicionar chips
    document.addEventListener('wp:minisnap:show', function onMsShow() {
      self2._updateChipsPosition();
    });
    document.addEventListener('wp:minisnap:hide', function onMsHide() {
      self2._updateChipsPosition();
    });
  }

  _updateChipsPosition() {
    var chips = document.getElementById('wp-scats');
    if (!chips) return;
    var ms = document.getElementById('wp-minisnap-panel');
    if (ms && ms.style.transform === 'translateY(0)') {
      var msH = ms.offsetHeight || 156;
      var footerH = 84; // footer menu height
      chips.style.bottom = 'calc(' + (msH + footerH + 10) + 'px + env(safe-area-inset-bottom,0px))';
    } else {
      chips.style.bottom = 'calc(20px + env(safe-area-inset-bottom,0px))';
    }
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
    var s = document.createElement('link');
    s.id = 'wps-styles'; s.rel = 'stylesheet'; s.href = '/styles/search.css';
    document.head.appendChild(s);
  }
}
