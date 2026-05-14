// ====================================================================
// WHATSPLAN — src/components/PlaceModal.js
// Bottom sheet de detalles de lugar — replicado de himarco
// ====================================================================

export class PlaceModal {
  constructor(opts) {
    this.onClose       = opts.onClose       || null;
    this.getCurrentUser = opts.getCurrentUser || function() { return null; };
    this.proxyPhoto    = opts.proxyPhoto     || function(u) { return u; };

    this._place  = null;
    this._el     = null;
    this._card   = null;
    this._dragY  = 0;
    this._mini   = false;

    this._injectStyles();
    this._build();
  }

  // ── API pública ───────────────────────────────────────────────────

  show(place) {
    this._place = place;
    this._populate(place);
    this._mini = false;

    this._el.classList.remove('hidden');
    requestAnimationFrame(() => {
      this._el.classList.add('visible');
      this._card.style.transform = '';
    });

    if (window.gsap) {
      window.gsap.fromTo(this._card,
        { y: '100%' },
        { y: '0%', duration: 0.38, ease: 'power3.out', clearProps: 'transform' }
      );
    }
  }

  hide() {
    var self = this;
    this._el.classList.remove('visible');
    this._card.classList.remove('snapped-mini');
    this._mini = false;

    if (window.gsap) {
      window.gsap.to(this._card, {
        y: '100%', duration: 0.28, ease: 'power3.in',
        onComplete: function() {
          self._el.classList.add('hidden');
          self._card.style.transform = '';
          if (self.onClose) self.onClose();
        }
      });
    } else {
      setTimeout(function() {
        self._el.classList.add('hidden');
        if (self.onClose) self.onClose();
      }, 300);
    }
  }

  isVisible() {
    return !this._el.classList.contains('hidden');
  }

  // ── Build HTML ────────────────────────────────────────────────────

  _build() {
    var el = document.createElement('div');
    el.id        = 'wp-place-modal';
    el.className = 'wp-place-modal hidden';

    el.innerHTML =
      '<div class="wp-modal-backdrop" id="wp-modal-backdrop"></div>' +
      '<div class="wp-modal-card" id="wp-modal-card">' +

        // Handle
        '<div class="wp-modal-handle"></div>' +

        // Top: nombre + botones
        '<div class="wp-modal-top">' +
          '<div class="wp-modal-top-info">' +
            '<h2 class="wp-modal-name" id="wpm-name"></h2>' +
            '<div class="wp-modal-rating-row">' +
              '<span class="wp-modal-stars" id="wpm-stars"></span>' +
              '<span class="wp-modal-rating-num" id="wpm-rating"></span>' +
              '<span class="wp-modal-reviews" id="wpm-reviews"></span>' +
              '<span class="wp-modal-status-inline" id="wpm-status" style="display:none">' +
                '<span class="wp-modal-dot">·</span>' +
                '<span class="wp-modal-open-badge" id="wpm-open-badge"></span>' +
              '</span>' +
            '</div>' +
            '<div class="wp-modal-close-time-row" id="wpm-close-time-row" style="display:none">' +
              '<span class="wp-modal-close-time" id="wpm-close-time"></span>' +
            '</div>' +
          '</div>' +
          '<div class="wp-modal-top-btns">' +
            '<button class="wp-modal-icon-btn" id="wpm-close-btn">✕</button>' +
            '<button class="wp-modal-icon-btn" id="wpm-share-btn">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +

        // Fotos carrusel
        '<div class="wp-modal-photos" id="wpm-photos"></div>' +

        // Scroll body
        '<div class="wp-modal-scroll-body">' +

          // Tabs
          '<div class="wp-modal-tabs" id="wpm-tabs">' +
            '<button class="wp-modal-tab active" data-tab="details">Detalles</button>' +
            '<button class="wp-modal-tab" data-tab="reviews">Reviews</button>' +
          '</div>' +

          // Tab Detalles
          '<div class="wp-modal-tab-content" id="wpm-tab-details">' +
            '<div class="wp-modal-detail-item" id="wpm-hours-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C9.23885 2 6.73748 3.12038 4.92893 4.92893C3.12038 6.73748 2 9.23885 2 12C2 14.7611 3.12038 17.2625 4.92893 19.0711C6.73748 20.8796 9.23885 22 12 22C14.7611 22 17.2625 20.8796 19.0711 19.0711C20.8796 17.2625 22 14.7611 22 12C22 9.23885 20.8796 6.73748 19.0711 4.92893C17.2625 3.12038 14.7611 2 12 2ZM12 7C12.5523 7 13 7.44772 13 8V11.5858L14.7071 13.2929C15.0976 13.6834 15.0976 14.3166 14.7071 14.7071C14.3166 15.0976 13.6834 15.0976 13.2929 14.7071L11.2929 12.7071C11.1054 12.5196 11 12.2652 11 12V8C11 7.44772 11.4477 7 12 7Z"/></svg>' +
              '<span id="wpm-hours-text"></span>' +
              '<button class="wp-modal-hours-toggle" id="wpm-hours-toggle">▾</button>' +
            '</div>' +
            '<div class="wp-modal-hours-list" id="wpm-hours-list" style="display:none"></div>' +
            '<div class="wp-modal-sep" id="wpm-hours-sep" style="display:none"></div>' +

            '<div class="wp-modal-detail-item" id="wpm-addr-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.5742 21.8187C12.2295 22.0604 11.7699 22.0601 11.4253 21.8184L11.3986 21.7994C10.2641 20.9101 9.58227 20.3389 8.67111 19.4139 C6.87787 17.4227 4.91419 14.5256 4.91419 11.2787 C4.91419 9.07644 5.74537 6.95488 7.23967 5.38295 C8.7356 3.80931 10.7757 2.91518 12.9142 2.91518 C15.0527 2.91518 17.0927 3.80931 18.5887 5.38295 C20.083 6.95488 20.9142 9.07644 20.9142 11.2787 C20.9142 14.5256 18.9505 17.4227 17.1572 19.4139 C16.246 20.3389 15.5642 20.9101 14.5057 21.7994 L14.4785 21.8187 ZM9.91419 11.2787 C9.91419 9.62184 11.2573 8.27869 12.9142 8.27869 C14.571 8.27869 15.9142 9.62184 15.9142 11.2787 C15.9142 12.9356 14.571 14.2787 12.9142 14.2787 C11.2573 14.2787 9.91419 12.9356 9.91419 11.2787 Z"/></svg>' +
              '<span id="wpm-address"></span>' +
            '</div>' +
            '<div class="wp-modal-sep" id="wpm-addr-sep" style="display:none"></div>' +

            '<div class="wp-modal-detail-item" id="wpm-phone-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.509 8.37614C9.83024 5.92369 7.38659 4.40893 4.9684 5.21552C3.3929 5.74099 2.43384 6.72133 2.1159 8.02892C1.82039 9.24432 2.1284 10.5559 2.60677 11.715C3.57009 14.0492 5.4767 16.3617 6.5562 17.442C7.6108 18.4974 9.91998 20.4123 12.2585 21.3844C13.4197 21.8671 14.7361 22.1805 15.9571 21.8857C17.2712 21.5684 18.2565 20.6044 18.7848 19.0178C19.5902 16.5997 18.0782 14.1542 15.6263 13.4745C13.9503 13.01 12.1927 13.453 10.9932 14.5295C10.7117 14.3115 10.4409 14.0733 10.1827 13.8149C9.92317 13.5552 9.68413 13.2828 9.46537 12.9995C10.5335 11.7996 10.9715 10.0473 10.509 8.37614Z"/></svg>' +
              '<a class="wp-modal-phone-link" id="wpm-phone"></a>' +
            '</div>' +
            '<div class="wp-modal-sep" id="wpm-phone-sep" style="display:none"></div>' +

            '<div class="wp-modal-detail-item" id="wpm-web-item" style="display:none">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
              '<a class="wp-modal-web-link" id="wpm-website" target="_blank" rel="noopener"></a>' +
            '</div>' +
          '</div>' +

          // Tab Reviews
          '<div class="wp-modal-tab-content wp-tab-hidden" id="wpm-tab-reviews">' +
            '<div class="wp-modal-reviews-scroll" id="wpm-reviews-container"></div>' +
          '</div>' +

        '</div>' +

        // Bottom bar
        '<div class="wp-modal-bottom-bar">' +
          '<button class="wp-modal-btn wp-btn-activity" id="wpm-btn-activity">+ Actividad</button>' +
          '<button class="wp-modal-btn wp-btn-visited"  id="wpm-btn-visited">+ Visitado</button>' +
          '<button class="wp-modal-btn wp-btn-visit"    id="wpm-btn-visit">+ Visitar</button>' +
        '</div>' +

      '</div>';

    document.body.appendChild(el);
    this._el   = el;
    this._card = el.querySelector('#wp-modal-card');

    this._wireEvents();
    this._wireDrag();
  }

  // ── Populate ──────────────────────────────────────────────────────

  _populate(place) {
    // Nombre
    var nameEl = document.getElementById('wpm-name');
    if (nameEl) nameEl.textContent = place.name || '';

    // Rating
    var rating  = parseFloat(place.rating) || 0;
    var reviews = parseInt(place.userRatingCount || place.user_ratings_total) || 0;
    document.getElementById('wpm-stars').innerHTML  = rating > 0 ? '<span style="color:#f59e0b">★</span>' : '';
    document.getElementById('wpm-rating').textContent = rating > 0 ? rating.toFixed(1) : '';
    document.getElementById('wpm-reviews').textContent = reviews > 0 ? '(' + reviews.toLocaleString() + ')' : '';

    // Estado abierto/cerrado
    this._populateStatus(place);

    // Fotos
    this._populatePhotos(place);

    // Detalles
    this._populateDetails(place);

    // Reviews
    this._populateReviews(place);

    // Reset tabs a Detalles
    this._activateTab('details');
  }

  _populateStatus(place) {
    var statusEl   = document.getElementById('wpm-status');
    var badgeEl    = document.getElementById('wpm-open-badge');
    var closeRow   = document.getElementById('wpm-close-time-row');
    var closeTimeEl = document.getElementById('wpm-close-time');

    var isOpen = this._isOpenNow(place);
    var closeStr = this._getCloseTime(place);

    if (isOpen === true) {
      statusEl.style.display = '';
      badgeEl.textContent = 'Abierto'; badgeEl.className = 'wp-modal-open-badge open';
      if (closeStr) { closeRow.style.display = ''; closeTimeEl.textContent = 'Cierra a las ' + closeStr; }
      else closeRow.style.display = 'none';
    } else if (isOpen === false) {
      statusEl.style.display = '';
      badgeEl.textContent = 'Cerrado'; badgeEl.className = 'wp-modal-open-badge closed';
      closeRow.style.display = 'none';
    } else {
      statusEl.style.display = 'none';
      closeRow.style.display = 'none';
    }
  }

  _populatePhotos(place) {
    var photosEl = document.getElementById('wpm-photos');
    if (!photosEl) return;

    var urls = [];
    var primary = place.photoUrl || place.photo_url;
    if (primary && typeof primary === 'string') urls.push(primary);
    if (place.photosUrls && Array.isArray(place.photosUrls)) {
      place.photosUrls.forEach(function(u) {
        if (u && typeof u === 'string' && urls.indexOf(u) === -1) urls.push(u);
      });
    }
    var proxied = urls.map(this.proxyPhoto.bind(this)).filter(Boolean);
    var icon    = '💎';

    if (proxied.length === 0) {
      photosEl.innerHTML = '<div class="wp-photo-item"><div class="wp-photo-empty">' + icon + '</div></div>';
    } else {
      photosEl.innerHTML = proxied.map(function(u) {
        return '<div class="wp-photo-item">' +
          '<img src="' + u + '" alt="" ' +
          'onload="this.closest(\'.wp-photo-item\').classList.add(\'loaded\')" ' +
          'onerror="this.closest(\'.wp-photo-item\').innerHTML=\'<div class=wp-photo-empty>' + icon + '</div>\'" />' +
          '</div>';
      }).join('');
      requestAnimationFrame(function() {
        photosEl.querySelectorAll('.wp-photo-item img').forEach(function(img) {
          if (img.complete && img.naturalWidth > 0) img.closest('.wp-photo-item').classList.add('loaded');
        });
      });
    }
  }

  _populateDetails(place) {
    var self = this;

    // Horario
    var hrsRaw = place.openingHoursText || place.openingHours;
    if (hrsRaw && typeof hrsRaw === 'string') { try { hrsRaw = JSON.parse(hrsRaw); } catch(e) { hrsRaw = null; } }
    var dOrder  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    var dLabels = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
    var todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];

    var hoursItem = document.getElementById('wpm-hours-item');
    var hoursSep  = document.getElementById('wpm-hours-sep');
    var hoursText = document.getElementById('wpm-hours-text');
    var hoursList = document.getElementById('wpm-hours-list');

    if (hrsRaw && typeof hrsRaw === 'object') {
      hoursText.textContent = hrsRaw[todayKey] || 'Ver horarios';
      hoursList.innerHTML = dOrder.map(function(d) {
        return '<div class="wp-hours-row' + (d === todayKey ? ' wp-today' : '') + '">' +
          '<span class="wp-hours-day">' + dLabels[d] + '</span>' +
          '<span class="wp-hours-time">' + (hrsRaw[d] || 'Cerrado') + '</span></div>';
      }).join('');
      hoursItem.style.display = '';
      if (hoursSep) hoursSep.style.display = '';

      // Toggle horarios
      var toggle = document.getElementById('wpm-hours-toggle');
      if (toggle) {
        toggle.onclick = function() {
          var open = hoursList.style.display === 'block';
          hoursList.style.display = open ? 'none' : 'block';
          toggle.textContent = open ? '▾' : '▴';
        };
      }
    } else {
      hoursItem.style.display = 'none';
      if (hoursSep) hoursSep.style.display = 'none';
    }

    // Dirección
    var addr = place.formatted_address || place.formattedAddress || place.vicinity || '';
    var addrItem = document.getElementById('wpm-addr-item');
    var addrSep  = document.getElementById('wpm-addr-sep');
    var addrEl   = document.getElementById('wpm-address');
    if (addr) {
      addrEl.textContent = addr;
      addrItem.style.display = ''; if (addrSep) addrSep.style.display = '';
    } else {
      addrItem.style.display = 'none'; if (addrSep) addrSep.style.display = 'none';
    }

    // Teléfono
    var phone = place.phone || place.internationalPhoneNumber || place.formatted_phone_number || '';
    var phoneItem = document.getElementById('wpm-phone-item');
    var phoneSep  = document.getElementById('wpm-phone-sep');
    var phoneLink = document.getElementById('wpm-phone');
    if (phone) {
      phoneLink.textContent = phone; phoneLink.href = 'tel:' + phone;
      phoneItem.style.display = ''; if (phoneSep) phoneSep.style.display = '';
    } else {
      phoneItem.style.display = 'none'; if (phoneSep) phoneSep.style.display = 'none';
    }

    // Website
    var website = place.website || '';
    var webItem = document.getElementById('wpm-web-item');
    var webLink = document.getElementById('wpm-website');
    if (website) {
      var displayUrl = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      webLink.textContent = displayUrl; webLink.href = website;
      webItem.style.display = '';
    } else {
      webItem.style.display = 'none';
    }
  }

  _populateReviews(place) {
    var container = document.getElementById('wpm-reviews-container');
    if (!container) return;
    var revs = place.reviews || [];
    if (revs.length > 0) {
      container.innerHTML = revs.slice(0, 6).map(function(r) {
        var text   = r.text || r.comment || r.body || '';
        var author = r.author_name || r.authorName || r.name || 'Anónimo';
        var stars  = parseFloat(r.rating) || 0;
        var starsH = stars > 0
          ? '<div class="wp-review-stars"><span style="color:#FFD700">' + '★'.repeat(Math.floor(stars)) + '</span><span style="color:#e2e8f0">' + '★'.repeat(5 - Math.floor(stars)) + '</span></div>'
          : '';
        return '<div class="wp-review-card">' + starsH +
          '<div class="wp-review-text">' + text + '</div>' +
          '<div class="wp-review-author">"' + author + '"</div></div>';
      }).join('');
    } else {
      container.innerHTML = '<div style="padding:20px 16px;color:#94a3b8;font-size:14px">Sin reseñas disponibles</div>';
    }
  }

  // ── Tabs ──────────────────────────────────────────────────────────

  _activateTab(tab) {
    var tabs = document.getElementById('wpm-tabs');
    if (tabs) {
      tabs.querySelectorAll('.wp-modal-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.tab === tab);
      });
    }
    var details = document.getElementById('wpm-tab-details');
    var reviews = document.getElementById('wpm-tab-reviews');
    if (details) details.classList.toggle('wp-tab-hidden', tab !== 'details');
    if (reviews) reviews.classList.toggle('wp-tab-hidden', tab !== 'reviews');
  }

  // ── Events ────────────────────────────────────────────────────────

  _wireEvents() {
    var self = this;

    // Backdrop
    document.getElementById('wp-modal-backdrop').addEventListener('click', function() {
      self.hide();
    });

    // Close btn
    document.getElementById('wpm-close-btn').addEventListener('click', function() {
      self.hide();
    });

    // Share
    document.getElementById('wpm-share-btn').addEventListener('click', function() {
      var place = self._place;
      if (!place) return;
      if (navigator.share) {
        navigator.share({ title: place.name, text: place.name, url: window.location.href });
      }
    });

    // Tabs
    var tabs = document.getElementById('wpm-tabs');
    tabs.querySelectorAll('.wp-modal-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self._activateTab(tab.dataset.tab);
      });
    });

    // Bottom bar
    document.getElementById('wpm-btn-activity').addEventListener('click', function() {
      console.log('+ Actividad — próximamente');
    });
    document.getElementById('wpm-btn-visited').addEventListener('click', function() {
      console.log('+ Visitado — próximamente');
    });
    document.getElementById('wpm-btn-visit').addEventListener('click', function() {
      console.log('+ Visitar — próximamente');
    });
  }

  // ── Drag to dismiss / mini mode ───────────────────────────────────

  _wireDrag() {
    var self = this;
    var card = this._card;
    var startY = 0, currentY = 0, dragging = false;
    var fullH = 0;

    var handle = card.querySelector('.wp-modal-handle');

    function onStart(e) {
      startY   = e.touches ? e.touches[0].clientY : e.clientY;
      currentY = startY;
      dragging = true;
      fullH    = card.getBoundingClientRect().height;
      card.style.transition = 'none';
    }

    function onMove(e) {
      if (!dragging) return;
      currentY = e.touches ? e.touches[0].clientY : e.clientY;
      var dy = currentY - startY;
      if (dy < 0) return; // no subir más del 100%
      card.style.transform = 'translateY(' + dy + 'px)';
      e.preventDefault();
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      card.style.transition = '';
      var dy = currentY - startY;

      if (dy > fullH * 0.5) {
        // Descartar completamente
        self.hide();
      } else if (dy > fullH * 0.22) {
        // Mini mode — mostrar solo header + botones
        self._setMini(true);
      } else {
        // Volver a posición completa
        card.style.transform = '';
      }
    }

    handle.addEventListener('touchstart', onStart, { passive: true });
    handle.addEventListener('touchmove',  onMove,  { passive: false });
    handle.addEventListener('touchend',   onEnd,   { passive: true });
    card.addEventListener('touchstart', function(e) {
      if (e.target.closest('.wp-modal-scroll-body') || e.target.closest('.wp-modal-photos')) return;
      onStart(e);
    }, { passive: true });
    card.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      onMove(e);
    }, { passive: false });
    card.addEventListener('touchend', onEnd, { passive: true });
  }

  _setMini(mini) {
    this._mini = mini;
    if (mini) {
      this._card.classList.add('snapped-mini');
    } else {
      this._card.classList.remove('snapped-mini');
      this._card.style.transform = '';
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _isOpenNow(place) {
    var oh = place.regularOpeningHours;
    if (!oh || !oh.periods || !oh.periods.length) return null;
    var now = new Date(), day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var found = false;
    oh.periods.filter(function(p) { return p.open && p.open.day === day; }).forEach(function(p) {
      if (!p.open || !p.close) return;
      var openM  = p.open.hour  * 60 + (p.open.minute  || 0);
      var closeM = p.close.hour * 60 + (p.close.minute || 0);
      if (mins >= openM && mins < closeM) found = true;
    });
    return found;
  }

  _getCloseTime(place) {
    var oh = place.regularOpeningHours;
    if (!oh || !oh.periods) return '';
    var now = new Date(), day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var result = '';
    oh.periods.filter(function(p) { return p.open && p.open.day === day; }).forEach(function(p) {
      if (!p.open || !p.close) return;
      var openM  = p.open.hour  * 60 + (p.open.minute  || 0);
      var closeM = p.close.hour * 60 + (p.close.minute || 0);
      if (mins >= openM && mins < closeM) {
        var h12 = p.close.hour > 12 ? p.close.hour - 12 : (p.close.hour || 12);
        var m0  = (p.close.minute || 0).toString().padStart(2, '0');
        result  = h12 + ':' + m0 + ' ' + (p.close.hour >= 12 ? 'PM' : 'AM');
      }
    });
    return result;
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-place-modal-styles')) return;
    var s = document.createElement('style');
    s.id  = 'wp-place-modal-styles';
    s.textContent = `
      /* ── Overlay ── */
      .wp-place-modal {
        position: fixed; inset: 0; z-index: 99990;
        display: flex; align-items: flex-end;
        pointer-events: none; opacity: 0;
        transition: opacity 0.3s ease;
        padding-top: 60px; box-sizing: border-box;
      }
      .wp-place-modal.visible  { pointer-events: all; opacity: 1; }
      .wp-place-modal.hidden   { display: none; }

      /* ── Backdrop ── */
      .wp-modal-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.3);
        cursor: pointer;
      }

      /* ── Card ── */
      .wp-modal-card {
        position: relative; width: 100%;
        max-height: 89dvh;
        background: white;
        border-radius: 20px 20px 0 0;
        box-shadow: 0 -4px 30px rgba(0,0,0,0.15);
        display: flex; flex-direction: column;
        overflow: hidden;
        transform: translateY(100%);
        transition: transform 0.36s cubic-bezier(0.32,0.72,0,1);
        will-change: transform;
        font-family: 'Inter Tight', system-ui, sans-serif;
      }

      /* ── Mini mode ── */
      .wp-modal-card.snapped-mini {
        transform: translateY(calc(100% - 140px)) !important;
      }
      .wp-modal-card.snapped-mini .wp-modal-photos,
      .wp-modal-card.snapped-mini .wp-modal-tabs,
      .wp-modal-card.snapped-mini .wp-modal-tab-content,
      .wp-modal-card.snapped-mini .wp-modal-scroll-body { display: none; }
      .wp-modal-card.snapped-mini .wp-modal-bottom-bar { display: flex; }
      .wp-modal-card.snapped-mini .wp-modal-handle { background: var(--wp-blue,#2563eb); width: 48px; }

      /* ── Handle ── */
      .wp-modal-handle {
        width: 38px; height: 4px; background: #dde3ea;
        border-radius: 2px; margin: 10px auto 0; flex-shrink: 0;
        transition: background 0.2s, width 0.2s;
      }

      /* ── Top ── */
      .wp-modal-top {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 14px 16px 10px; gap: 12px; flex-shrink: 0;
      }
      .wp-modal-top-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .wp-modal-name {
        font-size: 20px; font-weight: 800; color: #111; margin: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        font-family: 'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        text-transform: capitalize;
      }
      .wp-modal-rating-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
      .wp-modal-stars     { font-size: 13px; color: #f59e0b; }
      .wp-modal-rating-num { font-size: 13px; font-weight: 600; color: #111; }
      .wp-modal-reviews   { font-size: 13px; color: #888; }
      .wp-modal-status-inline { display: inline-flex; align-items: center; gap: 4px; }
      .wp-modal-dot       { color: #bbb; font-size: 13px; }
      .wp-modal-open-badge { font-size: 13px; font-weight: 600; }
      .wp-modal-open-badge.open   { color: #34A853; }
      .wp-modal-open-badge.closed { color: #dc2626; }
      .wp-modal-close-time-row { display: flex; }
      .wp-modal-close-time { font-size: 12px; color: #666; }
      .wp-modal-top-btns  { display: flex; gap: 8px; flex-shrink: 0; padding-top: 2px; }
      .wp-modal-icon-btn  {
        width: 36px; height: 36px; border-radius: 50%;
        border: none; background: #e5e7eb;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; color: #374151; cursor: pointer;
        -webkit-tap-highlight-color: transparent; transition: all 0.15s;
      }
      .wp-modal-icon-btn:active { background: #d1d5db; transform: scale(0.92); }

      /* ── Fotos ── */
      .wp-modal-photos {
        display: flex; gap: 8px;
        padding: 0 16px 12px;
        overflow-x: auto; overflow-y: hidden;
        scrollbar-width: none; flex-shrink: 0;
      }
      .wp-modal-photos::-webkit-scrollbar { display: none; }
      .wp-photo-item {
        width: 220px; height: 160px; border-radius: 14px;
        background: #f1f5f9; flex-shrink: 0; overflow: hidden;
        position: relative;
      }
      .wp-photo-item img {
        width: 100%; height: 100%; object-fit: cover;
        opacity: 0; transition: opacity 0.35s ease;
      }
      .wp-photo-item.loaded img { opacity: 1; }
      .wp-photo-empty {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        font-size: 48px; background: #f1f5f9;
      }

      /* ── Scroll body ── */
      .wp-modal-scroll-body {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        scrollbar-width: none;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .wp-modal-scroll-body::-webkit-scrollbar { display: none; }

      /* ── Tabs ── */
      .wp-modal-tabs {
        display: flex; gap: 0;
        padding: 0 16px;
        border-bottom: 1px solid #f1f5f9;
        flex-shrink: 0;
      }
      .wp-modal-tab {
        padding: 10px 16px; background: none; border: none;
        font-size: 14px; font-weight: 600; color: #9ca3af;
        cursor: pointer; border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: all 0.15s;
        font-family: 'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        -webkit-tap-highlight-color: transparent;
      }
      .wp-modal-tab.active { color: var(--wp-blue,#2563eb); border-bottom-color: var(--wp-blue,#2563eb); }

      .wp-modal-tab-content { padding: 4px 0 8px; }
      .wp-tab-hidden { display: none !important; }

      /* ── Detalles ── */
      .wp-modal-detail-item {
        display: flex; align-items: center; gap: 10px;
        padding: 11px 16px; font-size: 14px; color: #374151;
      }
      .wp-modal-detail-item svg { flex-shrink: 0; color: #6b7280; }
      .wp-modal-hours-toggle {
        margin-left: auto; background: none; border: none;
        font-size: 14px; color: #9ca3af; cursor: pointer; padding: 0 4px;
      }
      .wp-modal-sep { height: 1px; background: #f3f4f6; margin: 0 16px; }
      .wp-modal-phone-link, .wp-modal-web-link {
        color: var(--wp-blue,#2563eb); text-decoration: none; font-weight: 500;
      }
      .wp-hours-row {
        display: flex; justify-content: space-between;
        padding: 6px 16px; font-size: 13px; color: #6b7280;
      }
      .wp-hours-row.wp-today { color: #111; font-weight: 600; }
      .wp-hours-day { min-width: 80px; }
      .wp-hours-time { text-align: right; }

      /* ── Reviews ── */
      .wp-modal-reviews-scroll {
        display: flex; gap: 10px;
        padding: 12px 16px;
        overflow-x: auto; scrollbar-width: none;
      }
      .wp-modal-reviews-scroll::-webkit-scrollbar { display: none; }
      .wp-review-card {
        min-width: 220px; max-width: 260px;
        background: #f9fafb; border-radius: 14px;
        padding: 12px 14px; flex-shrink: 0;
      }
      .wp-review-stars  { margin-bottom: 6px; font-size: 13px; }
      .wp-review-text   { font-size: 13px; color: #374151; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
      .wp-review-author { font-size: 11px; color: #9ca3af; font-style: italic; }

      /* ── Bottom bar ── */
      .wp-modal-bottom-bar {
        display: flex; gap: 8px;
        padding: 10px 16px calc(16px + env(safe-area-inset-bottom,0px));
        border-top: 1px solid #f1f5f9; flex-shrink: 0;
      }
      .wp-modal-btn {
        flex: 1; padding: 11px 8px; border-radius: 12px;
        border: none; font-size: 13px; font-weight: 700;
        cursor: pointer; transition: all 0.15s;
        font-family: 'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        -webkit-tap-highlight-color: transparent;
      }
      .wp-btn-activity {
        background: var(--wp-blue,#2563eb); color: white;
        box-shadow: 0 3px 0 var(--wp-blue-dark,#1a4dbf);
      }
      .wp-btn-activity:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--wp-blue-dark,#1a4dbf); }
      .wp-btn-visited  { background: #f1f5f9; color: #374151; }
      .wp-btn-visit    { background: #f1f5f9; color: #374151; }
      .wp-btn-visited:active, .wp-btn-visit:active { background: #e2e8f0; }
    `;
    document.head.appendChild(s);
  }
}
