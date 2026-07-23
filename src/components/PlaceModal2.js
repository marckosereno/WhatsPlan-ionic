// ══════════════════════════════════════════════════════════════════════
// WHATSPLAN — PlaceModal2.js  (diseño alternativo, Google Maps-inspired)
// ══════════════════════════════════════════════════════════════════════
import { PlaceTagService, PLACE_TAGS } from '/src/services/PlaceTagService.js';
import { ReviewService }               from '/src/services/ReviewService.js';
import { getAvatarUrl }                from '/src/services/AvatarService.js';

export class PlaceModal2 {
  constructor(opts = {}) {
    this.onPlaceSelect  = opts.onPlaceSelect  || null;
    this.getCurrentUser = opts.getCurrentUser || (() => null);
    this.proxyPhoto     = opts.proxyPhoto     || (u => u);
    this._place         = null;
    this._el            = null;
    this._build();
  }

  // ── BUILD ─────────────────────────────────────────────────────────
  _build() {
    if (document.getElementById('wp-pm2')) return;
    const el = document.createElement('div');
    el.id = 'wp-pm2';
    el.innerHTML = `
      <div id="wp-pm2-backdrop"></div>
      <div id="wp-pm2-card">

        <!-- HERO -->
        <div id="wp-pm2-hero">
          <div id="wp-pm2-hero-photos"></div>
          <div id="wp-pm2-hero-gradient"></div>
          <button id="wp-pm2-back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div id="wp-pm2-hero-bottom">
            <h1 id="wp-pm2-name"></h1>
            <div id="wp-pm2-meta">
              <span id="wp-pm2-cat-icon"></span>
              <span id="wp-pm2-cat"></span>
              <span class="wp-pm2-dot">•</span>
              <span id="wp-pm2-rating-hero"></span>
            </div>
          </div>
        </div>

        <!-- SCROLLABLE BODY -->
        <div id="wp-pm2-body">

          <!-- SAVED + COLLECTIONS -->
          <div class="wp-pm2-row" id="wp-pm2-saves-row">
            <div id="wp-pm2-saves">
              <div id="wp-pm2-save-avatars"></div>
              <span id="wp-pm2-save-count"></span>
            </div>
            <button class="wp-pm2-pill-btn" id="wp-pm2-collections">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Colecciones
            </button>
          </div>

          <!-- CTA ROW -->
          <div class="wp-pm2-row" id="wp-pm2-cta-row">
            <button id="wp-pm2-fuiste">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              ¿Fuiste?
            </button>
            <button id="wp-pm2-share" class="wp-pm2-icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          </div>

          <!-- ACTION PILLS -->
          <div id="wp-pm2-actions">
            <button class="wp-pm2-action" id="wp-pm2-map-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 12.5 7.35 12.8a.9.9 0 0 0 1.3 0C12.95 22.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>
              Ver en el mapa
            </button>
            <button class="wp-pm2-action" id="wp-pm2-call-btn" style="display:none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Llamar
            </button>
            <button class="wp-pm2-action" id="wp-pm2-web-btn" style="display:none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Sitio web
            </button>
            <button class="wp-pm2-action" id="wp-pm2-more-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          </div>

          <!-- HOURS -->
          <div id="wp-pm2-hours" style="display:none">
            <span id="wp-pm2-hours-text"></span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <!-- PHOTO STRIP -->
          <div id="wp-pm2-strip"></div>

          <!-- DESCRIPTION -->
          <div id="wp-pm2-desc-wrap" style="display:none">
            <p id="wp-pm2-desc"></p>
            <button id="wp-pm2-leer-mas" style="display:none">Leer más</button>
          </div>

          <!-- MAP PREVIEW -->
          <div id="wp-pm2-map-preview">
            <div id="wp-pm2-map-canvas"></div>
            <div id="wp-pm2-map-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#1a5cf5"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 12.5 7.35 12.8a.9.9 0 0 0 1.3 0C12.95 22.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>
              <span id="wp-pm2-address"></span>
            </div>
          </div>

          <!-- ETIQUETAS -->
          <div id="wp-pm2-tags-section" style="display:none">
            <div class="wp-pm2-section-title">Etiquetas</div>
            <div id="wp-pm2-tags-list"></div>
            <button id="wp-pm2-add-tag" class="wp-pm2-pill-btn">+ Etiquetar lugar</button>
          </div>

          <!-- MENCIONADO EN -->
          <div id="wp-pm2-mentions" style="display:none">
            <div class="wp-pm2-section-title">Mencionado en</div>
            <div id="wp-pm2-mentions-list"></div>
          </div>

          <!-- REVIEWS -->
          <div id="wp-pm2-reviews-section">
            <div class="wp-pm2-section-title">Comentarios y reseñas</div>
            <div id="wp-pm2-comment-input-row">
              <img id="wp-pm2-user-avatar" src="" alt="">
              <div id="wp-pm2-comment-box">
                <span>Añade un comentario...</span>
                <button id="wp-pm2-comment-send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 19V5M5 12l7-7 7 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                </button>
              </div>
            </div>
            <div id="wp-pm2-reviews-list"><p id="wp-pm2-no-reviews">¡Sé el primero en comentar!</p></div>
          </div>

          <!-- BOTTOM SPACER -->
          <div style="height:32px"></div>
        </div><!-- /body -->

        <!-- BOTTOM CTA -->
        <div id="wp-pm2-footer">
          <button id="wp-pm2-here-btn" title="Estoy aquí">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.574 21.819a.9.9 0 0 1-1.148 0C11.071 21.567 4 14.907 4 10.364a8 8 0 1 1 16 0c0 4.543-7.071 11.203-7.426 11.455ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z"/></svg>
          </button>
          <button id="wp-pm2-plan-btn">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M464 256c0-114.87-93.13-208-208-208S48 141.13 48 256s93.13 208 208 208 208-93.13 208-208Zm-228.5 91.36a16 16 0 0 1-.09-22.63L303.58 272H170a16 16 0 0 1 0-32h133.58l-52.32-52.73A16 16 0 1 1 274 164.73l79.39 80a16 16 0 0 1 0 22.54l-79.39 80A16 16 0 0 1 235.5 347.36Z"/></svg>
            Planear visita
          </button>
        </div>

      </div><!-- /card -->
    `;
    document.body.appendChild(el);
    this._el = el;
    this._injectCSS();
    this._wireEvents();
  }

  // ── CSS ────────────────────────────────────────────────────────────
  _injectCSS() {
    if (document.getElementById('wp-pm2-css')) return;
    const s = document.createElement('style');
    s.id = 'wp-pm2-css';
    s.textContent = `
      #wp-pm2 {
        display:none; position:fixed; inset:0; z-index:2100;
        font-family: var(--wp-font, Avenir, 'Avenir Next', system-ui, sans-serif);
      }
      #wp-pm2.visible { display:block; }
      #wp-pm2-backdrop {
        position:absolute; inset:0; background:rgba(0,0,0,0.4);
      }
      #wp-pm2-card {
        position:absolute; inset:0;
        background:#fff;
        display:flex; flex-direction:column;
        overflow:hidden;
        transform:translateY(100%);
        transition:transform 0.38s cubic-bezier(0.32,0.72,0,1);
      }
      #wp-pm2.visible #wp-pm2-card { transform:translateY(0); }

      /* HERO */
      #wp-pm2-hero {
        position:relative; height:52vw; min-height:200px; max-height:280px;
        flex-shrink:0; background:#e5e7eb; overflow:hidden;
      }
      #wp-pm2-hero-photos {
        display:flex; height:100%; overflow-x:auto; scroll-snap-type:x mandatory;
        scrollbar-width:none;
      }
      #wp-pm2-hero-photos::-webkit-scrollbar { display:none; }
      #wp-pm2-hero-photos img {
        width:100%; height:100%; object-fit:cover; flex-shrink:0;
        scroll-snap-align:start;
      }
      #wp-pm2-hero-gradient {
        position:absolute; inset:0;
        background:linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 40%, rgba(0,0,0,0.7) 100%);
        pointer-events:none;
      }
      #wp-pm2-back {
        position:absolute; top:calc(12px + env(safe-area-inset-top,0px)); left:12px;
        width:36px; height:36px; border-radius:50%; border:none;
        background:rgba(0,0,0,0.4); color:#fff; backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
      }
      #wp-pm2-hero-bottom {
        position:absolute; bottom:0; left:0; right:0;
        padding:12px 16px 14px;
      }
      #wp-pm2-name {
        font-size:22px; font-weight:800; color:#fff; margin:0 0 4px;
        letter-spacing:-0.3px; line-height:1.2;
      }
      #wp-pm2-meta {
        display:flex; align-items:center; gap:5px;
        font-size:13px; color:rgba(255,255,255,0.9); font-weight:500;
      }
      #wp-pm2-cat-icon { font-size:15px; }
      .wp-pm2-dot { opacity:0.6; }

      /* BODY */
      #wp-pm2-body {
        flex:1; overflow-y:auto; overscroll-behavior:contain;
        -webkit-overflow-scrolling:touch;
      }

      /* ROWS */
      .wp-pm2-row {
        display:flex; align-items:center; gap:10px;
        padding:12px 16px; border-bottom:1px solid #f3f4f6;
      }
      #wp-pm2-saves { display:flex; align-items:center; gap:8px; flex:1; }
      #wp-pm2-save-avatars { display:flex; }
      #wp-pm2-save-avatars img {
        width:26px; height:26px; border-radius:50%;
        border:2px solid #fff; margin-left:-8px; object-fit:cover;
      }
      #wp-pm2-save-avatars img:first-child { margin-left:0; }
      #wp-pm2-save-count { font-size:13px; color:#374151; font-weight:500; }
      .wp-pm2-pill-btn {
        display:inline-flex; align-items:center; gap:5px;
        padding:7px 14px; border-radius:999px; border:1.5px solid #e5e7eb;
        background:#fff; font-size:13px; font-weight:600; color:#374151;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        font-family:inherit;
      }

      /* CTA ROW */
      #wp-pm2-cta-row { gap:8px; }
      #wp-pm2-fuiste {
        flex:1; display:flex; align-items:center; justify-content:center; gap:6px;
        height:42px; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff; font-size:15px; font-weight:700;
        cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-icon-btn {
        width:42px; height:42px; border-radius:50%; border:1.5px solid #e5e7eb;
        background:#fff; display:flex; align-items:center; justify-content:center;
        cursor:pointer; color:#374151; -webkit-tap-highlight-color:transparent; flex-shrink:0;
      }

      /* ACTION PILLS */
      #wp-pm2-actions {
        display:flex; gap:8px; padding:12px 16px; overflow-x:auto;
        border-bottom:1px solid #f3f4f6; scrollbar-width:none;
      }
      #wp-pm2-actions::-webkit-scrollbar { display:none; }
      .wp-pm2-action {
        display:inline-flex; align-items:center; gap:6px;
        padding:8px 14px; border-radius:999px; border:1.5px solid #e5e7eb;
        background:#fff; font-size:13px; font-weight:600; color:#374151;
        cursor:pointer; white-space:nowrap; flex-shrink:0; font-family:inherit;
        -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-action:active { background:#f3f4f6; }

      /* HOURS */
      #wp-pm2-hours {
        display:flex; align-items:center; gap:6px;
        padding:12px 16px; font-size:13px; color:#374151;
        border-bottom:1px solid #f3f4f6; cursor:pointer;
      }
      #wp-pm2-hours-text { flex:1; font-weight:500; }

      /* PHOTO STRIP */
      #wp-pm2-strip {
        display:flex; gap:4px; padding:12px 16px;
        overflow-x:auto; scrollbar-width:none;
        border-bottom:1px solid #f3f4f6;
      }
      #wp-pm2-strip::-webkit-scrollbar { display:none; }
      #wp-pm2-strip img {
        width:120px; height:90px; object-fit:cover;
        border-radius:10px; flex-shrink:0; cursor:pointer;
      }
      #wp-pm2-strip:empty { display:none; }

      /* DESCRIPTION */
      #wp-pm2-desc-wrap { padding:14px 16px; border-bottom:1px solid #f3f4f6; }
      #wp-pm2-desc {
        margin:0; font-size:14px; line-height:1.6; color:#374151;
        display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
      }
      #wp-pm2-desc.expanded { display:block; }
      #wp-pm2-leer-mas {
        margin-top:6px; font-size:13px; font-weight:700; color:#1a5cf5;
        border:none; background:none; padding:0; cursor:pointer; font-family:inherit;
      }

      /* MAP PREVIEW */
      #wp-pm2-map-preview {
        margin:0 16px 0; border-radius:16px; overflow:hidden;
        border:1px solid #e5e7eb; cursor:pointer;
      }
      #wp-pm2-map-canvas {
        height:140px; background:#e8e8e8;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e8ede8' width='100' height='100'/%3E%3C/svg%3E");
      }
      #wp-pm2-map-label {
        display:flex; align-items:center; gap:8px;
        padding:10px 12px; background:#fff; font-size:13px; color:#374151;
      }
      #wp-pm2-address { font-weight:500; }

      /* SECTION TITLE */
      .wp-pm2-section-title {
        font-size:15px; font-weight:800; color:#0a0a0a; padding:16px 16px 8px;
        letter-spacing:-0.2px;
      }

      /* TAGS */
      #wp-pm2-tags-section { border-bottom:1px solid #f3f4f6; padding-bottom:12px; }
      #wp-pm2-tags-list { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 8px; }
      .wp-pm2-tag-pill {
        padding:5px 12px; border-radius:999px; border:1px solid #e5e7eb;
        font-size:12px; font-weight:600; color:#374151; background:#f9fafb;
      }
      #wp-pm2-add-tag { margin:0 16px; }

      /* MENTIONS */
      #wp-pm2-mentions { border-bottom:1px solid #f3f4f6; padding-bottom:16px; }
      #wp-pm2-mentions-list {
        display:flex; gap:8px; padding:0 16px; overflow-x:auto; scrollbar-width:none;
      }
      #wp-pm2-mentions-list::-webkit-scrollbar { display:none; }
      .wp-pm2-mention-card {
        width:130px; height:160px; border-radius:12px; flex-shrink:0;
        overflow:hidden; position:relative; cursor:pointer; background:#e5e7eb;
      }
      .wp-pm2-mention-card img { width:100%; height:100%; object-fit:cover; }
      .wp-pm2-mention-label {
        position:absolute; bottom:0; left:0; right:0;
        padding:6px 8px; background:linear-gradient(transparent, rgba(0,0,0,0.7));
        font-size:10px; color:#fff; font-weight:600;
      }
      .wp-pm2-mention-icon {
        position:absolute; bottom:6px; left:6px;
        width:18px; height:18px; background:rgba(0,0,0,0.5);
        border-radius:50%; display:flex; align-items:center; justify-content:center;
        font-size:10px;
      }

      /* REVIEWS */
      #wp-pm2-reviews-section { padding-bottom:8px; }
      #wp-pm2-comment-input-row {
        display:flex; align-items:center; gap:10px;
        padding:8px 16px 12px;
      }
      #wp-pm2-user-avatar {
        width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0;
        background:#e5e7eb;
      }
      #wp-pm2-comment-box {
        flex:1; display:flex; align-items:center; justify-content:space-between;
        background:#f3f4f6; border-radius:999px; padding:10px 8px 10px 16px;
        font-size:14px; color:#9ca3af; cursor:pointer;
      }
      #wp-pm2-comment-send {
        width:30px; height:30px; border-radius:50%; border:none;
        background:#6b7280; display:flex; align-items:center; justify-content:center;
        cursor:pointer; flex-shrink:0;
      }
      #wp-pm2-no-reviews { font-size:14px; color:#9ca3af; text-align:center; padding:8px 16px 16px; }
      .wp-pm2-review-row {
        display:flex; gap:10px; padding:10px 16px;
        border-top:1px solid #f3f4f6;
      }
      .wp-pm2-review-avatar {
        width:34px; height:34px; border-radius:50%; flex-shrink:0;
        background:#e5e7eb; object-fit:cover;
      }
      .wp-pm2-review-body { flex:1; }
      .wp-pm2-review-name { font-size:13px; font-weight:700; color:#0a0a0a; }
      .wp-pm2-review-stars { font-size:11px; color:#f59e0b; margin-top:1px; }
      .wp-pm2-review-text { font-size:13px; color:#374151; margin-top:4px; line-height:1.5; }

      /* FOOTER */
      #wp-pm2-footer {
        display:flex; align-items:center; gap:10px;
        padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
        border-top:1px solid #f3f4f6; background:#fff; flex-shrink:0;
      }
      #wp-pm2-here-btn {
        width:48px; height:48px; border-radius:50%; border:none;
        background:#0a0a0a; color:#fff; display:flex; align-items:center;
        justify-content:center; cursor:pointer; flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
      }
      #wp-pm2-plan-btn {
        flex:1; height:48px; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff; font-size:16px; font-weight:700;
        display:flex; align-items:center; justify-content:center; gap:8px;
        cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
      }
    `;
    document.head.appendChild(s);
  }

  // ── WIRE EVENTS ────────────────────────────────────────────────────
  _wireEvents() {
    const el = this._el;
    el.querySelector('#wp-pm2-back').addEventListener('click', () => this.hide());
    el.querySelector('#wp-pm2-backdrop').addEventListener('click', () => this.hide());

    el.querySelector('#wp-pm2-plan-btn').addEventListener('click', () => {
      console.log('[PM2] Planear visita:', this._place);
    });
    el.querySelector('#wp-pm2-here-btn').addEventListener('click', () => {
      console.log('[PM2] Estoy aquí:', this._place);
    });
    el.querySelector('#wp-pm2-fuiste').addEventListener('click', () => {
      console.log('[PM2] ¿Fuiste?:', this._place);
    });
    el.querySelector('#wp-pm2-share').addEventListener('click', () => {
      if (navigator.share && this._place) navigator.share({ title: this._place.name, url: window.location.href });
    });
    el.querySelector('#wp-pm2-map-preview').addEventListener('click', () => {
      const p = this._place;
      if (!p) return;
      const lat = p.location?.lat || p.lat;
      const lng = p.location?.lng || p.lng;
      if (lat && lng) window.open(`https://maps.google.com?q=${lat},${lng}`, '_blank');
    });
    el.querySelector('#wp-pm2-leer-mas').addEventListener('click', () => {
      el.querySelector('#wp-pm2-desc').classList.add('expanded');
      el.querySelector('#wp-pm2-leer-mas').style.display = 'none';
    });
    el.querySelector('#wp-pm2-map-btn').addEventListener('click', () => {
      console.log('[PM2] Ver en mapa');
    });
    el.querySelector('#wp-pm2-add-tag').addEventListener('click', () => {
      console.log('[PM2] Etiquetar lugar');
    });
    el.querySelector('#wp-pm2-comment-box').addEventListener('click', () => {
      console.log('[PM2] Añadir comentario');
    });
  }

  // ── SHOW ──────────────────────────────────────────────────────────
  show(place) {
    this._fromSearch = false;
    this._place = place;
    this._populate(place);
    this._el.classList.add('visible');
    document.body.style.overflow = 'hidden';
    this._el.querySelector('#wp-pm2-body').scrollTop = 0;
  }

  // Alias para compatibilidad con app.js — el minisnap ya lo maneja MapView,
  // al hacer tap sobre él llama onPlaceSelect que llega aquí como show()
  showMini(place) {
    // En PlaceModal2 no hay minisnap propio — delegamos al MapView
    // a través del onPlaceSelect ya configurado en app.js
    if (this.onPlaceSelect) this.onPlaceSelect(place);
    else this.show(place);
  }

  hide() {
    this._el.classList.remove('visible');
    document.body.style.overflow = '';
    this._place = null;
  }

  // ── POPULATE ──────────────────────────────────────────────────────
  _populate(place) {
    const $ = id => this._el.querySelector('#' + id);

    // Name
    $('wp-pm2-name').textContent = place.name || '';

    // Category + icon
    const catIcon = place.subcategory_icon || place.category_icon || '';
    const catName = place.subcategory_label || place.category_label || place.category || '';
    $('wp-pm2-cat-icon').textContent = catIcon;
    $('wp-pm2-cat').textContent = catName;

    // Rating
    const rating = parseFloat(place.rating);
    $('wp-pm2-rating-hero').textContent = rating ? '⭐ ' + rating.toFixed(1) : '';

    // Hero photos
    const photosEl = $('wp-pm2-hero-photos');
    photosEl.innerHTML = '';
    const rawPhotos = place.photos || (place.photo_url ? [place.photo_url] : []);
    const photos = rawPhotos.slice(0, 6).map(u => this.proxyPhoto(u)).filter(Boolean);
    if (photos.length) {
      photos.forEach(url => {
        const img = document.createElement('img');
        img.src = url; img.alt = '';
        photosEl.appendChild(img);
      });
    } else {
      photosEl.style.background = '#e5e7eb';
    }

    // Photo strip
    const stripEl = $('wp-pm2-strip');
    stripEl.innerHTML = '';
    photos.slice(1).forEach(url => {
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.loading = 'lazy';
      stripEl.appendChild(img);
    });

    // Phone
    const phone = place.phone || place.phone_number;
    const callBtn = $('wp-pm2-call-btn');
    if (phone) { callBtn.style.display = ''; callBtn.onclick = () => window.open('tel:' + phone); }
    else callBtn.style.display = 'none';

    // Website
    const web = place.website;
    const webBtn = $('wp-pm2-web-btn');
    if (web) { webBtn.style.display = ''; webBtn.onclick = () => window.open(web, '_blank'); }
    else webBtn.style.display = 'none';

    // Hours
    const hours = place.hours || place.opening_hours;
    const hoursEl = $('wp-pm2-hours');
    if (hours) {
      $('wp-pm2-hours-text').textContent = typeof hours === 'string' ? hours : 'Ver horarios';
      hoursEl.style.display = 'flex';
    } else {
      hoursEl.style.display = 'none';
    }

    // Description
    const desc = place.ai_description || place.description;
    const descWrap = $('wp-pm2-desc-wrap');
    if (desc) {
      descWrap.style.display = '';
      const descEl = $('wp-pm2-desc');
      descEl.textContent = desc;
      descEl.classList.remove('expanded');
      const leer = $('wp-pm2-leer-mas');
      setTimeout(() => {
        leer.style.display = descEl.scrollHeight > descEl.clientHeight + 4 ? '' : 'none';
      }, 50);
    } else {
      descWrap.style.display = 'none';
    }

    // Address + map
    const addr = place.address || place.formatted_address || '';
    $('wp-pm2-address').textContent = addr;
    const lat = place.location?.lat || place.lat;
    const lng = place.location?.lng || place.lng;
    if (lat && lng) {
      $('wp-pm2-map-canvas').style.backgroundImage =
        `url('https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=color:blue%7C${lat},${lng}&style=feature:poi%7Cvisibility:off&key=')`;
      $('wp-pm2-map-canvas').style.backgroundSize = 'cover';
    }

    // Tags
    const tags = place.tags || place.place_tags || [];
    const tagsSection = $('wp-pm2-tags-section');
    const tagsList = $('wp-pm2-tags-list');
    tagsList.innerHTML = '';
    if (tags.length) {
      tags.forEach(t => {
        const tag = PLACE_TAGS.find(pt => pt.key === (t.tag_key || t));
        if (!tag) return;
        const span = document.createElement('span');
        span.className = 'wp-pm2-tag-pill';
        span.textContent = tag.emoji + ' ' + tag.label;
        tagsList.appendChild(span);
      });
    }
    tagsSection.style.display = '';

    // Saves (placeholder)
    $('wp-pm2-save-count').textContent = (place.saves_count || 0) + ' guardados';
    $('wp-pm2-save-avatars').innerHTML = '';

    // User avatar
    const user = this.getCurrentUser?.();
    const avatarEl = $('wp-pm2-user-avatar');
    if (user?.user_metadata?.avatar_url) avatarEl.src = user.user_metadata.avatar_url;
    else avatarEl.src = '';

    // Reviews (async)
    this._loadReviews(place);
  }

  async _loadReviews(place) {
    const listEl = this._el.querySelector('#wp-pm2-reviews-list');
    try {
      const reviews = await ReviewService.getForPlace(place.place_id || place.id);
      if (!reviews?.length) {
        listEl.innerHTML = '<p id="wp-pm2-no-reviews">¡Sé el primero en comentar!</p>';
        return;
      }
      listEl.innerHTML = '';
      reviews.slice(0, 5).forEach(r => {
        const row = document.createElement('div');
        row.className = 'wp-pm2-review-row';
        const stars = r.rating ? '⭐'.repeat(Math.round(r.rating)) : '';
        row.innerHTML = `
          <img class="wp-pm2-review-avatar" src="${r.avatar_url || ''}" onerror="this.style.background='#e5e7eb'">
          <div class="wp-pm2-review-body">
            <div class="wp-pm2-review-name">${r.display_name || 'Usuario'}</div>
            ${stars ? `<div class="wp-pm2-review-stars">${stars}</div>` : ''}
            <div class="wp-pm2-review-text">${r.text || ''}</div>
          </div>`;
        listEl.appendChild(row);
      });
    } catch(e) {
      listEl.innerHTML = '<p id="wp-pm2-no-reviews">¡Sé el primero en comentar!</p>';
    }
  }

  isVisible() { return this._el?.classList.contains('visible'); }
}