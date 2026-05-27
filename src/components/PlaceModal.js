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

          <!-- AI Description -->
          <div class="wp-pm-ai-block" id="wp-pm-ai-block" style="display:none">
            <div class="wp-pm-ai-text" id="wp-pm-ai-text"></div>
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
    this._populateAI(place);
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

    // Dots — always rebuild, show for any count
    dotsEl.innerHTML = '';
    dotsEl.style.display = '';
    this._photos.slice(0, 9).forEach((_, i) => {
      const d = document.createElement('span');
      d.className = 'wp-pm-dot' + (i === 0 ? ' active' : '');
      d.dataset.i = i;
      d.addEventListener('click', () => this._goToPhoto(i));
      dotsEl.appendChild(d);
    });

    // Set initial position first so layout is stable
    requestAnimationFrame(() => {
      this._goToPhoto(0, false);
    });
    // Wire swipe once
    if (!this._swipeWired) {
      this._wireHeroSwipe();
      this._swipeWired = true;
    }
  }

  _goToPhoto(i, animate = true) {
    const n = this._photos.length;
    if (n === 0) return;
    // Clamp
    i = Math.max(0, Math.min(n - 1, i));
    this._currentPhoto = i;
    const carousel = this._el.querySelector('#wp-pm-carousel');
    if (!carousel) return;
    // Slide width: 44% of carousel + 8px gap, calculated once from actual DOM
    const slideW = carousel.getBoundingClientRect().width * 0.44 + 8;
    carousel.style.transition = animate ? 'transform 0.32s cubic-bezier(0.32,0.72,0,1)' : 'none';
    carousel.style.transform  = `translateX(${8 - i * slideW}px)`;
    this._el.querySelectorAll('.wp-pm-dot').forEach((d, idx) =>
      d.classList.toggle('active', idx === i)
    );
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

  _populateAI(place) {
    const block  = this._el.querySelector('#wp-pm-ai-block');
    const textEl = this._el.querySelector('#wp-pm-ai-text');
    if (!block || !textEl) return;

    // Hide initially
    block.style.display = 'none';
    textEl.textContent  = '';

    const placeId = place.place_id || place.id;
    if (!placeId) return;

    // Check if place already has ai_descriptions
    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];
    if (existing.length > 0) {
      // Show a random one immediately
      const desc = existing[Math.floor(Math.random() * existing.length)];
      block.style.display = '';
      this._typewrite(textEl, desc);
      return;
    }

    // Mostrar skeleton mientras genera
    block.style.display = '';
    textEl.innerHTML = '<span class="wp-pm-ai-loading">✦ Generando descripción...</span>';

    // Generate via POST
    fetch('/api/groq-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId }),
    })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      if (data.description) {
        textEl.textContent = '';
        this._typewrite(textEl, data.description);
      } else {
        block.style.display = 'none';
      }
    })
    .catch(err => {
      console.warn('[AI desc]', err.message || err);
      textEl.textContent = '';
      block.style.display = 'none';
    });
  }

  _typewrite(el, text) {
    el.textContent = '';
    let i = 0;
    const step = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(step, 18);
      }
    };
    step();
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
    const self = this;
    const hero = this._el.querySelector('#wp-pm-hero');
    let startX = 0, startT = 0, lastX = 0, lastT = 0;
    let tracking = false, baseX = 0, velX = 0;
    let rafId = null;

    const getCarousel = () => self._el.querySelector('#wp-pm-carousel');
    const getSlideW   = () => {
      const c = getCarousel();
      return c ? c.getBoundingClientRect().width * 0.44 + 8 : 180;
    };
    const snapX = i => 8 - i * getSlideW();

    // Animated spring snap
    const springTo = (targetX, fromX, fromV) => {
      if (rafId) cancelAnimationFrame(rafId);
      const stiffness = 280, damping = 28, mass = 1;
      let x = fromX, v = fromV;
      const step = () => {
        const f = -stiffness * (x - targetX) - damping * v;
        v += (f / mass) * (1/60);
        x += v * (1/60);
        const c = getCarousel();
        if (c) { c.style.transition = 'none'; c.style.transform = `translateX(${x}px)`; }
        if (Math.abs(x - targetX) < 0.5 && Math.abs(v) < 0.5) {
          if (c) c.style.transform = `translateX(${targetX}px)`;
          return;
        }
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    hero.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      startX = lastX = e.touches[0].clientX;
      startT = lastT = Date.now();
      tracking = true;
      velX = 0;
      const c = getCarousel();
      // Read current actual translateX to start from
      if (c) {
        c.style.transition = 'none';
        const mat = new DOMMatrix(getComputedStyle(c).transform);
        baseX = mat.m41;
      } else {
        baseX = snapX(self._currentPhoto);
      }
    }, { passive: true });

    hero.addEventListener('touchmove', e => {
      if (!tracking || e.touches.length !== 1) return;
      const x  = e.touches[0].clientX;
      const dx = x - startX;
      const now = Date.now();
      // Velocity tracking
      velX = (x - lastX) / Math.max(1, now - lastT) * 16;
      lastX = x; lastT = now;

      const n = self._photos.length;
      const slideW = getSlideW();
      // Rubber band at edges
      let tx = baseX + dx;
      const minX = snapX(n - 1);
      const maxX = snapX(0);
      if (tx > maxX)      tx = maxX + (tx - maxX) * 0.18;
      else if (tx < minX) tx = minX + (tx - minX) * 0.18;

      const c = getCarousel();
      if (c) c.style.transform = `translateX(${tx}px)`;
    }, { passive: true });

    const onEnd = e => {
      if (!tracking) return;
      tracking = false;
      const endX = e.changedTouches ? e.changedTouches[0].clientX : lastX;
      const dx   = endX - startX;
      const dt   = Date.now() - startT;
      const n    = self._photos.length;
      const slideW = getSlideW();

      // How many slides to advance based on drag distance + velocity
      const totalDx  = baseX + dx - snapX(self._currentPhoto);
      const momentum = velX * 8; // project velocity forward
      const total    = dx + momentum;
      let advance    = Math.round(-total / slideW);
      // Cap at max slides per gesture based on speed
      const maxAdv   = Math.max(1, Math.min(n, Math.abs(Math.round(momentum / slideW)) + 1));
      advance        = Math.max(-maxAdv, Math.min(maxAdv, advance));

      let next = Math.max(0, Math.min(n - 1, self._currentPhoto + advance));
      // Read current carousel X for smooth spring from current position
      const c = getCarousel();
      let curX = snapX(self._currentPhoto);
      if (c) {
        const mat = new DOMMatrix(getComputedStyle(c).transform);
        curX = mat.m41;
      }
      self._currentPhoto = next;
      self._el.querySelectorAll('.wp-pm-dot').forEach((d, idx) =>
        d.classList.toggle('active', idx === next)
      );
      springTo(snapX(next), curX, velX * 60);
    };

    hero.addEventListener('touchend',   onEnd, { passive: true });
    hero.addEventListener('touchcancel', () => {
      tracking = false;
      const c = getCarousel();
      let curX = snapX(self._currentPhoto);
      if (c) { const m = new DOMMatrix(getComputedStyle(c).transform); curX = m.m41; }
      springTo(snapX(self._currentPhoto), curX, 0);
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
      /* Slide portrait: simple, sin efectos visuales */
      .wp-pm-slide {
        min-width:44%; height:100%;
        border-radius:22px;
        background:center/cover no-repeat #e2e8f0;
        flex-shrink:0; margin:0 4px;
        overflow:hidden;
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

      /* ── Body ── */
      .wp-pm-body {
        position:absolute;
        top:calc(env(safe-area-inset-top, 0px) + 358px);
        left:0; right:0; bottom:0;
        overflow-y:auto; overflow-x:hidden;
        -webkit-overflow-scrolling:touch;
        scrollbar-width:none;
        background:#fff;
        border-radius:0;
        padding-top:20px;
        padding-bottom:calc(100px + env(safe-area-inset-bottom,0px));
      }
      .wp-pm-body::-webkit-scrollbar { display:none; }
      .wp-pm-handle { display:none; }

      /* ── AI Description block ── */
      .wp-pm-ai-block {
        margin:0 20px 14px;
        padding:12px 14px;
        background:linear-gradient(135deg,rgba(0,122,255,0.06),rgba(88,86,214,0.06));
        border-radius:16px;
        border-left:3px solid rgba(0,122,255,0.4);
        position:relative;
      }
      .wp-pm-ai-block::before {
        content:'✦';
        position:absolute; top:10px; right:12px;
        font-size:10px; color:rgba(0,122,255,0.4);
      }
      .wp-pm-ai-text {
        font-size:14px; line-height:1.6; color:#3a3a3c;
        font-family:'Inter Tight',system-ui,sans-serif;
        font-weight:400; font-style:italic;
      }

      /* ── Nombre + badges ── */
      .wp-pm-header-row {
        display:flex; align-items:center; flex-wrap:wrap; gap:8px;
        padding:0 20px 4px;
      }
      .wp-pm-name {
        font-size:24px; font-weight:700; color:#0a0a0a; margin:0; flex:1;
        font-family:'Inter Tight',system-ui,sans-serif;
        line-height:1.15; letter-spacing:-0.02em;
      }
      .wp-pm-verified { display:flex; align-items:center; }
      .wp-pm-featured-badge {
        font-size:11px; font-weight:600; padding:4px 10px;
        border-radius:9999px; white-space:nowrap;
        letter-spacing:0.01em;
      }
      .wp-pm-badge-featured { background:#fef9ee; color:#c97800; border:1px solid #fde68a; }
      .wp-pm-badge-verified  { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
      .wp-pm-badge-premium   { background:#fdf4ff; color:#9333ea; border:1px solid #e9d5ff; }

      /* ── Dirección ── */
      .wp-pm-addr-row {
        display:flex; align-items:flex-start; gap:5px;
        padding:2px 20px 12px; font-size:13px; color:#8e8e93;
        line-height:1.45; font-weight:400;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-addr-row svg { flex-shrink:0; margin-top:2px; }

      /* ── Stats — box con separadores ── */
      .wp-pm-stats-row {
        display:flex; align-items:stretch;
        margin:0 20px 16px;
        background:#f2f2f7; border-radius:16px;
        overflow:hidden;
      }
      .wp-pm-stat {
        flex:1; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        padding:12px 8px; gap:3px;
      }
      .wp-pm-stat-val {
        font-size:17px; font-weight:600; color:#0a0a0a;
        display:flex; align-items:center; gap:3px;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-stat-lbl {
        font-size:10px; color:#8e8e93; font-weight:500;
        text-transform:uppercase; letter-spacing:0.05em;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-stat-sep {
        width:0.5px; background:#c6c6c8; margin:10px 0;
      }

      /* ── Botones acción — frosted glass como topbar chips ── */
      .wp-pm-actions-row {
        display:flex; gap:8px; padding:0 20px 16px;
      }
      .wp-pm-action-btn {
        flex:1; height:44px; border-radius:9999px;
        border:none;
        background:rgba(118,118,128,0.12);
        display:flex; align-items:center; justify-content:center; gap:6px;
        font-size:14px; font-weight:500; color:#0a0a0a; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1), background 0.15s;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:-0.01em;
      }
      .wp-pm-action-btn:active { transform:scale(0.96); background:rgba(118,118,128,0.2); }
      .wp-pm-action-btn svg { opacity:0.7; }

      /* ── Divider iOS style ── */
      .wp-pm-divider {
        height:0.5px; background:#c6c6c8;
        margin:4px 20px 16px;
      }

      /* ── Section title iOS style ── */
      .wp-pm-section-title {
        font-size:11px; font-weight:600; color:#8e8e93;
        padding:0 20px 8px;
        text-transform:uppercase; letter-spacing:0.06em;
        font-family:'Inter Tight',system-ui,sans-serif;
      }

      /* ── Description ── */
      .wp-pm-desc-block { padding-bottom:4px; }
      .wp-pm-desc-text {
        font-size:15px; line-height:1.6; color:#3a3a3c;
        padding:0 20px 4px;
        font-family:'Inter Tight',system-ui,sans-serif;
        font-weight:400;
      }
      .wp-pm-read-more {
        border:none; background:none; color:#007aff;
        font-size:15px; font-weight:400; cursor:pointer;
        padding:0 20px 12px;
        font-family:'Inter Tight',system-ui,sans-serif;
        -webkit-tap-highlight-color:transparent;
      }

      /* ── Tags iOS pills ── */
      .wp-pm-tags-row {
        display:flex; flex-wrap:wrap; gap:8px; padding:0 20px 12px;
      }
      .wp-pm-tag {
        height:32px; padding:0 14px; border-radius:9999px;
        background:rgba(118,118,128,0.12); color:#3a3a3c;
        font-size:13px; font-weight:500;
        display:flex; align-items:center; gap:4px;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-tag-accent { background:#eff6ff; color:#2563eb; }

      /* ── Horarios ── */
      .wp-pm-hours-trigger {
        display:flex; align-items:center; gap:8px;
        padding:0 20px 8px; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .wp-pm-hours-today {
        font-size:15px; color:#3a3a3c; font-weight:400; flex:1;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-hours-status {
        font-size:12px; font-weight:600;
        padding:2px 8px; border-radius:9999px;
      }
      .wp-pm-open   { background:#e8fdf0; color:#34c759; }
      .wp-pm-closed { background:#fff1f0; color:#ff3b30; }
      .wp-pm-chevron { transition:transform 0.25s ease; flex-shrink:0; }
      .wp-pm-hours-list {
        max-height:0; overflow:hidden;
        transition:max-height 0.3s ease;
        padding:0 20px;
      }
      .wp-pm-hours-list.expanded { max-height:300px; }
      .wp-pm-hours-row {
        display:flex; justify-content:space-between;
        padding:8px 0; font-size:14px; color:#8e8e93;
        border-bottom:0.5px solid #e5e5ea;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-hours-row:last-child { border-bottom:none; }
      .wp-pm-hours-day { min-width:90px; }
      .wp-pm-today .wp-pm-hours-day,
      .wp-pm-today .wp-pm-hours-time { color:#0a0a0a; font-weight:600; }

      /* ── Reviews ── */
      .wp-pm-reviews-block { padding-bottom:8px; }
      .wp-pm-reviews-list {
        display:flex; flex-direction:column; gap:10px;
        padding:0 20px;
      }
      .wp-pm-review-card {
        background:#f2f2f7;
        border-radius:22px;
        padding:14px 16px;
      }
      .wp-pm-review-top {
        display:flex; align-items:center; gap:10px; margin-bottom:8px;
      }
      .wp-pm-review-avatar {
        width:36px; height:36px; border-radius:9999px; flex-shrink:0;
        background:linear-gradient(135deg,#007aff,#5856d6);
        color:#fff; font-size:15px; font-weight:600;
        display:flex; align-items:center; justify-content:center;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-review-info { display:flex; flex-direction:column; flex:1; gap:1px; }
      .wp-pm-review-name {
        font-size:14px; font-weight:600; color:#0a0a0a;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-review-time {
        font-size:11px; color:#8e8e93;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-review-stars { font-size:12px; color:#ff9f0a; margin-left:auto; }
      .wp-pm-review-text {
        font-size:14px; color:#3a3a3c; line-height:1.5; margin:0;
        font-family:'Inter Tight',system-ui,sans-serif; font-weight:400;
        display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden;
      }

      /* ── CTA bottom bar — fixed at bottom ── */
      /* ── CTA flotante sin container ── */
      .wp-pm-bottom {
        position:absolute; bottom:calc(16px + env(safe-area-inset-bottom,0px));
        left:20px; right:20px;
        background:transparent;
        border:none; z-index:2;
        pointer-events:none;
      }
      .wp-pm-cta {
        width:100%; height:52px; border-radius:9999px; border:none;
        /* Liquid blue glass */
        background:rgba(0,122,255,0.82);
        backdrop-filter:blur(20px) saturate(2.5) brightness(1.15);
        -webkit-backdrop-filter:blur(20px) saturate(2.5) brightness(1.15);
        box-shadow:
          0 8px 32px rgba(0,122,255,0.45),
          0 2px 8px rgba(0,122,255,0.3),
          inset 0 1px 0 rgba(255,255,255,0.35),
          inset 0 -1px 0 rgba(0,0,0,0.1);
        color:#fff; font-size:17px; font-weight:600; cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:8px;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s cubic-bezier(0.34,1.56,0.64,1), filter 0.15s;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:-0.01em;
        pointer-events:auto;
        text-shadow:0 1px 3px rgba(0,0,0,0.15);
      }
      .wp-pm-cta:active { transform:scale(0.97); filter:brightness(0.9); }
    `;
    document.head.appendChild(s);
  }
}