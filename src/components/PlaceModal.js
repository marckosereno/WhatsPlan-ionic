// ====================================================================
// WHATSPLAN — src/components/PlaceModal.js
// Ficha de lugar — diseño tipo Insightlancer/travel card
// ====================================================================

export class PlaceModal {
  constructor(opts = {}) {
    this.proxyPhoto     = opts.proxyPhoto     || (u => u);
    this.getCurrentUser = opts.getCurrentUser || (() => null);
    this.onClose        = opts.onClose        || null;
    this._place         = null;
    this._el            = null;
    this._card          = null;
    this._currentPhoto  = 0;
    this._photos        = [];
    this._injectStyles();
    this._build();
  }

  // ── Public ────────────────────────────────────────────────────────

  show(place) {
    this._place = place;
    this._populate(place);
    const card = this._card;
    this._el.classList.remove('wp-pm-hidden');
    this._el.classList.add('wp-pm-visible');
    document.body.classList.add('wp-pm-open');
    // Ocultar topbar del mapa con pulse
    var mapTopbar = document.getElementById('topbar');
    var gsapG = window.gsap;
    if (mapTopbar && gsapG) {
      gsapG.killTweensOf(mapTopbar);
      gsapG.to(mapTopbar, { scale: 0.85, opacity: 0, duration: 0.22, ease: 'power2.in',
        onComplete: function() { mapTopbar.style.visibility = 'hidden'; mapTopbar.style.pointerEvents = 'none'; }
      });
    } else if (mapTopbar) {
      mapTopbar.style.visibility = 'hidden'; mapTopbar.style.pointerEvents = 'none';
    }
    card.style.transition = 'none';
    card.style.transform  = 'translateY(100%)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.style.transition = 'transform 0.38s cubic-bezier(0.32,0.72,0,1)';
      card.style.transform  = 'translateY(0)';
    }));
  }

  hide() {
    this._card.style.transition = 'transform 0.32s cubic-bezier(0.32,0.72,0,1)';
    this._card.style.transform  = 'translateY(100%)';
    setTimeout(() => {
      this._el.classList.add('wp-pm-hidden');
      this._el.classList.remove('wp-pm-visible');
      document.body.classList.remove('wp-pm-open');
      // Restaurar topbar del mapa con pulse
      var mapTopbar = document.getElementById('topbar');
      if (mapTopbar) {
        mapTopbar.style.visibility = '';
        mapTopbar.style.pointerEvents = '';
        var gsapG = window.gsap;
        if (gsapG) {
          gsapG.killTweensOf(mapTopbar);
          gsapG.fromTo(mapTopbar,
            { scale: 0.85, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.32, ease: 'back.out(2)' }
          );
        }
      }
      if (this.onClose) this.onClose();
    }, 340);
  }

  isVisible() { return !this._el.classList.contains('wp-pm-hidden'); }

  // ── Build DOM ─────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.id        = 'wp-place-modal';
    el.className = 'wp-pm wp-pm-hidden';
    el.innerHTML = `
      <div class="wp-pm-backdrop" id="wp-pm-backdrop"></div>
      <div class="wp-pm-card" id="wp-pm-card">

        <!-- ── TOPBAR ficha — reemplaza topbar principal ── -->
        <div class="wp-pm-topbar" id="wp-pm-topbar">
          <!-- Botón back -->
          <button class="wp-pm-tb-btn" id="wp-pm-back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <!-- Nombre del lugar centrado -->
          <div class="wp-pm-tb-title" id="wp-pm-tb-name">Lugar</div>
          <!-- Share -->
          <button class="wp-pm-tb-btn" id="wp-pm-share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>

        <!-- ── HERO — peek carousel, no fullwidth ── -->
        <div class="wp-pm-hero" id="wp-pm-hero">
          <div class="wp-pm-carousel" id="wp-pm-carousel">
            <!-- slides injected by JS -->
          </div>
          <!-- Dots carrusel -->
          <div class="wp-pm-dots" id="wp-pm-dots"></div>
        </div>

        <!-- ── BODY SCROLLABLE ── -->
        <div class="wp-pm-body" id="wp-pm-body">
          <div class="wp-pm-handle"></div>

          <!-- Nombre + badges -->
          <div class="wp-pm-header-row">
            <h2 class="wp-pm-name" id="wp-pm-name"></h2>
            <span class="wp-pm-verified" id="wp-pm-verified" style="display:none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </span>
            <span class="wp-pm-featured-badge" id="wp-pm-featured" style="display:none"></span>
          </div>

          <!-- Dirección -->
          <div class="wp-pm-addr-row" id="wp-pm-addr-row" style="display:none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#6b7280" flex-shrink="0"><path fill-rule="evenodd" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span id="wp-pm-addr"></span>
          </div>

          <!-- Stats: rating · reseñas · precio -->
          <div class="wp-pm-stats-row" id="wp-pm-stats-row">
            <div class="wp-pm-stat" id="wp-pm-stat-rating" style="display:none">
              <span class="wp-pm-stat-val"><span style="color:#f59e0b">★</span> <span id="wp-pm-rating"></span></span>
              <span class="wp-pm-stat-lbl">Rating</span>
            </div>
            <div class="wp-pm-stat-sep" id="wp-pm-sep1" style="display:none"></div>
            <div class="wp-pm-stat" id="wp-pm-stat-reviews" style="display:none">
              <span class="wp-pm-stat-val" id="wp-pm-reviews-count"></span>
              <span class="wp-pm-stat-lbl">Reseñas</span>
            </div>
            <div class="wp-pm-stat-sep" id="wp-pm-sep2" style="display:none"></div>
            <div class="wp-pm-stat" id="wp-pm-stat-price" style="display:none">
              <span class="wp-pm-stat-val" id="wp-pm-price"></span>
              <span class="wp-pm-stat-lbl">Precio</span>
            </div>
          </div>

          <!-- Botones acción: teléfono · web · maps -->
          <div class="wp-pm-actions-row" id="wp-pm-actions-row">
            <button class="wp-pm-action-btn" id="wp-pm-btn-phone" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.72A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z"/></svg>
              <span>Llamar</span>
            </button>
            <button class="wp-pm-action-btn" id="wp-pm-btn-web" style="display:none">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              <span>Web</span>
            </button>
            <button class="wp-pm-action-btn" id="wp-pm-btn-maps">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span>Cómo llegar</span>
            </button>
          </div>

          <!-- Separador -->
          <div class="wp-pm-divider"></div>

          <!-- Descripción -->
          <div class="wp-pm-desc-block" id="wp-pm-desc-block" style="display:none">
            <div class="wp-pm-section-title">Sobre el lugar</div>
            <div class="wp-pm-desc-text" id="wp-pm-desc-text"></div>
            <button class="wp-pm-read-more" id="wp-pm-read-more" style="display:none">Leer más</button>
            <div class="wp-pm-divider"></div>
          </div>

          <!-- Servicios: dineIn · takeout · delivery -->
          <div class="wp-pm-services-block" id="wp-pm-services-block" style="display:none">
            <div class="wp-pm-section-title">Servicios</div>
            <div class="wp-pm-tags-row" id="wp-pm-services-tags"></div>
            <div class="wp-pm-divider"></div>
          </div>

          <!-- Subcategory tags -->
          <div class="wp-pm-tags-block" id="wp-pm-tags-block" style="display:none">
            <div class="wp-pm-section-title">Especialidades</div>
            <div class="wp-pm-tags-row" id="wp-pm-tags-row"></div>
            <div class="wp-pm-divider"></div>
          </div>

          <!-- Horarios -->
          <div class="wp-pm-hours-block" id="wp-pm-hours-block" style="display:none">
            <div class="wp-pm-hours-trigger" id="wp-pm-hours-trigger">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16zm1-8V7a1 1 0 00-2 0v5a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L13 11.586z"/></svg>
              <span class="wp-pm-hours-today" id="wp-pm-hours-today"></span>
              <span class="wp-pm-hours-status" id="wp-pm-hours-status"></span>
              <svg class="wp-pm-chevron" id="wp-pm-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="wp-pm-hours-list" id="wp-pm-hours-list"></div>
            <div class="wp-pm-divider"></div>
          </div>

          <!-- Reviews -->
          <div class="wp-pm-reviews-block" id="wp-pm-reviews-block" style="display:none">
            <div class="wp-pm-section-title">Reseñas</div>
            <div class="wp-pm-reviews-list" id="wp-pm-reviews-list"></div>
          </div>

          <div style="height:16px"></div>
        </div>

        <!-- ── CTA BOTTOM ── -->
        <div class="wp-pm-bottom">
          <button class="wp-pm-cta" id="wp-pm-cta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            Planear visita
          </button>
        </div>

      </div>`;

    document.body.appendChild(el);
    this._el   = el;
    this._card = el.querySelector('#wp-pm-card');
    this._wireEvents();
  }

  // ── Populate ──────────────────────────────────────────────────────

  _populate(place) {
    this._populateHero(place);
    // Set topbar search label to place name
    const tbName = this._el.querySelector('#wp-pm-tb-name');
    if (tbName) tbName.textContent = place.name || 'Detalles';
    this._populateHeader(place);
    this._populateAddress(place);
    this._populateStats(place);
    this._populateActions(place);
    this._populateDescription(place);
    this._populateServices(place);
    this._populateTags(place);
    this._populateHours(place);
    this._populateReviews(place);
    // scroll body to top
    const body = this._el.querySelector('#wp-pm-body');
    if (body) body.scrollTop = 0;
  }

  _populateHero(place) {
    const carousel = this._el.querySelector('#wp-pm-carousel');
    const dotsEl   = this._el.querySelector('#wp-pm-dots');

    let photos = [];
    if (place.photoUrl) photos.push(place.photoUrl);
    if (place.photosUrls) place.photosUrls.forEach(u => { if (u && !photos.includes(u)) photos.push(u); });
    this._photos = photos.map(u => this.proxyPhoto(u)).filter(Boolean);
    this._currentPhoto = 0;

    // Si no hay fotos, emoji placeholder
    if (this._photos.length === 0) {
      carousel.innerHTML = `<div class="wp-pm-slide wp-pm-slide-placeholder"><span>${place.emoji || '📍'}</span></div>`;
      dotsEl.style.display = 'none';
      return;
    }

    // Slides peek carousel
    carousel.innerHTML = this._photos.map((u, i) =>
      `<div class="wp-pm-slide" data-i="${i}" style="background-image:url(${u})"></div>`
    ).join('');

    // Dots
    if (this._photos.length > 1) {
      dotsEl.innerHTML = this._photos.slice(0,8).map((_, i) =>
        `<span class="wp-pm-dot${i===0?' active':''}" data-i="${i}"></span>`
      ).join('');
      dotsEl.querySelectorAll('.wp-pm-dot').forEach(dot => {
        dot.addEventListener('click', () => this._goToPhoto(parseInt(dot.dataset.i)));
      });
    } else {
      dotsEl.style.display = 'none';
    }

    // Swipe
    this._wireHeroSwipe();
    // Set initial position
    this._goToPhoto(0, false);
  }

  _goToPhoto(i, animate = true) {
    this._currentPhoto = i;
    const carousel = this._el.querySelector('#wp-pm-carousel');
    if (!carousel) return;
    // Each slide is 75% width, centered with peek on sides
    // Offset = i * slideWidth (75vw) - centering offset
    const slideW = carousel.offsetWidth * 0.46 + 10; // 46% + gap
    carousel.style.transition = animate ? 'transform 0.35s cubic-bezier(0.32,0.72,0,1)' : 'none';
    carousel.style.transform  = `translateX(calc(4% - ${i * slideW}px))`;
    this._el.querySelectorAll('.wp-pm-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
    // Active slide full size, others smaller and shifted down
    this._el.querySelectorAll('.wp-pm-slide').forEach((s, idx) => {
      if (idx === i) {
        s.style.transform = 'scale(1) translateY(0)';
        s.style.opacity   = '1';
      } else {
        s.style.transform = 'scale(0.82) translateY(8%)';
        s.style.opacity   = '0.5';
      }
    });
  }

  _populateHeader(place) {
    this._el.querySelector('#wp-pm-name').textContent = place.name || '';

    const verified = this._el.querySelector('#wp-pm-verified');
    const featured = this._el.querySelector('#wp-pm-featured');
    if (place.featured === 'verified' || place.featured === 'premium') {
      verified.style.display = '';
    } else {
      verified.style.display = 'none';
    }
    if (place.featured) {
      featured.style.display = '';
      featured.textContent = place.featured === 'premium' ? '⭐ Premium' : place.featured === 'featured' ? '✦ Destacado' : '✓ Verificado';
      featured.className = `wp-pm-featured-badge wp-pm-badge-${place.featured}`;
    } else {
      featured.style.display = 'none';
    }
  }

  _populateAddress(place) {
    const row  = this._el.querySelector('#wp-pm-addr-row');
    const addr = place.formattedAddress || place.vicinity || '';
    if (addr) {
      row.style.display = '';
      this._el.querySelector('#wp-pm-addr').textContent = addr;
    } else {
      row.style.display = 'none';
    }
  }

  _populateStats(place) {
    const rating  = parseFloat(place.rating) || 0;
    const reviews = parseInt(place.userRatingCount) || 0;
    const price   = place.priceLevel;

    const show = (id, val) => {
      const el = this._el.querySelector(id);
      if (el) el.style.display = val ? '' : 'none';
    };

    if (rating > 0) {
      this._el.querySelector('#wp-pm-rating').textContent = rating.toFixed(1);
      show('#wp-pm-stat-rating', true);
      show('#wp-pm-sep1', reviews > 0 || price);
    }
    if (reviews > 0) {
      this._el.querySelector('#wp-pm-reviews-count').textContent = reviews.toLocaleString();
      show('#wp-pm-stat-reviews', true);
      show('#wp-pm-sep2', !!price);
    }
    if (price) {
      this._el.querySelector('#wp-pm-price').textContent = '$'.repeat(Math.min(price, 4));
      show('#wp-pm-stat-price', true);
    }

    // Si no hay ningún stat, ocultar row
    const statsRow = this._el.querySelector('#wp-pm-stats-row');
    if (!rating && !reviews && !price) statsRow.style.display = 'none';
    else statsRow.style.display = '';
  }

  _populateActions(place) {
    const btnPhone = this._el.querySelector('#wp-pm-btn-phone');
    const btnWeb   = this._el.querySelector('#wp-pm-btn-web');
    const btnMaps  = this._el.querySelector('#wp-pm-btn-maps');

    const phone = place.phone || place.internationalPhoneNumber || '';
    if (phone) {
      btnPhone.style.display = '';
      btnPhone.onclick = () => window.open('tel:' + phone);
    }

    const website = place.website || '';
    if (website) {
      btnWeb.style.display = '';
      btnWeb.onclick = () => window.open(website, '_blank', 'noopener');
    }

    if (place.lat && place.lng) {
      btnMaps.onclick = () => window.open(
        place.googleMapsUri || `https://maps.google.com/?q=${place.lat},${place.lng}`,
        '_blank', 'noopener'
      );
    }
  }

  _populateDescription(place) {
    const block = this._el.querySelector('#wp-pm-desc-block');
    const text  = place.description || place.editorialSummary || '';
    if (!text) { block.style.display = 'none'; return; }

    block.style.display = '';
    const descEl = this._el.querySelector('#wp-pm-desc-text');
    const readMore = this._el.querySelector('#wp-pm-read-more');
    const MAX = 160;

    if (text.length > MAX) {
      descEl.textContent = text.slice(0, MAX) + '...';
      readMore.style.display = '';
      let expanded = false;
      readMore.onclick = () => {
        expanded = !expanded;
        descEl.textContent = expanded ? text : text.slice(0, MAX) + '...';
        readMore.textContent = expanded ? 'Leer menos' : 'Leer más';
      };
    } else {
      descEl.textContent = text;
      readMore.style.display = 'none';
    }
  }

  _populateServices(place) {
    const block = this._el.querySelector('#wp-pm-services-block');
    const tags  = this._el.querySelector('#wp-pm-services-tags');
    const items = [];

    if (place.dineIn   === true)  items.push({ icon: '🍽️', label: 'Comer aquí' });
    if (place.takeout  === true)  items.push({ icon: '🥡', label: 'Para llevar' });
    if (place.delivery === true)  items.push({ icon: '🛵', label: 'Delivery' });

    const isOpen = this._isOpenNow(place);
    if (isOpen === true)  items.push({ icon: '🟢', label: 'Abierto ahora' });
    if (isOpen === false) items.push({ icon: '🔴', label: 'Cerrado' });

    if (items.length === 0) { block.style.display = 'none'; return; }
    block.style.display = '';
    tags.innerHTML = items.map(it =>
      `<span class="wp-pm-tag">${it.icon} ${it.label}</span>`
    ).join('');
  }

  _populateTags(place) {
    const block   = this._el.querySelector('#wp-pm-tags-block');
    const tagsRow = this._el.querySelector('#wp-pm-tags-row');
    const tagArr  = place.subcategoryTags || [];
    if (tagArr.length === 0) { block.style.display = 'none'; return; }
    block.style.display = '';
    tagsRow.innerHTML = tagArr.map(t =>
      `<span class="wp-pm-tag wp-pm-tag-accent">${t}</span>`
    ).join('');
  }

  _populateHours(place) {
    const block   = this._el.querySelector('#wp-pm-hours-block');
    const hrsRaw  = place.openingHoursText;
    if (!hrsRaw || typeof hrsRaw !== 'object') { block.style.display = 'none'; return; }

    block.style.display = '';
    const DAY_ORDER  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const DAY_LABELS = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
    const todayKey   = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];

    // Today row
    const todayText = hrsRaw[todayKey] || 'Sin horario';
    this._el.querySelector('#wp-pm-hours-today').textContent = `Hoy: ${todayText}`;

    // Status
    const isOpen = this._isOpenNow(place);
    const statusEl = this._el.querySelector('#wp-pm-hours-status');
    if (isOpen === true)  { statusEl.textContent = 'Abierto'; statusEl.className = 'wp-pm-hours-status wp-pm-open'; }
    else if (isOpen === false) { statusEl.textContent = 'Cerrado'; statusEl.className = 'wp-pm-hours-status wp-pm-closed'; }
    else statusEl.textContent = '';

    // List
    const list = this._el.querySelector('#wp-pm-hours-list');
    list.innerHTML = DAY_ORDER.map(d =>
      `<div class="wp-pm-hours-row${d === todayKey ? ' wp-pm-today' : ''}">
        <span class="wp-pm-hours-day">${DAY_LABELS[d]}</span>
        <span class="wp-pm-hours-time">${hrsRaw[d] || 'Cerrado'}</span>
      </div>`
    ).join('');

    // Toggle
    let open = false;
    const trigger = this._el.querySelector('#wp-pm-hours-trigger');
    const chevron = this._el.querySelector('#wp-pm-chevron');
    trigger.onclick = () => {
      open = !open;
      list.classList.toggle('expanded', open);
      chevron.style.transform = open ? 'rotate(180deg)' : '';
    };
  }

  _populateReviews(place) {
    const block = this._el.querySelector('#wp-pm-reviews-block');
    const list  = this._el.querySelector('#wp-pm-reviews-list');
    const revs  = place.reviews || [];
    if (revs.length === 0) { block.style.display = 'none'; return; }

    block.style.display = '';
    list.innerHTML = revs.slice(0, 5).map(r => {
      const name     = r.author_name || r.authorName || 'Anónimo';
      const initial  = name.charAt(0).toUpperCase();
      const stars    = parseFloat(r.rating) || 0;
      const time     = r.relative_time_description || r.relativeTime || '';
      const text     = r.text || r.comment || '';
      return `<div class="wp-pm-review-card">
        <div class="wp-pm-review-top">
          <div class="wp-pm-review-avatar">${initial}</div>
          <div class="wp-pm-review-info">
            <span class="wp-pm-review-name">${name}</span>
            ${time ? `<span class="wp-pm-review-time">${time}</span>` : ''}
          </div>
          ${stars > 0 ? `<div class="wp-pm-review-stars">${'★'.repeat(Math.round(stars))}<span style="color:#e2e8f0">${'★'.repeat(5-Math.round(stars))}</span></div>` : ''}
        </div>
        ${text ? `<p class="wp-pm-review-text">${text}</p>` : ''}
      </div>`;
    }).join('');
  }

  // ── Events ────────────────────────────────────────────────────────

  _wireEvents() {
    this._el.querySelector('#wp-pm-backdrop').addEventListener('click', () => this.hide());
    this._el.querySelector('#wp-pm-back').addEventListener('click',    () => this.hide());
    this._el.querySelector('#wp-pm-share').addEventListener('click', () => {
      if (navigator.share && this._place) navigator.share({ title: this._place.name, url: window.location.href });
    });
    this._el.querySelector('#wp-pm-cta').addEventListener('click', () => {
      console.log('Planear visita:', this._place);
    });
  }

  _wireHeroSwipe() {
    const hero = this._el.querySelector('#wp-pm-hero');
    let startX = 0, startT = 0;
    hero.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startT = Date.now();
    }, { passive: true });
    hero.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - startX;
      const dt = Date.now() - startT;
      if (Math.abs(dx) < 30 || dt > 400) return;
      const n = this._photos.length;
      if (n < 2) return;
      let next = this._currentPhoto + (dx < 0 ? 1 : -1);
      next = Math.max(0, Math.min(n - 1, next));
      this._goToPhoto(next);
    }, { passive: true });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  _isOpenNow(place) {
    const oh = place.regularOpeningHours;
    if (!oh || !oh.periods || !oh.periods.length) return null;
    const now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    return oh.periods.some(p => {
      if (!p.open || !p.close || p.open.day !== day) return false;
      const o = p.open.hour * 60 + (p.open.minute || 0);
      const c = p.close.hour * 60 + (p.close.minute || 0);
      return mins >= o && mins < c;
    });
  }

  // ── Styles ────────────────────────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('wp-pm-styles')) return;
    const s = document.createElement('style');
    s.id = 'wp-pm-styles';
    s.textContent = `
      /* ── Modal wrapper ── */
      .wp-pm {
        position:fixed; inset:0; z-index:9998;
        display:flex; flex-direction:column;
        pointer-events:none;
      }
      .wp-pm-hidden { display:none !important; }
      .wp-pm.wp-pm-visible { pointer-events:all; }

      .wp-pm-backdrop { display:none; }

      /* Card ocupa toda la pantalla pero el top es transparente */
      .wp-pm-card {
        position:absolute; inset:0;
        display:flex; flex-direction:column;
        overflow:hidden;
        transform:translateY(100%);
        will-change:transform;
        font-family:'Inter Tight',system-ui,sans-serif;
        /* Sin background en la card — el topbar y body tienen su propio bg */
        background:transparent;
      }

      /* Sombra azul top más oscura y extendida cuando ficha está abierta */
      body.wp-pm-open .ion-app::before,
      body.wp-pm-open ion-app::before {
        background:linear-gradient(to bottom,
          rgba(59,130,246,0.75) 0%,
          rgba(96,165,250,0.55) 45%,
          rgba(147,197,253,0.2) 75%,
          transparent 100%) !important;
        height:200px !important;
      }

      /* ── Topbar ficha — mismo espacio que #topbar del mapa ── */
      .wp-pm-topbar {
        position:absolute;
        top:0; left:0; right:0;
        padding-top:calc(12px + env(safe-area-inset-top, 0px));
        padding-left:12px; padding-right:12px; padding-bottom:0;
        display:flex; align-items:center; gap:8px;
        pointer-events:auto;
        z-index:2;
        background:transparent;
      }
      /* Sombra azul más oscura y extendida cuando la ficha está abierta */
      .wp-pm:not(.wp-pm-hidden) ~ * #topbar::before,
      .wp-pm-card::before {
        content:''; position:absolute;
        top:0; left:0; right:0;
        height:calc(env(safe-area-inset-top, 0px) + 200px);
        background:linear-gradient(to bottom,
          rgba(96,165,250,0.75) 0%,
          rgba(147,197,253,0.45) 55%,
          transparent 100%);
        backdrop-filter:blur(0.5px);
        pointer-events:none;
        z-index:0;
      }
      /* Botones topbar: 44px como chips del sistema */
      .wp-pm-tb-btn {
        width:44px; height:44px; border-radius:9999px; flex-shrink:0;
        border:none; background:rgba(255,255,255,0.88);
        backdrop-filter:blur(16px) saturate(1.8);
        -webkit-backdrop-filter:blur(16px) saturate(1.8);
        box-shadow:0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
        display:flex; align-items:center; justify-content:center;
        color:#374151; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
      }
      .wp-pm-tb-btn:active { transform:scale(0.92); }
      /* Nombre centrado en topbar — outline blanco */
      .wp-pm-tb-title {
        flex:1; text-align:center;
        font-size:16px; font-weight:700; color:#111;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        -webkit-text-stroke: 3.5px rgba(255,255,255,0.95);
        paint-order: stroke fill;
        letter-spacing:-0.01em;
      }

      /* Fondo blanco difuminado detrás del carousel —
         sube desde el panel y se pierde hacia la sombra azul del top */
      .wp-pm-hero::before {
        content:'';
        position:absolute; inset:0;
        background:linear-gradient(to bottom,
          rgba(255,255,255,0)    0%,
          rgba(255,255,255,0)    8%,
          rgba(255,255,255,0.75) 22%,
          rgba(255,255,255,0.96) 50%,
          rgba(255,255,255,1)    72%);
        z-index:0;
        pointer-events:none;
      }
      .wp-pm-carousel { position:relative; z-index:1; }
      .wp-pm-dots     { z-index:2; }

      /* ── Hero peek carousel — portrait, 2 slides + peek 3a ── */
      .wp-pm-hero {
        position:absolute;
        top:calc(env(safe-area-inset-top, 0px) + 68px);
        left:0; right:0;
        height:290px;
        overflow:hidden; background:transparent;
        z-index:1;
        /* padding top separa del topbar, padding bottom separa del panel */
        padding:14px 0 18px;
      }
      /* Carousel track */
      .wp-pm-carousel {
        display:flex; align-items:center;
        height:100%;
        will-change:transform;
      }
      /* Slide portrait: active más grande, inactive más pequeño y bajado */
      .wp-pm-slide {
        min-width:46%; height:100%;
        border-radius:22px;
        background:center/cover no-repeat #e2e8f0;
        flex-shrink:0; margin:0 5px;
        transition:transform 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.35s ease;
        transform:scale(0.82) translateY(8%);
        opacity:0.5;
        overflow:hidden;
        align-self:flex-end;
      }
      .wp-pm-slide-placeholder {
        display:flex; align-items:center; justify-content:center;
        font-size:64px; background:#f1f5f9;
        transform:scale(1) !important; opacity:1 !important;
      }

      /* Dots */
      .wp-pm-dots {
        position:absolute; bottom:4px; left:50%; transform:translateX(-50%);
        display:flex; gap:5px; align-items:center;
      }
      .wp-pm-dot {
        width:5px; height:5px; border-radius:9999px;
        background:#cbd5e1; cursor:pointer;
        transition:all 0.2s ease;
      }
      .wp-pm-dot.active { background:#3b82f6; width:14px; }

      /* ── Body — panel blanco con border-radius:32px que sube desde abajo ── */
      .wp-pm-body {
        position:absolute;
        /* top = safe-area + 68px (topbar) + 290px (hero) */
        top:calc(env(safe-area-inset-top, 0px) + 358px);
        left:0; right:0; bottom:0;
        overflow-y:auto; overflow-x:hidden;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none;
        background:#fff;
        border-radius:0;
        padding-top:8px;
        padding-bottom:calc(64px + env(safe-area-inset-bottom,0px));
      }
      .wp-pm-body::-webkit-scrollbar { display:none; }
      .wp-pm-handle { display:none; }

      /* Header row — nombre + badges */
      .wp-pm-header-row {
        display:flex; align-items:flex-start; flex-wrap:wrap; gap:6px;
        padding:0 16px 6px;
      }
      .wp-pm-name {
        font-size:20px; font-weight:800; color:#111; margin:0; flex:1;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        line-height:1.2; text-transform:capitalize;
      }
      .wp-pm-verified { display:flex; align-items:center; margin-top:3px; }
      .wp-pm-featured-badge {
        font-size:10px; font-weight:700; padding:3px 8px;
        border-radius:9999px; margin-top:3px; white-space:nowrap;
      }
      .wp-pm-badge-featured  { background:#fef3c7; color:#d97706; }
      .wp-pm-badge-verified  { background:#dbeafe; color:#1d4ed8; }
      .wp-pm-badge-premium   { background:#fce7f3; color:#be185d; }

      /* Dirección — font:13px gap:6px */
      .wp-pm-addr-row {
        display:flex; align-items:flex-start; gap:6px;
        padding:0 16px 10px; font-size:13px; color:#6b7280; line-height:1.4;
      }
      .wp-pm-addr-row svg { flex-shrink:0; margin-top:1px; }

      /* Stats row — 3 columnas con separadores */
      .wp-pm-stats-row {
        display:flex; align-items:stretch;
        margin:0 16px 12px;
        background:#f8fafc; border-radius:22px;
        overflow:hidden;
      }
      .wp-pm-stat {
        flex:1; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        padding:10px 8px; gap:2px;
      }
      .wp-pm-stat-val {
        font-size:15px; font-weight:700; color:#111;
        display:flex; align-items:center; gap:3px;
      }
      .wp-pm-stat-lbl {
        font-size:10px; color:#9ca3af; font-weight:500;
        text-transform:uppercase; letter-spacing:0.04em;
      }
      .wp-pm-stat-sep {
        width:1px; background:#e2e8f0; margin:10px 0;
      }

      /* Actions row — botones 44px */
      .wp-pm-actions-row {
        display:flex; gap:8px; padding:0 16px 12px;
      }
      .wp-pm-action-btn {
        flex:1; height:44px; border-radius:9999px;
        border:1.5px solid #e2e8f0; background:#fff;
        display:flex; align-items:center; justify-content:center; gap:6px;
        font-size:13px; font-weight:600; color:#374151; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1);
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-action-btn:active { transform:scale(0.96); background:#f8fafc; }

      /* Divider */
      .wp-pm-divider { height:1px; background:#f1f5f9; margin:4px 16px 12px; }

      /* Section title */
      .wp-pm-section-title {
        font-size:14px; font-weight:700; color:#111;
        padding:0 16px 8px;
      }

      /* Description */
      .wp-pm-desc-block { padding-bottom:4px; }
      .wp-pm-desc-text {
        font-size:14px; line-height:1.6; color:#555;
        padding:0 16px 4px;
      }
      .wp-pm-read-more {
        border:none; background:none; color:#3b82f6;
        font-size:14px; font-weight:600; cursor:pointer;
        padding:0 16px 8px;
        font-family:'Inter Tight',system-ui,sans-serif;
      }

      /* Tags — border-radius:9999px, height derivada del padding */
      .wp-pm-tags-row {
        display:flex; flex-wrap:wrap; gap:8px; padding:0 16px 8px;
      }
      .wp-pm-tag {
        height:36px; padding:0 14px; border-radius:9999px;
        background:#f1f5f9; color:#374151;
        font-size:13px; font-weight:500;
        display:flex; align-items:center; gap:4px;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-tag-accent {
        background:#eff6ff; color:#1d4ed8;
      }

      /* Horarios */
      .wp-pm-hours-block { }
      .wp-pm-hours-trigger {
        display:flex; align-items:center; gap:8px;
        padding:0 16px 8px; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .wp-pm-hours-today {
        font-size:14px; color:#374151; font-weight:500; flex:1;
      }
      .wp-pm-hours-status {
        font-size:12px; font-weight:700;
        padding:2px 8px; border-radius:9999px;
      }
      .wp-pm-open   { background:#dcfce7; color:#16a34a; }
      .wp-pm-closed { background:#fee2e2; color:#dc2626; }
      .wp-pm-chevron { transition:transform 0.25s ease; flex-shrink:0; }
      .wp-pm-hours-list {
        max-height:0; overflow:hidden;
        transition:max-height 0.3s ease;
        padding:0 16px;
      }
      .wp-pm-hours-list.expanded { max-height:300px; }
      .wp-pm-hours-row {
        display:flex; justify-content:space-between;
        padding:7px 0; font-size:13px; color:#6b7280;
        border-bottom:1px solid #f9fafb;
      }
      .wp-pm-hours-row:last-child { border-bottom:none; }
      .wp-pm-hours-day { min-width:90px; }
      .wp-pm-today .wp-pm-hours-day,
      .wp-pm-today .wp-pm-hours-time { color:#111; font-weight:700; }

      /* Reviews */
      .wp-pm-reviews-block { padding-bottom:8px; }
      .wp-pm-reviews-list {
        display:flex; flex-direction:column; gap:8px;
        padding:0 16px;
      }
      .wp-pm-review-card {
        background:#f9fafb; border-radius:22px;
        padding:12px 14px;
      }
      .wp-pm-review-top {
        display:flex; align-items:center; gap:8px; margin-bottom:6px;
      }
      /* avatar: 36px sistema WhatsPlan */
      .wp-pm-review-avatar {
        width:36px; height:36px; border-radius:9999px; flex-shrink:0;
        background:linear-gradient(135deg,#3b82f6,#8b5cf6);
        color:#fff; font-size:14px; font-weight:700;
        display:flex; align-items:center; justify-content:center;
      }
      .wp-pm-review-info { display:flex; flex-direction:column; flex:1; gap:1px; }
      .wp-pm-review-name { font-size:13px; font-weight:700; color:#111; }
      .wp-pm-review-time { font-size:10px; color:#9ca3af; }
      .wp-pm-review-stars { font-size:13px; color:#f59e0b; margin-left:auto; }
      .wp-pm-review-text {
        font-size:13px; color:#555; line-height:1.55; margin:0;
        display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;
      }

      /* ── CTA bottom bar — fixed at bottom ── */
      .wp-pm-bottom {
        position:absolute; bottom:0; left:0; right:0;
        padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));
        background:#fff;
        box-shadow:0 -16px 24px 8px white;
        z-index:2;
      }
      .wp-pm-cta {
        width:100%; height:44px; border-radius:9999px; border:none;
        background:linear-gradient(135deg,#3b82f6,#1d4ed8);
        color:#fff; font-size:15px; font-weight:600; cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:8px;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1);
        font-family:'Inter Tight',system-ui,sans-serif;
        box-shadow:0 4px 20px rgba(37,99,235,0.35);
      }
      .wp-pm-cta:active { transform:scale(0.97); filter:brightness(0.92); }
    `;
    document.head.appendChild(s);
  }
}
