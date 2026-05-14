// ====================================================================
// WHATSPLAN — src/components/PlaceModal.js
// Bottom sheet de detalles — replica exacta de himarco
// ====================================================================

export class PlaceModal {
  constructor(opts) {
    this.onClose        = opts.onClose        || null;
    this.getCurrentUser = opts.getCurrentUser || function() { return null; };
    this.proxyPhoto     = opts.proxyPhoto     || function(u) { return u; };

    this._place = null;
    this._el    = null;
    this._card  = null;
    this._snap  = 'full'; // 'full' | 'mini'

    this._injectStyles();
    this._build();
  }

  // ── API pública ───────────────────────────────────────────────────

  show(place) {
    this._place = place;
    this._snap  = 'full';

    this._populate(place);

    var self = this;
    var card = this._card;
    var backdrop = document.getElementById('wp-pm-backdrop');

    // Resetear estado
    card.classList.remove('snapped-mini');
    card.style.maxHeight = '';
    card.style.transition = 'none';
    card.style.transform  = 'translateY(100%)';
    if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.pointerEvents = 'none'; }

    // Mostrar overlay sin pointer events todavía
    this._el.style.pointerEvents = 'none';
    this._el.classList.remove('wp-pm-hidden');
    this._el.classList.add('wp-pm-visible');

    // Doble rAF + 10ms timeout — exactamente como himarco
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        card.style.transition = 'transform 0.36s cubic-bezier(0.32,0.72,0,1)';
        card.style.transform  = 'translateY(0)';
        // Habilitar pointer events después de que la animación termine
        setTimeout(function() {
          self._el.style.pointerEvents = '';
          if (backdrop) backdrop.style.pointerEvents = 'auto';
        }, 400);
      });
    });
  }

  hide() {
    var self = this;
    this._el.classList.remove('wp-pm-visible');
    this._snap = 'full';
    this._card.classList.remove('snapped-mini');
    this._card.style.maxHeight = '';

    // Esperar la transición CSS (0.36s) antes de ocultar
    setTimeout(function() {
      self._el.classList.add('wp-pm-hidden');
      if (self.onClose) self.onClose();
    }, 380);
  }

  isVisible() {
    return !this._el.classList.contains('wp-pm-hidden');
  }

  // ── Build ─────────────────────────────────────────────────────────

  _build() {
    var el = document.createElement('div');
    el.id        = 'wp-place-modal';
    el.className = 'wp-pm wp-pm-hidden';
    el.innerHTML =
      '<div id="wp-pm-backdrop" class="wp-pm-backdrop"></div>' +
      '<div id="wp-pm-card" class="wp-pm-card">' +
        '<div class="wp-pm-handle"></div>' +
        '<div class="wp-pm-top">' +
          '<div class="wp-pm-top-info">' +
            '<h2 class="wp-pm-name" id="wp-pm-name"></h2>' +
            '<div class="wp-pm-rating-row">' +
              '<span id="wp-pm-stars"></span>' +
              '<span class="wp-pm-rating-num" id="wp-pm-rating"></span>' +
              '<span class="wp-pm-reviews" id="wp-pm-reviews"></span>' +
              '<span class="wp-pm-status" id="wp-pm-status" style="display:none">' +
                '<span class="wp-pm-dot">·</span>' +
                '<span class="wp-pm-badge" id="wp-pm-badge"></span>' +
              '</span>' +
            '</div>' +
            '<div id="wp-pm-closetime-row" style="display:none">' +
              '<span class="wp-pm-closetime" id="wp-pm-closetime"></span>' +
            '</div>' +
          '</div>' +
          '<div class="wp-pm-top-btns">' +
            '<button class="wp-pm-icon-btn" id="wp-pm-close">✕</button>' +
            '<button class="wp-pm-icon-btn" id="wp-pm-share">' +
              '<svg width="14" height="14" viewBox="0 0 122.88 98.86" fill="currentColor"><path fill-rule="evenodd" d="M122.88,49.43L73.95,98.86V74.23C43.01,67.82,18.56,74.89,0,98.42c3.22-48.4,36.29-71.76,73.95-73.31l0-25.11L122.88,49.43z"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="wp-pm-photos" id="wp-pm-photos"></div>' +
        '<div class="wp-pm-scroll-body">' +
          '<div class="wp-pm-tabs" id="wp-pm-tabs">' +
            '<button class="wp-pm-tab active" data-tab="details">Detalles</button>' +
            '<button class="wp-pm-tab" data-tab="reviews">Reviews</button>' +
          '</div>' +
          '<div class="wp-pm-tab-content" id="wp-pm-tab-details">' +
            '<div class="wp-pm-detail-item wp-pm-hours-trigger" id="wp-pm-hours-item" style="display:none">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M12 2C9.239 2 6.737 3.12 4.929 4.929C3.12 6.737 2 9.239 2 12C2 14.761 3.12 17.263 4.929 19.071C6.737 20.88 9.239 22 12 22C14.761 22 17.263 20.88 19.071 19.071C20.88 17.263 22 14.761 22 12C22 9.239 20.88 6.737 19.071 4.929C17.263 3.12 14.761 2 12 2ZM12 7C12.552 7 13 7.448 13 8V11.586L14.707 13.293C15.098 13.683 15.098 14.317 14.707 14.707C14.317 15.098 13.683 15.098 13.293 14.707L11.293 12.707C11.105 12.52 11 12.265 11 12V8C11 7.448 11.448 7 12 7Z"/></svg>' +
              '<span id="wp-pm-hours-text"></span>' +
              '<svg class="wp-pm-chevron" id="wp-pm-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
            '</div>' +
            '<div class="wp-pm-hours-list" id="wp-pm-hours-list"></div>' +
            '<div class="wp-pm-sep" id="wp-pm-hours-sep" style="display:none"></div>' +
            '<div class="wp-pm-detail-item" id="wp-pm-addr-item" style="display:none">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M12.574 21.819a.75.75 0 01-.424.181.75.75 0 01-.424-.181C10.264 20.91 9.582 20.339 8.671 19.414 6.878 17.423 4.914 14.526 4.914 11.279c0-2.202.831-4.324 2.326-5.896C8.735 3.809 10.775 2.915 12.914 2.915c2.139 0 4.179.894 5.674 2.468 1.494 1.572 2.326 3.694 2.326 5.896 0 3.247-1.964 6.144-3.757 8.135-.911.925-1.593 1.496-2.583 2.405zm-2.66-10.54A2.5 2.5 0 0112.914 8.279a2.5 2.5 0 012.5 2.5 2.5 2.5 0 01-2.5 2.5 2.5 2.5 0 01-2.5-2.5z"/></svg>' +
              '<span id="wp-pm-addr"></span>' +
            '</div>' +
            '<div class="wp-pm-sep" id="wp-pm-addr-sep" style="display:none"></div>' +
            '<div class="wp-pm-detail-item" id="wp-pm-phone-item" style="display:none">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M10.509 8.376C9.83 5.924 7.387 4.409 4.968 5.216 3.393 5.741 2.434 6.721 2.116 8.029 1.82 9.244 2.128 10.556 2.607 11.715 3.57 14.049 5.477 16.362 6.556 17.442 7.611 18.497 9.92 20.412 12.259 21.384 13.42 21.867 14.736 22.181 15.957 21.886 17.271 21.568 18.257 20.604 18.785 19.018 19.59 16.6 18.078 14.154 15.626 13.475 13.95 13.01 12.193 13.453 10.993 14.529 10.712 14.312 10.441 14.073 10.183 13.815 9.923 13.555 9.684 13.283 9.465 12.999 10.534 11.8 10.972 10.047 10.509 8.376z"/></svg>' +
              '<a class="wp-pm-phone-link" id="wp-pm-phone"></a>' +
            '</div>' +
            '<div class="wp-pm-sep" id="wp-pm-phone-sep" style="display:none"></div>' +
            '<div class="wp-pm-detail-item" id="wp-pm-web-item" style="display:none">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
              '<a class="wp-pm-web-link" id="wp-pm-website" target="_blank" rel="noopener"></a>' +
            '</div>' +
          '</div>' +
          '<div class="wp-pm-tab-content wp-pm-tab-hidden" id="wp-pm-tab-reviews">' +
            '<div class="wp-pm-reviews-scroll" id="wp-pm-reviews"></div>' +
          '</div>' +
        '</div>' +
        '<div class="wp-pm-bottom-bar">' +
          '<button class="wp-pm-btn wp-pm-btn-activity" id="wp-pm-btn-activity">+ Actividad</button>' +
          '<button class="wp-pm-btn wp-pm-btn-visited"  id="wp-pm-btn-visited">+ Visitado</button>' +
          '<button class="wp-pm-btn wp-pm-btn-visit"    id="wp-pm-btn-visit">+ Visitar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    this._el   = el;
    this._card = document.getElementById('wp-pm-card');

    this._wireEvents();
    this._wireDrag();
  }

  // ── Populate ──────────────────────────────────────────────────────

  _populate(place) {
    document.getElementById('wp-pm-name').textContent = place.name || '';

    var rating  = parseFloat(place.rating) || 0;
    var reviews = parseInt(place.userRatingCount || place.user_ratings_total) || 0;
    document.getElementById('wp-pm-stars').innerHTML    = rating > 0 ? '<span style="color:#f59e0b;font-size:13px">★</span>' : '';
    document.getElementById('wp-pm-rating').textContent = rating > 0 ? rating.toFixed(1) : '';
    document.getElementById('wp-pm-reviews').textContent = reviews > 0 ? '(' + reviews.toLocaleString() + ')' : '';

    this._populateStatus(place);
    this._populatePhotos(place);
    this._populateDetails(place);
    this._populateReviews(place);
    this._setTab('details');
  }

  _populateStatus(place) {
    var statusEl   = document.getElementById('wp-pm-status');
    var badgeEl    = document.getElementById('wp-pm-badge');
    var ctRow      = document.getElementById('wp-pm-closetime-row');
    var ctEl       = document.getElementById('wp-pm-closetime');
    var isOpen     = this._isOpenNow(place);
    var closeStr   = this._getCloseTime(place);

    if (isOpen === true) {
      statusEl.style.display = '';
      badgeEl.textContent    = 'Abierto';
      badgeEl.className      = 'wp-pm-badge open';
      if (closeStr) { ctRow.style.display = ''; ctEl.textContent = 'Cierra a las ' + closeStr; }
      else ctRow.style.display = 'none';
    } else if (isOpen === false) {
      statusEl.style.display = '';
      badgeEl.textContent    = 'Cerrado';
      badgeEl.className      = 'wp-pm-badge closed';
      ctRow.style.display    = 'none';
    } else {
      statusEl.style.display = 'none';
      ctRow.style.display    = 'none';
    }
  }

  _populatePhotos(place) {
    var el = document.getElementById('wp-pm-photos');
    if (!el) return;
    var urls = [];
    var primary = place.photoUrl || place.photo_url;
    if (primary) urls.push(primary);
    if (place.photosUrls) place.photosUrls.forEach(function(u) { if (u && urls.indexOf(u) === -1) urls.push(u); });
    var proxied = urls.map(this.proxyPhoto.bind(this)).filter(Boolean);
    var icon    = '💎';

    el.className = 'wp-pm-photos' + (proxied.length === 1 ? ' photos-1' : '');

    if (proxied.length === 0) {
      el.innerHTML = '<div class="wp-pm-photo-item"><div class="wp-pm-photo-empty">' + icon + '</div></div>';
    } else {
      el.innerHTML = proxied.map(function(u) {
        return '<div class="wp-pm-photo-item">' +
          '<img src="' + u + '" alt="" ' +
          'onload="this.closest(\'.wp-pm-photo-item\').classList.add(\'loaded\')" ' +
          'onerror="this.outerHTML=\'<div class=wp-pm-photo-empty>' + icon + '</div>\'"/>' +
          '</div>';
      }).join('');
      requestAnimationFrame(function() {
        el.querySelectorAll('.wp-pm-photo-item img').forEach(function(img) {
          if (img.complete && img.naturalWidth > 0) img.closest('.wp-pm-photo-item').classList.add('loaded');
        });
      });
    }
  }

  _populateDetails(place) {
    var hrsRaw = place.openingHoursText || place.openingHours;
    if (hrsRaw && typeof hrsRaw === 'string') { try { hrsRaw = JSON.parse(hrsRaw); } catch(e) { hrsRaw = null; } }
    var dOrder  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var dLabels = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
    var todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];

    var hoursItem  = document.getElementById('wp-pm-hours-item');
    var hoursSep   = document.getElementById('wp-pm-hours-sep');
    var hoursText  = document.getElementById('wp-pm-hours-text');
    var hoursList  = document.getElementById('wp-pm-hours-list');

    if (hrsRaw && typeof hrsRaw === 'object') {
      hoursText.textContent = hrsRaw[todayKey] || 'Ver horarios';
      hoursList.innerHTML   = dOrder.map(function(d) {
        return '<div class="wp-pm-hours-row' + (d === todayKey ? ' wp-pm-today' : '') + '">' +
          '<span class="wp-pm-hours-day">' + dLabels[d] + '</span>' +
          '<span class="wp-pm-hours-time">' + (hrsRaw[d] || 'Cerrado') + '</span></div>';
      }).join('');
      hoursItem.style.display = ''; if (hoursSep) hoursSep.style.display = '';
    } else {
      hoursItem.style.display = 'none'; if (hoursSep) hoursSep.style.display = 'none';
    }

    var setItem = function(itemId, sepId, value, extra) {
      var item = document.getElementById(itemId);
      var sep  = document.getElementById(sepId);
      if (!item) return;
      if (value) { item.style.display = ''; if (sep) sep.style.display = ''; if (extra) extra(value); }
      else { item.style.display = 'none'; if (sep) sep.style.display = 'none'; }
    };

    var addr = place.formatted_address || place.formattedAddress || place.vicinity || '';
    setItem('wp-pm-addr-item', 'wp-pm-addr-sep', addr, function(v) {
      document.getElementById('wp-pm-addr').textContent = v;
    });

    var phone = place.phone || place.internationalPhoneNumber || place.formatted_phone_number || '';
    setItem('wp-pm-phone-item', 'wp-pm-phone-sep', phone, function(v) {
      var el = document.getElementById('wp-pm-phone'); el.textContent = v; el.href = 'tel:' + v;
    });

    var website = place.website || '';
    setItem('wp-pm-web-item', null, website, function(v) {
      var el = document.getElementById('wp-pm-website');
      el.textContent = v.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      el.href = v;
    });
  }

  _populateReviews(place) {
    var el = document.getElementById('wp-pm-reviews');
    if (!el) return;
    var revs = place.reviews || [];
    if (revs.length > 0) {
      el.innerHTML = revs.slice(0, 6).map(function(r) {
        var stars = parseFloat(r.rating) || 0;
        var sh = stars > 0 ? '<div class="wp-pm-review-stars">' +
          '<span style="color:#FFD700">' + '★'.repeat(Math.floor(stars)) + '</span>' +
          '<span style="color:#e2e8f0">' + '★'.repeat(5 - Math.floor(stars)) + '</span></div>' : '';
        return '<div class="wp-pm-review-card">' + sh +
          '<div class="wp-pm-review-text">' + (r.text || r.comment || '') + '</div>' +
          '<div class="wp-pm-review-author">"' + (r.author_name || r.authorName || 'Anónimo') + '"</div></div>';
      }).join('');
    } else {
      el.innerHTML = '<div style="padding:20px 16px;color:#94a3b8;font-size:14px">Sin reseñas disponibles</div>';
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────

  _setTab(tab) {
    document.getElementById('wp-pm-tabs').querySelectorAll('.wp-pm-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.getElementById('wp-pm-tab-details').classList.toggle('wp-pm-tab-hidden', tab !== 'details');
    document.getElementById('wp-pm-tab-reviews').classList.toggle('wp-pm-tab-hidden', tab !== 'reviews');
  }

  // ── Events ────────────────────────────────────────────────────────

  _wireEvents() {
    var self = this;

    // Backdrop — igual que himarco: colapsa a mini, no cierra
    document.getElementById('wp-pm-backdrop').addEventListener('click', function(e) {
      e.stopPropagation();
      if (self._snap === 'mini') { self.hide(); return; }
      self._snapTo('mini');
    });

    document.getElementById('wp-pm-close').addEventListener('click', function(e) {
      e.stopPropagation(); self.hide();
    });

    document.getElementById('wp-pm-share').addEventListener('click', function(e) {
      e.stopPropagation();
      if (navigator.share && self._place) navigator.share({ title: self._place.name, url: window.location.href });
    });

    document.getElementById('wp-pm-tabs').querySelectorAll('.wp-pm-tab').forEach(function(tab) {
      tab.addEventListener('click', function() { self._setTab(tab.dataset.tab); });
    });

    // Horarios expandibles
    var hoursItem = document.getElementById('wp-pm-hours-item');
    hoursItem.addEventListener('click', function() {
      var list    = document.getElementById('wp-pm-hours-list');
      var chevron = document.getElementById('wp-pm-chevron');
      var open    = list.classList.toggle('wp-pm-hours-open');
      if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
    });

    document.getElementById('wp-pm-btn-activity').addEventListener('click', function() { console.log('+ Actividad'); });
    document.getElementById('wp-pm-btn-visited').addEventListener('click',  function() { console.log('+ Visitado'); });
    document.getElementById('wp-pm-btn-visit').addEventListener('click',    function() { console.log('+ Visitar'); });
  }

  // ── Drag ─────────────────────────────────────────────────────────

  _wireDrag() {
    var self  = this;
    var card  = this._card;
    var FULL  = 'full', MINI = 'mini';
    var snap  = FULL;
    var startY = 0, startH = 0, dragging = false;

    var getFullH = function() { return window.innerHeight * 0.88; };
    var getMiniH = function() { return window.innerHeight * 0.26; };

    self._snapTo = function(target, animate) { snapTo(target, animate); };
    var snapTo = function(target, animate) {
      snap = target;
      var backdrop = document.getElementById('wp-pm-backdrop');
      if (animate !== false) {
        card.style.transition = 'max-height 0.32s cubic-bezier(0.32,0.72,0,1)';
      } else {
        card.style.transition = 'none';
      }

      if (target === MINI) {
        card.style.maxHeight = getMiniH() + 'px';
        card.classList.add('snapped-mini');
        if (backdrop) { backdrop.style.opacity = '0'; backdrop.style.pointerEvents = 'none'; }
        self._el.style.pointerEvents = 'none';
        card.style.pointerEvents = 'auto';
      } else {
        card.style.maxHeight = '';
        card.classList.remove('snapped-mini');
        if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.pointerEvents = 'auto'; }
        self._el.style.pointerEvents = 'all';
        card.style.pointerEvents = '';
      }
    };

    var onStart = function(e) {
      if (e.target.closest('.wp-pm-scroll-body')) return;
      if (e.target.closest('.wp-pm-photos')) return;
      if (e.target.closest('button, a')) return;
      dragging = true;
      startY   = e.touches ? e.touches[0].clientY : e.clientY;
      startH   = card.getBoundingClientRect().height;
      card.style.transition = 'none';
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend',  onEnd,  { passive: true });
    };

    var onMove = function(e) {
      if (!dragging) return;
      var y     = e.touches ? e.touches[0].clientY : e.clientY;
      var delta = y - startY;
      var fullH = getFullH(), miniH = getMiniH();
      var newH  = Math.min(fullH, Math.max(miniH, startH - delta));
      card.style.maxHeight = newH + 'px';
      var backdrop = document.getElementById('wp-pm-backdrop');
      if (backdrop) {
        var ratio = (newH - miniH) / (fullH - miniH);
        backdrop.style.opacity = String(Math.max(0, Math.min(1, ratio)));
      }
      if (e.cancelable) e.preventDefault();
    };

    var onEnd = function(e) {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
      var y     = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      var delta = y - startY;
      if (snap === FULL) {
        snapTo(delta > 80 ? MINI : FULL);
      } else {
        snapTo(delta < -80 ? FULL : MINI);
      }
    };

    // Drag zones: handle + top (igual que himarco)
    [card.querySelector('.wp-pm-handle'), card.querySelector('.wp-pm-top')]
      .filter(Boolean).forEach(function(zone) {
        zone.addEventListener('touchstart', onStart, { passive: true });
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _isOpenNow(place) {
    var oh = place.regularOpeningHours;
    if (!oh || !oh.periods || !oh.periods.length) return null;
    var now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    var open = false;
    oh.periods.filter(function(p) { return p.open && p.open.day === day; }).forEach(function(p) {
      if (!p.close) return;
      var o = p.open.hour * 60 + (p.open.minute || 0);
      var c = p.close.hour * 60 + (p.close.minute || 0);
      if (mins >= o && mins < c) open = true;
    });
    return open;
  }

  _getCloseTime(place) {
    var oh = place.regularOpeningHours;
    if (!oh || !oh.periods) return '';
    var now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    var result = '';
    oh.periods.filter(function(p) { return p.open && p.open.day === day; }).forEach(function(p) {
      if (!p.close) return;
      var o = p.open.hour * 60 + (p.open.minute || 0);
      var c = p.close.hour * 60 + (p.close.minute || 0);
      if (mins >= o && mins < c) {
        var h = p.close.hour > 12 ? p.close.hour - 12 : (p.close.hour || 12);
        var m = (p.close.minute || 0).toString().padStart(2, '0');
        result = h + ':' + m + ' ' + (p.close.hour >= 12 ? 'PM' : 'AM');
      }
    });
    return result;
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-pm-styles')) return;
    var s = document.createElement('style');
    s.id  = 'wp-pm-styles';
    s.textContent = `
      .wp-pm {
        position:fixed; inset:0; z-index:99990;
        display:flex; align-items:flex-end;
        pointer-events:none; opacity:0;
        transition:opacity 0.3s ease;
        padding-top:68px; box-sizing:border-box;
      }
      .wp-pm.wp-pm-hidden  { display:none; }
      .wp-pm.wp-pm-visible { pointer-events:all; opacity:1; }

      .wp-pm-backdrop {
        position:absolute; inset:0;
        background:rgba(0,0,0,0.3);
        cursor:pointer; touch-action:none;
        -webkit-tap-highlight-color:transparent;
        transition:opacity 0.3s ease;
      }

      .wp-pm-card {
        position:relative; width:100%; max-height:89dvh;
        background:#fff; border-radius:20px 20px 0 0;
        box-shadow:0 -4px 30px rgba(0,0,0,0.15);
        overflow:hidden; display:flex; flex-direction:column;
        transform:translateY(100%);
        transition:transform 0.36s cubic-bezier(0.32,0.72,0,1);
        will-change:transform;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm.wp-pm-visible .wp-pm-card { transform:translateY(0); }

      /* Mini mode */
      .wp-pm-card.snapped-mini .wp-pm-photos,
      .wp-pm-card.snapped-mini .wp-pm-scroll-body { display:none; }
      .wp-pm-card.snapped-mini .wp-pm-bottom-bar  { display:flex; }
      .wp-pm-card.snapped-mini .wp-pm-handle { background:var(--wp-blue,#2563eb); width:48px; }

      .wp-pm-handle {
        width:38px; height:4px; background:#dde3ea;
        border-radius:2px; margin:10px auto 0; flex-shrink:0;
        transition:background 0.2s, width 0.2s;
      }

      /* Top */
      .wp-pm-top {
        flex-shrink:0;
        display:flex; align-items:flex-start; justify-content:space-between;
        padding:14px 16px 10px; gap:12px;
      }
      .wp-pm-top-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
      .wp-pm-name {
        font-size:20px; font-weight:800; color:#111; margin:0;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        text-transform:capitalize;
      }
      .wp-pm-rating-row { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }
      .wp-pm-rating-num { font-size:13px; font-weight:600; color:#111; }
      .wp-pm-reviews    { font-size:13px; color:#888; }
      .wp-pm-status     { display:inline-flex; align-items:center; gap:4px; }
      .wp-pm-dot        { color:#bbb; font-size:13px; }
      .wp-pm-badge      { font-size:13px; font-weight:600; }
      .wp-pm-badge.open   { color:#34A853; }
      .wp-pm-badge.closed { color:#dc2626; }
      .wp-pm-closetime  { font-size:12px; color:#666; }
      .wp-pm-top-btns   { display:flex; gap:8px; flex-shrink:0; padding-top:2px; }
      .wp-pm-icon-btn {
        width:36px; height:36px; border-radius:50%;
        border:none; background:#E0E0E0;
        display:flex; align-items:center; justify-content:center;
        font-size:13px; color:#374151; cursor:pointer;
        -webkit-tap-highlight-color:transparent; transition:all 0.15s;
      }
      .wp-pm-icon-btn:active { background:#ccc; transform:scale(0.92); }

      /* Fotos */
      .wp-pm-photos {
        display:flex; gap:8px;
        padding:10px 0 0 16px;
        height:196px; flex-shrink:0;
        overflow-x:auto; overflow-y:hidden;
        scroll-snap-type:x mandatory;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none; touch-action:pan-x;
      }
      .wp-pm-photos::-webkit-scrollbar { display:none; }
      .wp-pm-photo-item {
        flex-shrink:0; width:140px; height:180px;
        border-radius:15px; overflow:hidden;
        scroll-snap-align:start;
        display:flex; align-items:center; justify-content:center;
        position:relative;
        background:linear-gradient(90deg,#e2e8f0 25%,#eef2f7 50%,#e2e8f0 75%);
        background-size:400px 100%;
        animation:wp-pm-shimmer 1.4s ease-in-out infinite;
      }
      @keyframes wp-pm-shimmer {
        0%   { background-position:-400px 0; }
        100% { background-position: 400px 0; }
      }
      .wp-pm-photo-item.loaded { background:#e2e8f0; animation:none; }
      .wp-pm-photo-item img {
        width:100%; height:100%; object-fit:cover;
        opacity:0; transition:opacity 0.35s ease;
        position:absolute; inset:0;
      }
      .wp-pm-photo-item.loaded img { opacity:1; }
      .wp-pm-photo-item:last-child { margin-right:16px; }
      .wp-pm-photos.photos-1 .wp-pm-photo-item { width:calc(100% - 32px); height:100%; }
      .wp-pm-photo-empty {
        font-size:40px; width:100%; height:100%;
        background:#f1f5f9;
        display:flex; align-items:center; justify-content:center;
      }

      /* Scroll body */
      .wp-pm-scroll-body {
        flex:1; overflow-y:auto; overflow-x:hidden;
        -webkit-overflow-scrolling:touch; scrollbar-width:none;
      }
      .wp-pm-scroll-body::-webkit-scrollbar { display:none; }

      /* Tabs */
      .wp-pm-tabs { display:flex; gap:8px; padding:8px 16px 6px; flex-shrink:0; }
      .wp-pm-tab {
        padding:7px 18px; border-radius:50px;
        border:none; background:#E0E0E0;
        font-size:14px; font-weight:700; color:#374151; cursor:pointer;
        -webkit-tap-highlight-color:transparent; transition:all 0.15s;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-tab.active { background:#000; color:#fff; }
      .wp-pm-tab-content { min-height:60px; padding-top:4px; }
      .wp-pm-tab-hidden  { display:none !important; }

      /* Detalles */
      .wp-pm-detail-item {
        display:flex; align-items:center; gap:12px;
        padding:10px 16px; font-size:14px; color:#374151;
      }
      .wp-pm-detail-item svg { flex-shrink:0; }
      .wp-pm-sep { height:1px; background:#E0E0E0; margin:0 16px; }
      .wp-pm-phone-link { color:#374151; text-decoration:none; font-size:14px; }
      .wp-pm-web-link {
        color:#4285F4; text-decoration:none; font-size:14px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        max-width:240px; display:block;
      }
      .wp-pm-chevron { margin-left:auto; transition:transform 0.25s ease; flex-shrink:0; }
      .wp-pm-hours-trigger { cursor:pointer; }
      .wp-pm-hours-list {
        max-height:0; overflow:hidden;
        transition:max-height 0.3s ease;
      }
      .wp-pm-hours-list.wp-pm-hours-open { max-height:300px; }
      .wp-pm-hours-row {
        display:flex; justify-content:space-between;
        padding:6px 16px 6px 44px; font-size:13px; color:#6b7280;
        border-bottom:1px solid #f1f5f9;
      }
      .wp-pm-hours-row:last-child { border-bottom:none; padding-bottom:12px; }
      .wp-pm-hours-day { min-width:90px; }
      .wp-pm-today .wp-pm-hours-day,
      .wp-pm-today .wp-pm-hours-time { color:#212121; font-weight:700; }

      /* Reviews */
      .wp-pm-reviews-scroll {
        display:flex; gap:10px; padding:10px 16px 6px;
        overflow-x:auto; scrollbar-width:none;
        -webkit-overflow-scrolling:touch;
      }
      .wp-pm-reviews-scroll::-webkit-scrollbar { display:none; }
      .wp-pm-review-card { min-width:90%; max-width:90%; background:#fff; flex-shrink:0; }
      .wp-pm-review-stars { font-size:12px; color:#FFD700; margin-bottom:6px; }
      .wp-pm-review-text {
        font-size:13px; color:#555; line-height:1.5; margin-bottom:5px;
        display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden;
      }
      .wp-pm-review-author { font-size:12px; color:#555; font-style:italic; }

      /* Bottom bar */
      .wp-pm-bottom-bar {
        display:flex; gap:8px; padding:8px 16px calc(10px + env(safe-area-inset-bottom,0px));
        border-top:1px solid #f1f5f9; flex-shrink:0; background:#fff;
        box-shadow:0 -16px 24px 8px white;
      }
      .wp-pm-btn {
        flex:1; padding:13px 8px; border-radius:50px; border:none;
        font-size:13px; font-weight:700; cursor:pointer; text-align:center;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        -webkit-tap-highlight-color:transparent; transition:all 0.15s;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-btn:active { transform:scale(0.96); filter:brightness(0.9); }
      .wp-pm-btn-activity { background:#c7cffe; color:#3d5af1; border:2px dashed #6A82FB; }
      .wp-pm-btn-visited  { background:#000; color:#fff; }
      .wp-pm-btn-visit    { background:#4ADE80; color:#fff; }
    `;
    document.head.appendChild(s);
  }
}
