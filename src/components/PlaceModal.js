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

    // 1. Sombra azul cambia instantáneamente via clase CSS (transition:none en app.css)
    document.body.classList.add('wp-pm-open');

    // 2. Ocultar topbar del mapa
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

    // 3. Modal sube — sombra ya está lista
    this._el.classList.remove('wp-pm-hidden');
    this._el.classList.add('wp-pm-visible');
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
            <svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="none"><polyline points="244 400 100 256 244 112" style="fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:48px"></polyline><line x1="120" y1="256" x2="412" y2="256" style="fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:48px"></line></svg>
          </button>
          <!-- Centro: stats (default) / nombre (al scrollear) -->
          <div class="wp-pm-tb-center">
            <!-- Featured badge encima del pill -->
            <span class="wp-pm-featured-badge" id="wp-pm-featured" style="display:none"></span>
            <!-- Stats pill en topbar -->
            <div class="wp-pm-stats-row" id="wp-pm-stats-row">
              <div class="wp-pm-stats-inner">
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
            </div>
            <!-- Photo pill con parallax (aparece al scrollear) -->
            <div class="wp-pm-tb-photo-pill" id="wp-pm-tb-photo-pill">
              <div class="wp-pm-tb-photo-bg" id="wp-pm-tb-photo-bg"></div>
              <div class="wp-pm-tb-photo-overlay"></div>
              <span class="wp-pm-tb-title" id="wp-pm-tb-name">Lugar</span>
            </div>
          </div>
          <!-- Tres puntos -->
          <button class="wp-pm-tb-btn" id="wp-pm-more">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>

        <!-- ── MORE MENU modal ── -->
        <div class="wp-pm-more-overlay" id="wp-pm-more-overlay" style="display:none"></div>
        <div class="wp-pm-more-menu" id="wp-pm-more-menu" style="display:none">
          <div class="wp-pm-more-handle"></div>
          <button class="wp-pm-more-item" id="wp-pm-more-share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
            <span>Compartir lugar</span>
          </button>
          <div class="wp-pm-more-sep"></div>
          <button class="wp-pm-more-item" id="wp-pm-more-report">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>Reportar problema</span>
          </button>
          <button class="wp-pm-more-item" id="wp-pm-more-sources">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
            <span>Acerca de las fuentes</span>
          </button>
          <button class="wp-pm-more-item" id="wp-pm-more-suggest">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Sugerir edición</span>
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

        <!-- Sombra fija encima del body scrolleable -->
        <div class="wp-pm-top-fade"></div>

        <!-- ── BODY SCROLLABLE ── -->
        <div class="wp-pm-body" id="wp-pm-body">
          <div class="wp-pm-handle"></div>

          <!-- Nombre + badges -->
          <div class="wp-pm-header-row">
            <div class="wp-pm-badges-top">
              <span class="wp-pm-open-badge" id="wp-pm-open-badge" style="display:none">
                <span class="wp-pm-open-dot" id="wp-pm-open-dot"></span>
                <span id="wp-pm-open-label"></span>
              </span>
              <button class="wp-pm-tag-chip" id="wp-pm-tag-chip">+ Etiquetar lugar</button>
            </div>
            <div class="wp-pm-title-row">
              <h2 class="wp-pm-name" id="wp-pm-name"></h2>
              <span class="wp-pm-verified" id="wp-pm-verified" style="display:none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </span>
              <button class="wp-pm-save-btn" id="wp-pm-save" title="Guardar">
                <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M400,480a16,16,0,0,1-10.63-4L256,357.41,122.63,476A16,16,0,0,1,96,464V96a64.07,64.07,0,0,1,64-64H352a64.07,64.07,0,0,1,64,64V464a16,16,0,0,1-16,16Z"/></svg>
              </button>
              <button class="wp-pm-save-btn" id="wp-pm-share-body" title="Compartir">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
              </button>
            </div>
          </div>

          <!-- Dirección — sin icono, line-height ajustado -->
          <div class="wp-pm-addr-row" id="wp-pm-addr-row" style="display:none">
            <span id="wp-pm-addr"></span>&#8202;<button class="wp-pm-addr-copy" id="wp-pm-addr-copy" title="Copiar dirección">
              <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </button>
          </div>

          <!-- AI Description — icono + badge arriba, luego texto -->
          <div class="wp-pm-ai-block" id="wp-pm-ai-block" style="display:none">
            <div class="wp-pm-ai-header">
              <svg class="wp-pm-ai-icon" width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M208,512a24.84,24.84,0,0,1-23.34-16l-39.84-103.6a16.06,16.06,0,0,0-9.19-9.19L32,343.34a25,25,0,0,1,0-46.68l103.6-39.84a16.06,16.06,0,0,0,9.19-9.19L184.66,144a25,25,0,0,1,46.68,0l39.84,103.6a16.06,16.06,0,0,0,9.19,9.19l103,39.63A25.49,25.49,0,0,1,400,320.52a24.82,24.82,0,0,1-16,22.82l-103.6,39.84a16.06,16.06,0,0,0-9.19,9.19L231.34,496A24.84,24.84,0,0,1,208,512Z"/><path d="M88,176a14.67,14.67,0,0,1-13.69-9.4L57.45,122.76a7.28,7.28,0,0,0-4.21-4.21L9.4,101.69a14.67,14.67,0,0,1,0-27.38L53.24,57.45a7.31,7.31,0,0,0,4.21-4.21L74.16,9.79A15,15,0,0,1,86.23.11,14.67,14.67,0,0,1,101.69,9.4l16.86,43.84a7.31,7.31,0,0,0,4.21,4.21L166.6,74.31a14.67,14.67,0,0,1,0,27.38l-43.84,16.86a7.28,7.28,0,0,0-4.21,4.21L101.69,166.6A14.67,14.67,0,0,1,88,176Z"/><path d="M400,256a16,16,0,0,1-14.93-10.26l-22.84-59.37a8,8,0,0,0-4.6-4.6l-59.37-22.84a16,16,0,0,1,0-29.86l59.37-22.84a8,8,0,0,0,4.6-4.6L384.9,42.68a16.45,16.45,0,0,1,13.17-10.57,16,16,0,0,1,16.86,10.15l22.84,59.37a8,8,0,0,0,4.6,4.6l59.37,22.84a16,16,0,0,1,0,29.86l-59.37,22.84a8,8,0,0,0-4.6,4.6l-22.84,59.37A16,16,0,0,1,400,256Z"/></svg>
              <span class="wp-pm-ai-badge">Descripción generada con IA</span>
            </div>
            <div class="wp-pm-ai-text" id="wp-pm-ai-text"></div>
          </div>

          <!-- Botones acción: teléfono · web · maps -->
          <div class="wp-pm-actions-row" id="wp-pm-actions-row">
            <button class="wp-pm-action-btn" id="wp-pm-btn-phone" style="display:none">
              <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M391,480c-19.52,0-46.94-7.06-88-30-49.93-28-88.55-53.85-138.21-103.38C116.91,298.77,93.61,267.79,61,208.45c-36.84-67-30.56-102.12-23.54-117.13C45.82,73.38,58.16,62.65,74.11,52A176.3,176.3,0,0,1,102.75,36.8c1-.43,1.93-.84,2.76-1.21,4.95-2.23,12.45-5.6,21.95-2,6.34,2.38,12,7.25,20.86,16,18.17,17.92,43,57.83,52.16,77.43,6.15,13.21,10.22,21.93,10.23,31.71,0,11.45-5.76,20.28-12.75,29.81-1.31,1.79-2.61,3.5-3.87,5.16-7.61,10-9.28,12.89-8.18,18.05,2.23,10.37,18.86,41.24,46.19,68.51s57.31,42.85,67.72,45.07c5.38,1.15,8.33-.59,18.65-8.47,1.48-1.13,3-2.3,4.59-3.47,10.66-7.93,19.08-13.54,30.26-13.54h.06c9.73,0,18.06,4.22,31.86,11.18,18,9.08,59.11,33.59,77.14,51.78,8.77,8.84,13.66,14.48,16.05,20.81,3.6,9.53.21,17-2,22-.37.83-.78,1.74-1.21,2.75a176.49,176.49,0,0,1-15.29,28.58c-10.63,15.9-21.4,28.21-39.38,36.58A67.42,67.42,0,0,1,391,480Z"/></svg>
              <span>Llamar</span>
            </button>
            <button class="wp-pm-action-btn" id="wp-pm-btn-web" style="display:none">
              <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M414.39,97.74A224,224,0,1,0,97.61,414.52,224,224,0,1,0,414.39,97.74ZM64,256.13a191.63,191.63,0,0,1,6.7-50.31c7.34,15.8,18,29.45,25.25,45.66,9.37,20.84,34.53,15.06,45.64,33.32,9.86,16.21-.67,36.71,6.71,53.67,5.36,12.31,18,15,26.72,24,8.91,9.08,8.72,21.52,10.08,33.36a305.36,305.36,0,0,0,7.45,41.27c0,.1,0,.21.08.31C117.8,411.13,64,339.8,64,256.13Zm192,192a193.12,193.12,0,0,1-32-2.68c.11-2.71.16-5.24.43-7,2.43-15.9,10.39-31.45,21.13-43.35,10.61-11.74,25.15-19.68,34.11-33,8.78-13,11.41-30.5,7.79-45.69-5.33-22.44-35.82-29.93-52.26-42.1-9.45-7-17.86-17.82-30.27-18.7-5.72-.4-10.51.83-16.18-.63-5.2-1.35-9.28-4.15-14.82-3.42-10.35,1.36-16.88,12.42-28,10.92-10.55-1.41-21.42-13.76-23.82-23.81-3.08-12.92,7.14-17.11,18.09-18.26,4.57-.48,9.7-1,14.09.68,5.78,2.14,8.51,7.8,13.7,10.66,9.73,5.34,11.7-3.19,10.21-11.83-2.23-12.94-4.83-18.21,6.71-27.12,8-6.14,14.84-10.58,13.56-21.61-.76-6.48-4.31-9.41-1-15.86,2.51-4.91,9.4-9.34,13.89-12.27,11.59-7.56,49.65-7,34.1-28.16-4.57-6.21-13-17.31-21-18.83-10-1.89-14.44,9.27-21.41,14.19-7.2,5.09-21.22,10.87-28.43,3-9.7-10.59,6.43-14.06,10-21.46,1.65-3.45,0-8.24-2.78-12.75q5.41-2.28,11-4.23a15.6,15.6,0,0,0,8,3c6.69.44,13-3.18,18.84,1.38,6.48,5,11.15,11.32,19.75,12.88,8.32,1.51,17.13-3.34,19.19-11.86,1.25-5.18,0-10.65-1.2-16a190.83,190.83,0,0,1,105,32.21c-2-.76-4.39-.67-7.34.7-6.07,2.82-14.67,10-15.38,17.12-.81,8.08,11.11,9.22,16.77,9.22,8.5,0,17.11-3.8,14.37-13.62-1.19-4.26-2.81-8.69-5.42-11.37a193.27,193.27,0,0,1,18,14.14c-.09.09-.18.17-.27.27-5.76,6-12.45,10.75-16.39,18.05-2.78,5.14-5.91,7.58-11.54,8.91-3.1.73-6.64,1-9.24,3.08-7.24,5.7-3.12,19.4,3.74,23.51,8.67,5.19,21.53,2.75,28.07-4.66,5.11-5.8,8.12-15.87,17.31-15.86a15.4,15.4,0,0,1,10.82,4.41c3.8,3.94,3.05,7.62,3.86,12.54,1.43,8.74,9.14,4,13.83-.41a192.12,192.12,0,0,1,9.24,18.77c-5.16,7.43-9.26,15.53-21.67,6.87-7.43-5.19-12-12.72-21.33-15.06-8.15-2-16.5.08-24.55,1.47-9.15,1.59-20,2.29-26.94,9.22-6.71,6.68-10.26,15.62-17.4,22.33-13.81,13-19.64,27.19-10.7,45.57,8.6,17.67,26.59,27.26,46,26,19.07-1.27,38.88-12.33,38.33,15.38-.2,9.81,1.85,16.6,4.86,25.71,2.79,8.4,2.6,16.54,3.24,25.21A158,158,0,0,0,407.43,374,191.75,191.75,0,0,1,256,448.13Z"/></svg>
              <span>Web</span>
            </button>
            <button class="wp-pm-action-btn" id="wp-pm-btn-maps">
              <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M272,464a16,16,0,0,1-16-16.42V264.13a8,8,0,0,0-8-8H64.41a16.31,16.31,0,0,1-15.49-10.65,16,16,0,0,1,8.41-19.87l384-176.15a16,16,0,0,1,21.22,21.19l-176,384A16,16,0,0,1,272,464Z"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M464,256c0-114.87-93.13-208-208-208S48,141.13,48,256s93.13,208,208,208S464,370.87,464,256ZM251.35,347.36a16,16,0,0,1-.09-22.63L303.58,272H170a16,16,0,0,1,0-32H303.58l-52.32-52.73A16,16,0,1,1,274,164.73l79.39,80a16,16,0,0,1,0,22.54l-79.39,80A16,16,0,0,1,251.35,347.36Z"/></svg>
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
    if (tbName) tbName.textContent = (place.name || 'Detalles').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    // Foto del lugar en el photo pill del topbar
    const photoBg = this._el.querySelector('#wp-pm-tb-photo-bg');
    if (photoBg) {
      const photoUrl = this._photos?.[0] || (place.photoUrl ? this.proxyPhoto(place.photoUrl) : null);
      photoBg.style.backgroundImage = photoUrl ? `url(${photoUrl})` : 'none';
    }
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
    // scroll body to top + reset topbar
    const body = this._el.querySelector('#wp-pm-body');
    if (body) body.scrollTop = 0;
    const statsRow  = this._el.querySelector('#wp-pm-stats-row');
    const photoPill = this._el.querySelector('#wp-pm-tb-photo-pill');
    const heroEl    = this._el.querySelector('#wp-pm-hero');
    if (statsRow)  { statsRow.style.opacity = '1'; statsRow.style.transform = ''; statsRow.style.pointerEvents = ''; }
    if (photoPill) photoPill.classList.remove('visible');
    if (heroEl)    { heroEl.style.transform = ''; heroEl.style.opacity = '1'; }
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

    // Slides con skeleton + cuadro añadir foto al final
    carousel.innerHTML = this._photos.map((u, i) =>
      `<div class="wp-pm-slide wp-pm-slide-skeleton" data-i="${i}">
         <img class="wp-pm-slide-img" src="${u}" alt="" loading="lazy"
              onload="this.classList.add('loaded');this.parentElement.classList.remove('wp-pm-slide-skeleton')"
              onerror="this.parentElement.classList.remove('wp-pm-slide-skeleton')">
       </div>`
    ).join('') +
    `<div class="wp-pm-slide wp-pm-slide-add" id="wp-pm-slide-add" data-add="1">
       <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
       <span>Añadir foto</span>
     </div>`;

    // Foto unica: ampliar y centrar, sin dots
    if (this._photos.length === 1) {
      carousel.classList.add('single-photo');
      dotsEl.style.display = 'none';
      // Aun con foto unica se muestra el add al final
      carousel.classList.remove('single-photo'); // resetear para que add se vea
    } else {
      carousel.classList.remove('single-photo');
    }

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
    const _cap = s => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '';
    this._el.querySelector('#wp-pm-name').textContent = _cap(place.name);

    const verified = this._el.querySelector('#wp-pm-verified');
    if (verified) verified.style.display = (place.featured === 'verified' || place.featured === 'premium') ? '' : 'none';

    // Featured badge en topbar + borde gradiente en pill
    const featured  = this._el.querySelector('#wp-pm-featured');
    const statsRow  = this._el.querySelector('#wp-pm-stats-row');
    if (place.featured) {
      const labels = { premium:'✦ Premium', featured:'✦ Destacado', verified:'✓ Verificado' };
      featured.style.display = '';
      featured.textContent   = labels[place.featured] || place.featured;
      featured.className     = `wp-pm-featured-badge wp-pm-badge-${place.featured}`;
      // Borde gradiente via clase CSS — no toca el background
      if (statsRow) {
        statsRow.classList.remove('hl-featured','hl-premium','hl-verified');
        statsRow.classList.add(`hl-${place.featured}`);
      }
    } else {
      if (featured) featured.style.display = 'none';
      if (statsRow) statsRow.classList.remove('hl-featured','hl-premium','hl-verified');
    }

    // Open / closed badge — calculado desde horarios reales
    const openBadge = this._el.querySelector('#wp-pm-open-badge');
    const openDot   = this._el.querySelector('#wp-pm-open-dot');
    const openLabel = this._el.querySelector('#wp-pm-open-label');
    if (openBadge) {
      const isOpen = this._isOpenNow(place);
      if (isOpen !== null) {
        openBadge.style.display = '';
        openBadge.className     = `wp-pm-open-badge ${isOpen ? 'is-open' : 'is-closed'}`;
        if (openDot) openDot.className = 'wp-pm-open-dot';
        if (openLabel) openLabel.textContent = isOpen ? 'Abierto' : 'Cerrado';
      } else {
        openBadge.style.display = 'none';
      }
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
    const icon   = this._el.querySelector('.wp-pm-ai-icon');
    if (!block || !textEl) return;

    // Cancel any previous typewriter + fetch
    if (this._aiAbort) this._aiAbort();
    this._aiAbort = null;

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

    let aborted = false;
    let cancelTypewrite = null;
    this._aiAbort = () => {
      aborted = true;
      if (cancelTypewrite) cancelTypewrite();
      block.style.display = 'none';
      textEl.textContent  = '';
      if (icon) icon.classList.remove('wp-pm-ai-pulse');
    };

    fetch(`/api/groq-description?place_id=${encodeURIComponent(placeId)}`)
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (aborted) return;
      if (!ok || !data || !data.description) { block.style.display = 'none'; return; }
      block.style.display = '';
      textEl.textContent  = '';
      if (icon) icon.classList.add('wp-pm-ai-pulse');
      cancelTypewrite = this._typewrite(textEl, data.description, null, () => {
        if (icon) icon.classList.remove('wp-pm-ai-pulse');
      });
    })
    .catch(() => { if (!aborted) block.style.display = 'none'; });
  }

  _typewrite(el, text, onStart, onDone) {
    el.textContent = '';
    let i = 0;
    let cancelled = false;
    let timer = null;
    const step = () => {
      if (cancelled) return;
      if (i < text.length) {
        el.textContent += text[i++];
        timer = setTimeout(step, 16);
      } else {
        if (onDone) onDone();
      }
    };
    if (onStart) onStart();
    timer = setTimeout(step, 16);
    // Return cancel fn
    return function cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
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

    // ── More menu ──
    const moreBtn     = this._el.querySelector('#wp-pm-more');
    const moreMenu    = this._el.querySelector('#wp-pm-more-menu');
    const moreOverlay = this._el.querySelector('#wp-pm-more-overlay');
    const closeMore   = () => {
      moreMenu.classList.remove('open');
      setTimeout(() => { moreMenu.style.display = 'none'; moreOverlay.style.display = 'none'; }, 320);
    };
    moreBtn.addEventListener('click', () => {
      moreMenu.style.display = ''; moreOverlay.style.display = '';
      requestAnimationFrame(() => moreMenu.classList.add('open'));
    });
    moreOverlay.addEventListener('click', closeMore);
    this._el.querySelector('#wp-pm-more-share').addEventListener('click', () => {
      closeMore();
      if (navigator.share && this._place) navigator.share({ title: this._place.name, url: window.location.href });
    });
    this._el.querySelector('#wp-pm-more-report').addEventListener('click',  () => closeMore());
    this._el.querySelector('#wp-pm-more-sources').addEventListener('click', () => closeMore());
    this._el.querySelector('#wp-pm-more-suggest').addEventListener('click', () => closeMore());

    // Etiquetar lugar — placeholder hasta recibir indicaciones
    const tagChip = this._el.querySelector('#wp-pm-tag-chip');
    if (tagChip) tagChip.addEventListener('click', () => this._onTagPlace());

    // Añadir foto — por ahora placeholder hasta recibir indicaciones
    this._el.addEventListener('click', (e) => {
      const addSlide = e.target.closest('#wp-pm-slide-add');
      if (addSlide) this._onAddPhoto();
    });
    const copyBtn = this._el.querySelector('#wp-pm-addr-copy');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const addr = this._el.querySelector('#wp-pm-addr').textContent;
      if (!addr) return;
      navigator.clipboard.writeText(addr).then(() => {
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = '<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
        }, 2000);
      });
    });
    const shareBody = this._el.querySelector('#wp-pm-share-body');
    if (shareBody) shareBody.addEventListener('click', () => {
      if (navigator.share && this._place) navigator.share({ title: this._place.name, url: window.location.href });
    });

    this._el.querySelector('#wp-pm-cta').addEventListener('click', () => {
      console.log('Planear visita:', this._place);
    });
    const saveBtn = this._el.querySelector('#wp-pm-save');
    if (saveBtn) saveBtn.addEventListener('click', function() {
      this.classList.toggle('saved');
    });

    // Scroll: parallax hero + stats → photo pill
    const body       = this._el.querySelector('#wp-pm-body');
    const statsRow   = this._el.querySelector('#wp-pm-stats-row');
    const photoPill  = this._el.querySelector('#wp-pm-tb-photo-pill');
    const hero       = this._el.querySelector('#wp-pm-hero');
    let   _scrolled  = false;
    if (body && statsRow) {
      body.addEventListener('scroll', () => {
        const sy = body.scrollTop;

        // ── Parallax hero: sube a 0.45x y se desvanece ──
        if (hero) {
          hero.style.transform = `translateY(${-sy * 0.45}px)`;
          const fade = Math.max(0, 1 - sy / 140);
          hero.style.opacity = fade;
        }

        // ── Stats → photo pill threshold ──
        const nameEl    = body.querySelector('#wp-pm-name');
        const threshold = nameEl ? nameEl.offsetTop - 20 : 60;
        const past      = sy > threshold;
        if (past !== _scrolled) {
          _scrolled = past;
          statsRow.style.opacity       = past ? '0' : '1';
          statsRow.style.transform     = past ? 'scale(0.88)' : 'scale(1)';
          statsRow.style.pointerEvents = past ? 'none' : '';
          if (photoPill) photoPill.classList.toggle('visible', past);
        }
      }, { passive: true });
    }
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

  // Placeholder — lógica completa pendiente de indicaciones
  _onTagPlace() {
    console.log('Etiquetar lugar:', this._place?.name);
    // TODO: implementar flujo de etiquetado
  }

  // Placeholder — lógica completa pendiente de indicaciones
  _onAddPhoto() {
    console.log('Añadir foto:', this._place?.name);
    // TODO: implementar flujo de subida de foto
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

      /* Shadow handled in app.css */

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
      /* Sombra azul manejada por ion-app::before en app.css */
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
      /* Photo pill — contenedor que reemplaza el stats pill al scrollear */
      .wp-pm-tb-photo-pill {
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        border-radius:999px; overflow:hidden;
        box-shadow:0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.2);
        opacity:0; transform:scale(0.9);
        transition:opacity 0.28s ease, transform 0.28s cubic-bezier(0.34,1.2,0.64,1);
        pointer-events:none;
      }
      .wp-pm-tb-photo-pill.visible {
        opacity:1; transform:scale(1); pointer-events:auto;
      }
      /* Foto de fondo con blur y parallax vía translateY */
      .wp-pm-tb-photo-bg {
        position:absolute; inset:-20px;   /* extra para parallax sin bordes */
        background-size:cover; background-position:center;
        filter:blur(10px) saturate(1.4) brightness(0.75);
        will-change:transform;
        transition:transform 0s linear;
      }
      /* Overlay oscuro semi-transparente */
      .wp-pm-tb-photo-overlay {
        position:absolute; inset:0;
        background:rgba(0,0,0,0.28);
      }
      /* Nombre encima */
      .wp-pm-tb-title {
        position:relative; z-index:1;
        font-size:15px; font-weight:700; color:#fff;
        font-family:'Yahoo Sans Bold Regular','Inter Tight',system-ui,sans-serif;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        padding:0 16px; letter-spacing:-0.01em;
        text-shadow:0 1px 4px rgba(0,0,0,0.3);
      }

      /* Fondo blanco difuminado detrás del carousel —
         sube desde el panel y se pierde hacia la sombra azul del top */
      .wp-pm-hero::before {
        content:'';
        position:absolute; inset:0;
        background:linear-gradient(to bottom,
          rgba(255,255,255,0)    0%,
          rgba(255,255,255,0.5)  8%,
          rgba(255,255,255,0.85) 22%,
          rgba(255,255,255,0.97) 38%,
          rgba(255,255,255,1)    52%);
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
        height:240px;
        overflow:hidden; background:transparent;
        z-index:1;
        padding:14px 0 18px;
        will-change:transform, opacity;
        transform-origin:top center;
      }
      /* Carousel track */
      .wp-pm-carousel {
        display:flex; align-items:center;
        height:100%;
        will-change:transform;
      }
      /* Slide portrait */
      .wp-pm-slide {
        min-width:44%; height:100%;
        border-radius:22px;
        background:center/cover no-repeat #e2e8f0;
        flex-shrink:0; margin:0 4px;
        overflow:hidden; position:relative;
      }
      .wp-pm-slide-img {
        width:100%; height:100%; object-fit:cover;
        opacity:0; transition:opacity 0.3s ease;
        position:absolute; inset:0;
      }
      .wp-pm-slide-img.loaded { opacity:1; }
      @keyframes wp-skeleton-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .wp-pm-slide-skeleton {
        background: linear-gradient(90deg,
          #e8eaed 25%, #f3f4f6 50%, #e8eaed 75%);
        background-size: 200% 100%;
        animation: wp-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      /* Cuadro añadir foto */
      .wp-pm-slide-add {
        display:flex; flex-direction:column;
        align-items:center; justify-content:center; gap:8px;
        background:rgba(0,0,0,0.04);
        border:1.5px dashed rgba(0,0,0,0.18);
        color:#8e8e93; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:background 0.15s, border-color 0.15s;
      }
      .wp-pm-slide-add:active { background:rgba(0,0,0,0.08); }
      .wp-pm-slide-add span {
        font-size:11px; font-weight:600;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:0.02em;
      }
      .wp-pm-slide-placeholder {
        display:flex; align-items:center; justify-content:center;
        font-size:64px; background:#f1f5f9;
        transform:scale(1) !important; opacity:1 !important;
      }
      /* Foto única: ocupa ancho de 2 slides, centrada */
      .wp-pm-carousel.single-photo {
        justify-content:center;
      }
      .wp-pm-carousel.single-photo .wp-pm-slide {
        min-width:88%;
        margin:0 4px;
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
        top:calc(env(safe-area-inset-top, 0px) + 308px);
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
      /* Sombra fija encima del body — elemento hermano, no ::before */
      .wp-pm-top-fade {
        position:absolute;
        top:calc(env(safe-area-inset-top, 0px) + 308px);
        left:0; right:0;
        height:36px;
        background:linear-gradient(to bottom,
          rgba(255,255,255,1)   0%,
          rgba(255,255,255,0)   100%);
        z-index:20;
        pointer-events:none;
      }

      /* ── AI Description block ── */
      .wp-pm-ai-block {
        margin:0 20px 16px;
        padding:0;
        background:transparent;
        border:none;
        display:flex; flex-direction:column; gap:8px;
      }
      .wp-pm-ai-header {
        display:flex; align-items:center; gap:8px;
      }
      .wp-pm-ai-icon {
        flex-shrink:0; color:#3b82f6;
        transition:color 0.3s ease;
        filter:drop-shadow(0 0 6px rgba(59,130,246,0.4));
      }
      .wp-pm-ai-badge {
        font-size:10px; font-weight:700;
        letter-spacing:0.04em; text-transform:uppercase;
        color:#3b82f6;
        background:rgba(59,130,246,0.1);
        padding:3px 9px; border-radius:999px;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      @keyframes wp-ai-pulse {
        0%   { color:#60a5fa; filter:drop-shadow(0 0 6px rgba(96,165,250,0.5)); }
        50%  { color:#818cf8; filter:drop-shadow(0 0 10px rgba(129,140,248,0.7)); }
        100% { color:#60a5fa; filter:drop-shadow(0 0 6px rgba(96,165,250,0.5)); }
      }
      .wp-pm-ai-pulse {
        animation: wp-ai-pulse 1.4s ease-in-out infinite;
      }
      @keyframes wp-ai-fadein {
        from { opacity:0; transform:translateY(4px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .wp-pm-ai-text {
        font-size:14px; line-height:1.6; color:#3a3a3c;
        font-family:'Inter Tight',system-ui,sans-serif;
        font-weight:400; font-style:normal;
        animation: wp-ai-fadein 0.4s ease both;
      }

      /* ── Nombre + badges ── */
      .wp-pm-header-row {
        display:flex; flex-direction:column; gap:2px;
        padding:0 20px 2px;
      }
      .wp-pm-badges-top {
        display:flex; align-items:center; gap:6px; min-height:0;
      }
      .wp-pm-title-row {
        display:flex; align-items:center; gap:8px;
      }
      .wp-pm-name {
        font-size:24px; font-weight:900; color:#0a0a0a; margin:0; flex:1;
        font-family:'Inter Tight',system-ui,sans-serif;
        line-height:1.05; letter-spacing:-0.03em;
        display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
        overflow:hidden; text-overflow:ellipsis;
      }
      .wp-pm-verified { display:flex; align-items:center; flex-shrink:0; }
      .wp-pm-featured-badge {
        font-size:10px; font-weight:700; padding:3px 8px;
        border-radius:9999px; white-space:nowrap;
        letter-spacing:0.01em;
      }
      .wp-pm-badge-featured { background:#fef9ee; color:#c97800; border:1px solid #fde68a; }
      .wp-pm-badge-verified  { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
      .wp-pm-badge-premium   { background:#fdf4ff; color:#9333ea; border:1px solid #e9d5ff; }

      /* Featured encima del pill — posición absoluta */
      .wp-pm-tb-center .wp-pm-featured-badge {
        position:absolute; top:-8px; left:50%; transform:translateX(-50%);
        z-index:10; white-space:nowrap; pointer-events:none;
        box-shadow:0 2px 8px rgba(0,0,0,0.10);
      }

      /* Open / closed */
      .wp-pm-badges-top {
        display:flex; align-items:center; gap:6px; min-height:0;
      }
      .wp-pm-open-badge {
        display:inline-flex; align-items:center; gap:5px;
        font-size:11px; font-weight:600;
        padding:3px 9px; border-radius:999px;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:0.01em;
      }
      .wp-pm-open-badge.is-open  { background:rgba(52,199,89,0.12);  color:#1a7a35; }
      .wp-pm-open-badge.is-closed{ background:rgba(255,59,48,0.10);  color:#c0392b; }
      .wp-pm-open-dot {
        width:6px; height:6px; border-radius:50%; flex-shrink:0;
      }
      @keyframes wp-dot-pulse {
        0%,100% { transform:scale(1);   opacity:1; }
        50%      { transform:scale(1.5); opacity:0.6; }
      }
      .is-open  .wp-pm-open-dot {
        background:#34c759;
        box-shadow:0 0 5px rgba(52,199,89,0.6);
        animation:wp-dot-pulse 1.8s ease-in-out infinite;
      }
      .is-closed .wp-pm-open-dot {
        background:#ff3b30;
        box-shadow:0 0 5px rgba(255,59,48,0.5);
      }

      /* Etiquetar chip */
      .wp-pm-tag-chip {
        display:inline-flex; align-items:center;
        font-size:11px; font-weight:600; color:#007aff;
        background:rgba(0,122,255,0.08); border:1px solid rgba(0,122,255,0.2);
        padding:3px 9px; border-radius:999px; cursor:pointer;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:0.01em;
        -webkit-tap-highlight-color:transparent;
        transition:background 0.15s;
      }
      .wp-pm-tag-chip:active { background:rgba(0,122,255,0.16); }
      /* Save button */
      .wp-pm-save-btn {
        width:38px; height:38px; border-radius:9999px; flex-shrink:0;
        border:none; background:rgba(118,118,128,0.12);
        display:flex; align-items:center; justify-content:center;
        color:#8e8e93; cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:all 0.15s cubic-bezier(0.34,1.56,0.64,1);
      }
      .wp-pm-save-btn:active { transform:scale(0.92); }
      .wp-pm-save-btn.saved { color:#007aff; background:rgba(0,122,255,0.12); }

      /* ── More menu ── */
      .wp-pm-more-overlay {
        position:absolute; inset:0; z-index:300;
        background:rgba(0,0,0,0.3);
        backdrop-filter:blur(2px);
        -webkit-backdrop-filter:blur(2px);
      }
      .wp-pm-more-menu {
        position:absolute; left:12px; right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:301;
        background:rgba(255,255,255,0.96);
        backdrop-filter:blur(24px) saturate(1.8);
        -webkit-backdrop-filter:blur(24px) saturate(1.8);
        border-radius:24px;
        padding:8px 0 4px;
        box-shadow:0 8px 40px rgba(0,0,0,0.18);
        transform:translateY(110%);
        transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);
      }
      .wp-pm-more-menu.open {
        transform:translateY(0);
      }
      .wp-pm-more-handle {
        width:36px; height:4px; border-radius:2px;
        background:rgba(0,0,0,0.15); margin:0 auto 8px;
      }
      .wp-pm-more-item {
        width:100%; display:flex; align-items:center; gap:14px;
        padding:14px 20px; border:none; background:transparent;
        font-size:15px; font-weight:500; color:#1c1c1e;
        font-family:'Inter Tight',system-ui,sans-serif;
        cursor:pointer; text-align:left;
        -webkit-tap-highlight-color:transparent;
        transition:background 0.15s;
      }
      .wp-pm-more-item:active { background:rgba(0,0,0,0.05); }
      .wp-pm-more-item svg { flex-shrink:0; color:#6b7280; }
      .wp-pm-more-sep {
        height:0.5px; background:rgba(0,0,0,0.1);
        margin:2px 20px;
      }

      /* ── Dirección ── */
      .wp-pm-addr-row {
        display:block;
        padding:0 20px 10px; font-size:12.5px; color:#8e8e93;
        line-height:1.15; font-weight:400;
        font-family:'Inter Tight',system-ui,sans-serif;
        max-width:70%;
      }
      #wp-pm-addr { display:inline; }
      .wp-pm-addr-copy {
        flex-shrink:0; border:none; background:transparent;
        color:#8e8e93; cursor:pointer; padding:0; margin-top:1px;
        display:inline-flex; align-items:center;
        -webkit-tap-highlight-color:transparent;
        transition:color 0.2s, transform 0.15s;
        font-size:12.5px;
      }
      .wp-pm-addr-copy:active { transform:scale(0.85); }
      .wp-pm-addr-copy.copied { color:#34c759; }

      /* ── Stats — pill compacto en topbar ── */
      .wp-pm-tb-center {
        flex:1; position:relative;
        display:flex; align-items:center; justify-content:center;
        height:44px;
      }
      .wp-pm-stats-row {
        display:flex; align-items:stretch;
        border-radius:999px;
        height:44px;
        transition:opacity 0.22s ease, transform 0.22s ease;
        position:relative;
        background:rgba(255,255,255,0.82);
        -webkit-backdrop-filter:blur(20px) saturate(1.8);
        backdrop-filter:blur(20px) saturate(1.8);
        box-shadow:0 4px 16px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
      }
      /* Borde gradiente highlight — pseudo sobre el pill, sin afectar el fondo */
      .wp-pm-stats-row::before {
        content:''; display:none;
        position:absolute; inset:-2px; border-radius:999px; z-index:-1;
      }
      .wp-pm-stats-row.hl-featured::before {
        display:block;
        background:linear-gradient(135deg,#f59e0b,#f97316);
      }
      .wp-pm-stats-row.hl-premium::before {
        display:block;
        background:linear-gradient(135deg,#a855f7,#ec4899,#f59e0b);
      }
      .wp-pm-stats-row.hl-verified::before {
        display:block;
        background:linear-gradient(135deg,#3b82f6,#06b6d4);
      }
      .wp-pm-stats-inner {
        display:flex; align-items:stretch;
        flex:1; height:100%;
        border-radius:999px;
        /* sin overflow:hidden para no matar backdrop-filter */
      }
      .wp-pm-stat {
        flex:1; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        padding:6px 18px; gap:1px;
      }
      .wp-pm-stat-val {
        font-size:14px; font-weight:800; color:#0a0a0a;
        display:flex; align-items:center; gap:3px;
        font-family:'Inter Tight',system-ui,sans-serif;
        letter-spacing:-0.02em;
      }
      .wp-pm-stat-lbl {
        font-size:9px; color:#8e8e93; font-weight:500;
        text-transform:uppercase; letter-spacing:0.05em;
        font-family:'Inter Tight',system-ui,sans-serif;
      }
      .wp-pm-stat-sep {
        width:1px; background:rgba(0,0,0,0.15);
        align-self:stretch; margin:8px 0; flex-shrink:0;
      }

      /* Borde gradiente highlight — pseudo sin tocar el fondo blanco glass */
      .wp-pm-stats-row { position:relative; }
      .wp-pm-stats-row::before {
        content:''; display:none;
        position:absolute; inset:-2px;
        border-radius:999px; z-index:-1;
        pointer-events:none;
      }
      .wp-pm-stats-row.hl-featured::before { display:block; background:linear-gradient(135deg,#f59e0b,#f97316); }
      .wp-pm-stats-row.hl-premium::before  { display:block; background:linear-gradient(135deg,#a855f7,#ec4899,#f59e0b); }
      .wp-pm-stats-row.hl-verified::before { display:block; background:linear-gradient(135deg,#3b82f6,#06b6d4); }

      /* ── Botones acción — frosted glass como topbar chips ── */
      .wp-pm-actions-row {
        display:flex; gap:8px; padding:0 20px 16px;
      }
      .wp-pm-action-btn {
        flex:1; height:44px; border-radius:9999px;
        border:none;
        background:rgba(118,118,128,0.12);
        display:flex; align-items:center; justify-content:center; gap:6px;
        font-size:14px; font-weight:600; color:#0a0a0a; cursor:pointer;
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
        font-size:12px; font-weight:800; color:#0a0a0a;
        padding:0 20px 8px;
        letter-spacing:-0.01em;
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
          0 4px 14px rgba(0,122,255,0.22),
          0 1px 4px rgba(0,122,255,0.14),
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
