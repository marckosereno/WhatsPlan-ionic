// ====================================================================
// WHATSPLAN — src/components/PlaceModal.js
// Full modal estilo Insightlancer — foto hero, tabs, CTA
// ====================================================================

export class PlaceModal {
  constructor(opts) {
    this.onClose        = opts.onClose        || null;
    this.getCurrentUser = opts.getCurrentUser || function() { return null; };
    this.proxyPhoto     = opts.proxyPhoto     || function(u) { return u; };

    this._place = null;
    this._el    = null;
    this._card  = null;
    this._snap  = 'full';

    this._injectStyles();
    this._build();
  }

  show(place) {
    this._place = place;
    this._snap  = 'full';
    this._populate(place);

    var self = this;
    var card = this._card;
    var backdrop = document.getElementById('wp-pm-backdrop');

    card.classList.remove('snapped-mini');
    card.style.maxHeight = '';
    card.style.transition = 'none';
    card.style.transform  = 'translateY(100%)';
    if (backdrop) { backdrop.style.opacity = '1'; backdrop.style.pointerEvents = 'none'; }

    this._el.style.pointerEvents = 'none';
    this._el.classList.remove('wp-pm-hidden');
    this._el.classList.add('wp-pm-visible');

    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        card.style.transition = 'transform 0.36s cubic-bezier(0.32,0.72,0,1)';
        card.style.transform  = 'translateY(0)';
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
    setTimeout(function() {
      self._el.classList.add('wp-pm-hidden');
      if (self.onClose) self.onClose();
    }, 380);
  }

  isVisible() {
    return !this._el.classList.contains('wp-pm-hidden');
  }

  _build() {
    var el = document.createElement('div');
    el.id        = 'wp-place-modal';
    el.className = 'wp-pm wp-pm-hidden';
    el.innerHTML =
      '<div id="wp-pm-backdrop" class="wp-pm-backdrop"></div>' +
      '<div id="wp-pm-card" class="wp-pm-card">' +
        // ── Hero foto ──
        '<div class="wp-pm-hero" id="wp-pm-hero">' +
          '<div class="wp-pm-hero-overlay"></div>' +
          '<button class="wp-pm-hero-btn wp-pm-hero-back" id="wp-pm-close">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>' +
          '</button>' +
          '<div class="wp-pm-hero-actions">' +
            '<button class="wp-pm-hero-btn" id="wp-pm-share">' +
              '<svg width="16" height="16" viewBox="0 0 122.88 98.86" fill="currentColor"><path fill-rule="evenodd" d="M122.88,49.43L73.95,98.86V74.23C43.01,67.82,18.56,74.89,0,98.42c3.22-48.4,36.29-71.76,73.95-73.31l0-25.11L122.88,49.43z"/></svg>' +
            '</button>' +
            '<button class="wp-pm-hero-btn" id="wp-pm-fav">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
            '</button>' +
          '</div>' +
          // Thumbnails strip
          '<div class="wp-pm-thumbs" id="wp-pm-thumbs"></div>' +
        '</div>' +

        // ── Info body ──
        '<div class="wp-pm-body">' +
          '<div class="wp-pm-handle"></div>' +

          // Badges row
          '<div class="wp-pm-badges-row" id="wp-pm-badges-row">' +
            '<span class="wp-pm-discount-badge" id="wp-pm-discount" style="display:none">✦ Destacado</span>' +
            '<div class="wp-pm-star-badge">' +
              '<span style="color:#f59e0b">★</span>' +
              '<span class="wp-pm-rating-num" id="wp-pm-rating"></span>' +
              '<span class="wp-pm-reviews" id="wp-pm-reviews"></span>' +
            '</div>' +
          '</div>' +

          // Name
          '<h2 class="wp-pm-name" id="wp-pm-name"></h2>' +

          // Meta row: time · price · type
          '<div class="wp-pm-meta-row" id="wp-pm-meta-row">' +
            '<span class="wp-pm-meta-item" id="wp-pm-status-badge" style="display:none"></span>' +
            '<span class="wp-pm-meta-item" id="wp-pm-price"></span>' +
            '<span class="wp-pm-meta-item" id="wp-pm-type"></span>' +
          '</div>' +

          // Address
          '<div class="wp-pm-addr-row" id="wp-pm-addr-row" style="display:none">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="#6b7280" style="flex-shrink:0"><path fill-rule="evenodd" d="M12.574 21.819a.75.75 0 01-.424.181.75.75 0 01-.424-.181C10.264 20.91 9.582 20.339 8.671 19.414 6.878 17.423 4.914 14.526 4.914 11.279c0-2.202.831-4.324 2.326-5.896C8.735 3.809 10.775 2.915 12.914 2.915c2.139 0 4.179.894 5.674 2.468 1.494 1.572 2.326 3.694 2.326 5.896 0 3.247-1.964 6.144-3.757 8.135-.911.925-1.593 1.496-2.583 2.405zm-2.66-10.54A2.5 2.5 0 0112.914 8.279a2.5 2.5 0 012.5 2.5 2.5 2.5 0 01-2.5 2.5 2.5 2.5 0 01-2.5-2.5z"/></svg>' +
            '<span id="wp-pm-addr"></span>' +
          '</div>' +

          // ── Tabs ──
          '<div class="wp-pm-tabs" id="wp-pm-tabs">' +
            '<button class="wp-pm-tab active" data-tab="details">Detalles</button>' +
            '<button class="wp-pm-tab" data-tab="gallery">Galería</button>' +
            '<button class="wp-pm-tab" data-tab="reviews">Reviews</button>' +
          '</div>' +

          // ── Tab: Detalles ──
          '<div class="wp-pm-tab-content" id="wp-pm-tab-details">' +
            '<div class="wp-pm-detail-item wp-pm-hours-trigger" id="wp-pm-hours-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M12 2C9.239 2 6.737 3.12 4.929 4.929C3.12 6.737 2 9.239 2 12C2 14.761 3.12 17.263 4.929 19.071C6.737 20.88 9.239 22 12 22C14.761 22 17.263 20.88 19.071 19.071C20.88 17.263 22 14.761 22 12C22 9.239 20.88 6.737 19.071 4.929C17.263 3.12 14.761 2 12 2ZM12 7C12.552 7 13 7.448 13 8V11.586L14.707 13.293C15.098 13.683 15.098 14.317 14.707 14.707C14.317 15.098 13.683 15.098 13.293 14.707L11.293 12.707C11.105 12.52 11 12.265 11 12V8C11 7.448 11.448 7 12 7Z"/></svg>' +
              '<span id="wp-pm-hours-text"></span>' +
              '<svg class="wp-pm-chevron" id="wp-pm-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
            '</div>' +
            '<div class="wp-pm-hours-list" id="wp-pm-hours-list"></div>' +
            '<div class="wp-pm-sep" id="wp-pm-hours-sep" style="display:none"></div>' +
            '<div class="wp-pm-detail-item" id="wp-pm-phone-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M10.509 8.376C9.83 5.924 7.387 4.409 4.968 5.216 3.393 5.741 2.434 6.721 2.116 8.029 1.82 9.244 2.128 10.556 2.607 11.715 3.57 14.049 5.477 16.362 6.556 17.442 7.611 18.497 9.92 20.412 12.259 21.384 13.42 21.867 14.736 22.181 15.957 21.886 17.271 21.568 18.257 20.604 18.785 19.018 19.59 16.6 18.078 14.154 15.626 13.475 13.95 13.01 12.193 13.453 10.993 14.529 10.712 14.312 10.441 14.073 10.183 13.815 9.923 13.555 9.684 13.283 9.465 12.999 10.534 11.8 10.972 10.047 10.509 8.376z"/></svg>' +
              '<a class="wp-pm-phone-link" id="wp-pm-phone"></a>' +
            '</div>' +
            '<div class="wp-pm-sep" id="wp-pm-phone-sep" style="display:none"></div>' +
            '<div class="wp-pm-detail-item" id="wp-pm-web-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
              '<a class="wp-pm-web-link" id="wp-pm-website" target="_blank" rel="noopener"></a>' +
            '</div>' +
          '</div>' +

          // ── Tab: Galería ──
          '<div class="wp-pm-tab-content wp-pm-tab-hidden" id="wp-pm-tab-gallery">' +
            '<div class="wp-pm-gallery-grid" id="wp-pm-gallery-grid"></div>' +
          '</div>' +

          // ── Tab: Reviews ──
          '<div class="wp-pm-tab-content wp-pm-tab-hidden" id="wp-pm-tab-reviews">' +
            '<div class="wp-pm-reviews-list" id="wp-pm-reviews-list"></div>' +
          '</div>' +

        '</div>' +

        // ── CTA bottom bar ──
        '<div class="wp-pm-bottom-bar">' +
          '<button class="wp-pm-btn wp-pm-btn-activity" id="wp-pm-btn-activity">+ Actividad</button>' +
          '<button class="wp-pm-btn wp-pm-btn-visit" id="wp-pm-btn-visit">+ Visitar</button>' +
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
    this._populateHero(place);
    this._populateBadges(place);
    this._populateMeta(place);
    this._populateDetails(place);
    this._populateGallery(place);
    this._populateReviews(place);
    this._setTab('details');
  }

  _populateHero(place) {
    var hero = document.getElementById('wp-pm-hero');
    var thumbs = document.getElementById('wp-pm-thumbs');
    if (!hero) return;

    var urls = [];
    var primary = place.photoUrl || place.photo_url;
    if (primary) urls.push(primary);
    if (place.photosUrls) place.photosUrls.forEach(function(u) { if (u && urls.indexOf(u) === -1) urls.push(u); });
    var proxied = urls.map(this.proxyPhoto.bind(this)).filter(Boolean);

    // Hero background
    if (proxied.length > 0) {
      hero.style.backgroundImage = 'url(' + proxied[0] + ')';
    } else {
      hero.style.background = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
      hero.innerHTML += '<div class="wp-pm-hero-emoji">' + (place.emoji || '📍') + '</div>';
    }

    // Thumbnails
    if (proxied.length > 1 && thumbs) {
      thumbs.innerHTML = proxied.slice(0, 5).map(function(u, i) {
        return '<div class="wp-pm-thumb' + (i === 0 ? ' active' : '') + '" style="background-image:url(' + u + ')" data-idx="' + i + '"></div>';
      }).join('') + (proxied.length > 5 ? '<div class="wp-pm-thumb wp-pm-thumb-more">+' + (proxied.length - 5) + '</div>' : '');

      // Tap thumbnail to change hero
      var self = this;
      thumbs.querySelectorAll('.wp-pm-thumb[data-idx]').forEach(function(t) {
        t.addEventListener('click', function() {
          hero.style.backgroundImage = 'url(' + proxied[parseInt(t.dataset.idx)] + ')';
          thumbs.querySelectorAll('.wp-pm-thumb').forEach(function(x) { x.classList.remove('active'); });
          t.classList.add('active');
        });
      });
    } else if (thumbs) {
      thumbs.style.display = 'none';
    }
  }

  _populateBadges(place) {
    var ratingEl  = document.getElementById('wp-pm-rating');
    var reviewsEl = document.getElementById('wp-pm-reviews');
    var discEl    = document.getElementById('wp-pm-discount');

    var rating  = parseFloat(place.rating) || 0;
    var reviews = parseInt(place.userRatingCount || place.user_ratings_total) || 0;

    if (ratingEl) ratingEl.textContent = rating > 0 ? rating.toFixed(1) : '';
    if (reviewsEl) reviewsEl.textContent = reviews > 0 ? '(' + reviews.toLocaleString() + ' reseñas)' : '';
    if (discEl) discEl.style.display = place.featured ? '' : 'none';

    document.getElementById('wp-pm-name').textContent = place.name || '';
  }

  _populateMeta(place) {
    // Status badge
    var statusEl = document.getElementById('wp-pm-status-badge');
    var isOpen   = this._isOpenNow(place);
    if (statusEl) {
      if (isOpen === true) {
        statusEl.style.display = '';
        statusEl.textContent   = '● Abierto';
        statusEl.style.color   = '#16a34a';
      } else if (isOpen === false) {
        statusEl.style.display = '';
        statusEl.textContent   = '● Cerrado';
        statusEl.style.color   = '#dc2626';
      } else {
        statusEl.style.display = 'none';
      }
    }

    // Price
    var priceEl = document.getElementById('wp-pm-price');
    if (priceEl) {
      var pl = place.priceLevel || place.price_level;
      priceEl.textContent = pl ? '$'.repeat(Math.min(pl, 4)) : '';
      priceEl.style.display = pl ? '' : 'none';
    }

    // Type / category
    var typeEl = document.getElementById('wp-pm-type');
    if (typeEl) {
      var type = place.primaryType || place.types && place.types[0] || place.subcategory || '';
      type = type.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      typeEl.textContent   = (place.emoji || '') + ' ' + type;
      typeEl.style.display = type ? '' : 'none';
    }

    // Address
    var addr = place.formatted_address || place.formattedAddress || place.vicinity || '';
    var addrRow = document.getElementById('wp-pm-addr-row');
    if (addrRow) {
      addrRow.style.display = addr ? '' : 'none';
      var addrSpan = document.getElementById('wp-pm-addr');
      if (addrSpan) addrSpan.textContent = addr;
    }
  }

  _populateDetails(place) {
    var hrsRaw = place.openingHoursText || place.openingHours;
    if (hrsRaw && typeof hrsRaw === 'string') { try { hrsRaw = JSON.parse(hrsRaw); } catch(e) { hrsRaw = null; } }
    var dOrder  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var dLabels = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
    var todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];

    var hoursItem = document.getElementById('wp-pm-hours-item');
    var hoursSep  = document.getElementById('wp-pm-hours-sep');
    var hoursText = document.getElementById('wp-pm-hours-text');
    var hoursList = document.getElementById('wp-pm-hours-list');

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

  _populateGallery(place) {
    var grid = document.getElementById('wp-pm-gallery-grid');
    if (!grid) return;

    var urls = [];
    var primary = place.photoUrl || place.photo_url;
    if (primary) urls.push(primary);
    if (place.photosUrls) place.photosUrls.forEach(function(u) { if (u && urls.indexOf(u) === -1) urls.push(u); });
    var proxied = urls.map(this.proxyPhoto.bind(this)).filter(Boolean);

    if (proxied.length === 0) {
      grid.innerHTML = '<div class="wp-pm-gallery-empty">Sin fotos disponibles</div>';
      return;
    }

    grid.innerHTML = proxied.map(function(u) {
      return '<div class="wp-pm-gallery-item">' +
        '<img src="' + u + '" alt="" loading="lazy" ' +
        'onload="this.closest(\'.wp-pm-gallery-item\').classList.add(\'loaded\')" ' +
        'onerror="this.parentElement.style.display=\'none\'"/>' +
        '</div>';
    }).join('');
  }

  _populateReviews(place) {
    var el = document.getElementById('wp-pm-reviews-list');
    if (!el) return;
    var revs = place.reviews || [];
    if (revs.length > 0) {
      el.innerHTML = revs.slice(0, 8).map(function(r) {
        var stars   = parseFloat(r.rating) || 0;
        var initials = (r.author_name || r.authorName || 'A').charAt(0).toUpperCase();
        var relTime  = r.relative_time_description || r.relativeTime || '';
        return '<div class="wp-pm-review-card">' +
          '<div class="wp-pm-review-header">' +
            '<div class="wp-pm-review-avatar">' + initials + '</div>' +
            '<div class="wp-pm-review-meta">' +
              '<div class="wp-pm-review-author">' + (r.author_name || r.authorName || 'Anónimo') + '</div>' +
              (relTime ? '<div class="wp-pm-review-time">' + relTime + '</div>' : '') +
            '</div>' +
          '</div>' +
          (stars > 0 ? '<div class="wp-pm-review-stars">' +
            '<span style="color:#f59e0b">' + '★'.repeat(Math.floor(stars)) + '</span>' +
            '<span style="color:#e2e8f0">' + '★'.repeat(5 - Math.floor(stars)) + '</span>' +
          '</div>' : '') +
          '<div class="wp-pm-review-text">' + (r.text || r.comment || '') + '</div>' +
        '</div>';
      }).join('');
    } else {
      el.innerHTML = '<div class="wp-pm-empty-reviews">Sin reseñas disponibles</div>';
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────

  _setTab(tab) {
    document.getElementById('wp-pm-tabs').querySelectorAll('.wp-pm-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    ['details','gallery','reviews'].forEach(function(id) {
      var el = document.getElementById('wp-pm-tab-' + id);
      if (el) el.classList.toggle('wp-pm-tab-hidden', id !== tab);
    });
  }

  // ── Events ────────────────────────────────────────────────────────

  _wireEvents() {
    var self = this;

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

    document.getElementById('wp-pm-fav').addEventListener('click', function(e) {
      e.stopPropagation();
      this.classList.toggle('active');
    });

    document.getElementById('wp-pm-tabs').querySelectorAll('.wp-pm-tab').forEach(function(tab) {
      tab.addEventListener('click', function() { self._setTab(tab.dataset.tab); });
    });

    var hoursItem = document.getElementById('wp-pm-hours-item');
    if (hoursItem) {
      hoursItem.addEventListener('click', function() {
        var list    = document.getElementById('wp-pm-hours-list');
        var chevron = document.getElementById('wp-pm-chevron');
        var open    = list.classList.toggle('wp-pm-hours-open');
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
      });
    }

    document.getElementById('wp-pm-btn-activity').addEventListener('click', function() { console.log('+ Actividad', self._place); });
    document.getElementById('wp-pm-btn-visit').addEventListener('click',    function() { console.log('+ Visitar', self._place); });
  }

  // ── Drag ─────────────────────────────────────────────────────────

  _wireDrag() {
    var self  = this;
    var card  = this._card;
    var FULL  = 'full', MINI = 'mini';
    var snap  = FULL;
    var startY = 0, startH = 0, dragging = false;

    var getFullH = function() { return window.innerHeight * 0.90; };
    var getMiniH = function() { return window.innerHeight * 0.28; };

    self._snapTo = function(target, animate) { snapTo(target, animate); };
    var snapTo = function(target, animate) {
      snap = target; self._snap = target;
      var backdrop = document.getElementById('wp-pm-backdrop');
      card.style.transition = animate !== false ? 'max-height 0.32s cubic-bezier(0.32,0.72,0,1)' : 'none';

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
      if (e.target.closest('.wp-pm-body')) return;
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
      if (snap === FULL) { snapTo(delta > 80 ? MINI : FULL); }
      else               { snapTo(delta < -80 ? FULL : MINI); }
    };

    var hero = card.querySelector('.wp-pm-hero');
    var handle = card.querySelector('.wp-pm-handle');
    [hero, handle].filter(Boolean).forEach(function(zone) {
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

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-pm-styles')) return;
    var s = document.createElement('style');
    s.id  = 'wp-pm-styles';
    s.textContent = `
      /* ── tokens del sistema WhatsPlan ──
         height chips/btns : 44px
         height icon-btns  : 36px
         height cat-chips  : 68px
         border-radius pill: 9999px
         border-radius panel:32px
         border-radius card: 22px
         padding pill      : 0 20px
         padding panel     : 12px 0 10px
         gap standard      : 8px
         font chips        : 15px Inter Tight 400
         font labels small : 10px
      ── */

      .wp-pm {
        position:fixed; inset:0; z-index:99990;
        display:flex; align-items:flex-end;
        pointer-events:none; opacity:0;
        transition:opacity 0.3s ease;
      }
      .wp-pm.wp-pm-hidden  { display:none; }
      .wp-pm.wp-pm-visible { pointer-events:all; opacity:1; }

      .wp-pm-backdrop {
        position:absolute; inset:0;
        background:rgba(0,0,0,0.35);
        cursor:pointer; touch-action:none;
        -webkit-tap-highlight-color:transparent;
        transition:opacity 0.3s ease;
      }

      /* panel border-radius:32px igual que .map-results-panel-float */
      .wp-pm-card {
        position:relative; width:100%; max-height:90dvh;
        background:#fff; border-radius:32px 32px 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,0.15);
        overflow:hidden; display:flex; flex-direction:column;
        transform:translateY(100%);
        transition:transform 0.36s cubic-bezier(0.32,0.72,0,1);
        will-change:transform;
        font-family:'Inter Tight',system-ui,sans-serif;
      }

      .wp-pm-card.snapped-mini .wp-pm-body { overflow:hidden; max-height:0; }
      .wp-pm-card.snapped-mini .wp-pm-bottom-bar { display:flex; }

      /* Hero */
      .wp-pm-hero {
        position:relative; width:100%; height:220px; flex-shrink:0;
        background:#1e293b center/cover no-repeat;
      }
      .wp-pm-hero-overlay {
        position:absolute; inset:0;
        background:linear-gradient(to bottom,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.12) 100%);
      }
      /* hero-btn: 36px igual que icon buttons del sistema */
      .wp-pm-hero-btn {
        position:absolute; top:12px;
        width:36px; height:36px; border-radius:9999px;
        border:none; background:rgba(255,255,255,0.88);
        backdrop-filter:blur(16px) saturate(1.8);
        -webkit-backdrop-filter:blur(16px) saturate(1.8);
        box-shadow:0 4px 12px rgba(0,0,0,0.12);
        display:flex; align-items:center; justify-content:center;
        color:#374151; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
      }
      .wp-pm-hero-btn:active { transform:scale(0.92); }
      .wp-pm-hero-back { left:12px; }
      .wp-pm-hero-actions { position:absolute; top:12px; right:12px; display:flex; gap:8px; }
      .wp-pm-hero-btn.active svg { fill:#ef4444; stroke:#ef4444; }
      .wp-pm-hero-emoji {
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        font-size:64px;
      }
      /* thumbs: height 34px, border-radius 8px */
      .wp-pm-thumbs {
        position:absolute; bottom:10px; left:12px;
        display:flex; gap:5px;
      }
      .wp-pm-thumb {
        width:44px; height:34px; border-radius:8px;
        background:#334155 center/cover no-repeat;
        border:2px solid transparent;
        cursor:pointer; transition:border-color 0.15s, transform 0.15s;
        flex-shrink:0;
      }
      .wp-pm-thumb.active { border-color:#fff; }
      .wp-pm-thumb:active { transform:scale(0.93); }
      .wp-pm-thumb-more {
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,0.55); color:#fff;
        font-size:10px; font-weight:700;
        border:2px solid rgba(255,255,255,0.5);
      }

      /* Body — padding:12px 0 igual que panel */
      .wp-pm-body {
        flex:1; overflow-y:auto; overflow-x:hidden;
        -webkit-overflow-scrolling:touch; scrollbar-width:none;
        padding-bottom:8px;
      }
      .wp-pm-body::-webkit-scrollbar { display:none; }

      .wp-pm-handle {
        width:38px; height:4px; background:#dde3ea;
        border-radius:2px; margin:10px auto 6px; flex-shrink:0;
      }

      /* Badges row — gap:8px */
      .wp-pm-badges-row {
        display:flex; align-items:center; gap:8px;
        padding:4px 16px 6px;
      }
      .wp-pm-discount-badge {
        background:#fef3c7; color:#d97706;
        font-size:10px; font-weight:700;
        padding:2px 8px; border-radius:9999px;
      }
      .wp-pm-star-badge { display:flex; align-items:center; gap:4px; }
      .wp-pm-rating-num { font-size:13px; font-weight:700; color:#111; }
      .wp-pm-reviews    { font-size:10px; color:#888; }

      /* Name — Yahoo Sans como resto de nombres */
      .wp-pm-name {
        font-size:20px; font-weight:800; color:#111; margin:0;
        padding:0 16px 6px;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        text-transform:capitalize; line-height:1.2;
      }

      /* Meta row — font-size:13px, gap:8px */
      .wp-pm-meta-row {
        display:flex; align-items:center; gap:6px; flex-wrap:wrap;
        padding:0 16px 8px;
      }
      .wp-pm-meta-item { font-size:13px; color:#555; font-weight:400; }
      .wp-pm-meta-sep  { color:#ddd; font-size:13px; }

      /* Address — font-size:13px */
      .wp-pm-addr-row {
        display:flex; align-items:flex-start; gap:6px;
        padding:0 16px 10px; font-size:13px; color:#6b7280; line-height:1.4;
      }

      /* Tabs — height 44px igual que chips, padding:0 20px */
      .wp-pm-tabs {
        display:flex; gap:0; padding:0 16px;
        border-bottom:1px solid #f1f5f9; flex-shrink:0;
        overflow-x:auto; scrollbar-width:none;
      }
      .wp-pm-tabs::-webkit-scrollbar { display:none; }
      .wp-pm-tab {
        height:44px; padding:0 20px;
        border:none; border-bottom:2.5px solid transparent;
        background:transparent;
        font-size:15px; font-weight:400; color:#9ca3af; cursor:pointer;
        -webkit-tap-highlight-color:transparent; transition:all 0.15s;
        font-family:'Inter Tight',system-ui,sans-serif;
        white-space:nowrap; display:flex; align-items:center;
      }
      .wp-pm-tab.active { color:#2563eb; border-bottom-color:#2563eb; font-weight:600; }
      .wp-pm-tab-content { min-height:80px; }
      .wp-pm-tab-hidden  { display:none !important; }

      /* Detalles — padding:12px 16px igual que subcategory chips */
      .wp-pm-detail-item {
        display:flex; align-items:center; gap:12px;
        padding:12px 16px; font-size:14px; color:#374151;
      }
      .wp-pm-detail-item svg { flex-shrink:0; }
      .wp-pm-sep { height:1px; background:#f1f5f9; margin:0 16px; }
      .wp-pm-phone-link { color:#374151; text-decoration:none; font-size:14px; }
      .wp-pm-web-link {
        color:#2563eb; text-decoration:none; font-size:14px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        max-width:220px; display:block;
      }
      .wp-pm-chevron { margin-left:auto; transition:transform 0.25s ease; flex-shrink:0; }
      .wp-pm-hours-trigger { cursor:pointer; }
      .wp-pm-hours-list { max-height:0; overflow:hidden; transition:max-height 0.3s ease; }
      .wp-pm-hours-list.wp-pm-hours-open { max-height:320px; }
      .wp-pm-hours-row {
        display:flex; justify-content:space-between;
        padding:6px 16px 6px 44px; font-size:13px; color:#6b7280;
        border-bottom:1px solid #f9fafb;
      }
      .wp-pm-hours-row:last-child { border-bottom:none; padding-bottom:10px; }
      .wp-pm-hours-day { min-width:90px; }
      .wp-pm-today .wp-pm-hours-day,
      .wp-pm-today .wp-pm-hours-time { color:#111; font-weight:700; }

      /* Gallery grid — border-radius:22px como category chips */
      .wp-pm-gallery-grid {
        display:grid; grid-template-columns:1fr 1fr;
        gap:8px; padding:12px 16px;
      }
      .wp-pm-gallery-item {
        aspect-ratio:1; border-radius:22px; overflow:hidden;
        background:#f1f5f9;
      }
      .wp-pm-gallery-item:first-child { grid-column:1/-1; aspect-ratio:16/9; }
      .wp-pm-gallery-item img {
        width:100%; height:100%; object-fit:cover;
        opacity:0; transition:opacity 0.3s ease;
      }
      .wp-pm-gallery-item.loaded img { opacity:1; }
      .wp-pm-gallery-empty { padding:24px 16px; color:#94a3b8; font-size:14px; text-align:center; }

      /* Reviews */
      .wp-pm-reviews-list { padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
      .wp-pm-review-card {
        background:#f9fafb; border-radius:22px;
        padding:12px 16px;
      }
      .wp-pm-review-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
      .wp-pm-review-avatar {
        width:36px; height:36px; border-radius:9999px;
        background:linear-gradient(135deg,#3b82f6,#8b5cf6);
        color:#fff; font-size:14px; font-weight:700;
        display:flex; align-items:center; justify-content:center;
        flex-shrink:0;
      }
      .wp-pm-review-meta { display:flex; flex-direction:column; gap:1px; }
      .wp-pm-review-author { font-size:13px; font-weight:700; color:#111; }
      .wp-pm-review-time   { font-size:10px; color:#9ca3af; }
      .wp-pm-review-stars  { font-size:12px; margin-bottom:4px; }
      .wp-pm-review-text {
        font-size:13px; color:#555; line-height:1.55;
        display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden;
      }
      .wp-pm-empty-reviews { padding:24px 0; color:#94a3b8; font-size:14px; text-align:center; }

      /* Bottom bar — padding:12px 0 10px igual que panel, gap:8px */
      .wp-pm-bottom-bar {
        display:flex; gap:8px;
        padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));
        border-top:1px solid #f1f5f9; flex-shrink:0; background:#fff;
        box-shadow:0 -16px 24px 8px white;
      }
      /* Botones: height:44px, border-radius:9999px, font:15px Inter Tight */
      .wp-pm-btn {
        flex:1; height:44px; padding:0 20px;
        border-radius:9999px; border:none;
        font-size:15px; font-weight:600; cursor:pointer; text-align:center;
        -webkit-tap-highlight-color:transparent; transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
        font-family:'Inter Tight',system-ui,sans-serif;
        display:flex; align-items:center; justify-content:center;
      }
      .wp-pm-btn:active { transform:scale(0.96); filter:brightness(0.9); }
      .wp-pm-btn-activity {
        background:#ede9fe; color:#7c3aed;
        border:2px dashed #a78bfa;
        flex:0.85;
      }
      .wp-pm-btn-visit {
        background:#2563eb; color:#fff;
        box-shadow:0 4px 16px rgba(37,99,235,0.35);
        flex:1.15;
      }
    \`;
    document.head.appendChild(s);
  }
}
