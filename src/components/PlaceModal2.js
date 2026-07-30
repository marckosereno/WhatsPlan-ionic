// ══════════════════════════════════════════════════════════════════════
// WHATSPLAN — PlaceModal2.js  (diseño alternativo, Google Maps-inspired)
// ══════════════════════════════════════════════════════════════════════
import { PlaceTagService, PLACE_TAGS } from '/src/services/PlaceTagService.js';
import { ReviewService }               from '/src/services/ReviewService.js';
import { ActivityService }             from '/src/services/SupabaseService.js';
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

        <!-- WHITE OVERLAY grows upward on scroll -->
<!-- TOPBAR -->
        <div id="wp-pm2-topbar">
          <button id="wp-pm2-back">
            <svg width="18" height="18" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="244 400 100 256 244 112" style="fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:48px"/><line x1="120" y1="256" x2="412" y2="256" style="fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:48px"/></svg>
          </button>
          <span id="wp-pm2-topbar-title"></span>
          <div id="wp-pm2-topbar-actions">
            <button id="wp-pm2-topbar-share" class="wp-pm2-tb-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
            </button>
            <button id="wp-pm2-topbar-more" class="wp-pm2-tb-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
        </div>
        <!-- FADE — degradado blanco pegado debajo del topbar; el contenido
             que scrollea ahí se desvanece gradual en vez de cortarse -->
        <div id="wp-pm2-topbar-fade"></div>

        <!-- ACTIVITY STACK — mini-fichas en abanico (fixed, no ocupa lugar
             en el layout). Muestran actividades creadas en este lugar; si
             no hay ninguna, invita a crear una. Se ocultan a la derecha
             con el scroll y se restauran al volver arriba. -->
        <div id="wp-pm2-activity-stack"></div>

        <!-- CONTENT AREA — hero (overlay, absolute) encima de body (absolute
             inset:0, ocupa TODA el área incl. detrás del hero). Así el
             spacer dentro del body queda tapado por el hero al inicio, sin
             espacio "de más". -->
        <div id="wp-pm2-content-area">

          <!-- HERO — viewport que se encoge. Adentro, DOS wrappers de alto
               FIJO (fullH) que se trasladan hacia arriba a DISTINTA
               velocidad:
               - hero-inner: solo la FOTO, parallax lento
               - hero-overlay-fast: gradiente/sombra + título/rating, a la
                 misma velocidad que el contenido real — así llegan juntos
                 arriba y se disuelven en la sombra del topbar -->
          <div id="wp-pm2-hero">
            <div id="wp-pm2-hero-inner">
              <div id="wp-pm2-hero-bg"></div>
            </div>
            <div id="wp-pm2-hero-overlay-fast">
              <div id="wp-pm2-hero-gradient"></div>
              <div id="wp-pm2-hero-bottom">
                <span id="wp-pm2-featured-badge" class="wp-pm2-featured-badge" style="display:none"></span>
                <h1 id="wp-pm2-name"></h1>
                <div id="wp-pm2-meta">
                  <span id="wp-pm2-cat"></span>
                  <span class="wp-pm2-dot">•</span>
                  <span id="wp-pm2-rating-hero"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- SCROLLABLE BODY — cubre TODA el content-area (incl. detrás del
               hero); el spacer (alto = travel) queda tapado por el hero -->
          <div id="wp-pm2-body">

          <!-- SPACER — alto = recorrido del hero (travel); queda tapado -->
          <div id="wp-pm2-scroll-spacer"></div>

          <!-- ETIQUETAR LUGAR — pausado por ahora (aún decidiendo dónde
               ubicarlo). El CSS/JS sigue en el archivo (#wp-pm2-tag-row,
               _wireTagToggle, _renderTagScroll, _loadTags) para reactivarlo
               fácil el día que se defina su lugar — por eso no se borró,
               solo se sacó el nodo del DOM para no dejar espacio vacío. -->

          <!-- REVIEWS SUMMARY — avatares (máx 6) + cantidad de reseñas -->
          <div id="wp-pm2-reviews-summary" style="display:none">
            <div id="wp-pm2-reviews-avatars"></div>
            <span id="wp-pm2-reviews-count"></span>
            <button id="wp-pm2-add-review" class="wp-pm2-pill-btn">Añadir reseña</button>
          </div>

          <!-- AI DESCRIPTION — generada con IA en base a las reseñas de Google,
               misma función que PlaceModal1 (_populateAI + /api/groq-description) -->
          <div class="wp-pm2-ai-block" id="wp-pm2-ai-block" style="display:none">
            <div class="wp-pm2-ai-header">
              <svg class="wp-pm2-ai-icon" width="16" height="16" viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path class="wp-pm2-spark wp-pm2-spark-1" d="M208,512a24.84,24.84,0,0,1-23.34-16l-39.84-103.6a16.06,16.06,0,0,0-9.19-9.19L32,343.34a25,25,0,0,1,0-46.68l103.6-39.84a16.06,16.06,0,0,0,9.19-9.19L184.66,144a25,25,0,0,1,46.68,0l39.84,103.6a16.06,16.06,0,0,0,9.19,9.19l103,39.63A25.49,25.49,0,0,1,400,320.52a24.82,24.82,0,0,1-16,22.82l-103.6,39.84a16.06,16.06,0,0,0-9.19,9.19L231.34,496A24.84,24.84,0,0,1,208,512Z"/><path class="wp-pm2-spark wp-pm2-spark-2" d="M88,176a14.67,14.67,0,0,1-13.69-9.4L57.45,122.76a7.28,7.28,0,0,0-4.21-4.21L9.4,101.69a14.67,14.67,0,0,1,0-27.38L53.24,57.45a7.31,7.31,0,0,0,4.21-4.21L74.16,9.79A15,15,0,0,1,86.23.11,14.67,14.67,0,0,1,101.69,9.4l16.86,43.84a7.31,7.31,0,0,0,4.21,4.21L166.6,74.31a14.67,14.67,0,0,1,0,27.38l-43.84,16.86a7.28,7.28,0,0,0-4.21,4.21L101.69,166.6A14.67,14.67,0,0,1,88,176Z"/><path class="wp-pm2-spark wp-pm2-spark-3" d="M400,256a16,16,0,0,1-14.93-10.26l-22.84-59.37a8,8,0,0,0-4.6-4.6l-59.37-22.84a16,16,0,0,1,0-29.86l59.37-22.84a8,8,0,0,0,4.6-4.6L384.9,42.68a16.45,16.45,0,0,1,13.17-10.57,16,16,0,0,1,16.86,10.15l22.84,59.37a8,8,0,0,0,4.6,4.6l59.37,22.84a16,16,0,0,1,0,29.86l-59.37,22.84a8,8,0,0,0-4.6,4.6l-22.84,59.37A16,16,0,0,1,400,256Z"/></svg>
              <span class="wp-pm2-ai-badge">Descripción generada con IA</span>
            </div>
            <div class="wp-pm2-ai-text" id="wp-pm2-ai-text"></div>
            <div class="wp-pm2-ai-skeleton" id="wp-pm2-ai-skeleton">
              <div class="wp-pm2-ai-sk-line"></div>
              <div class="wp-pm2-ai-sk-line"></div>
              <div class="wp-pm2-ai-sk-line"></div>
              <div class="wp-pm2-ai-sk-line"></div>
              <div class="wp-pm2-ai-sk-line"></div>
              <div class="wp-pm2-ai-sk-line" style="width:60%"></div>
            </div>
          </div>

          <!-- CTA ROW — oculto por ahora -->
          <div class="wp-pm2-row" id="wp-pm2-cta-row" style="display:none">
            <button id="wp-pm2-fuiste">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              ¿Fuiste?
            </button>
            <button id="wp-pm2-share" class="wp-pm2-icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
            </button>
          </div>

          <!-- ACTION PILLS -->
          <div id="wp-pm2-actions">
            <button class="wp-pm2-action" id="wp-pm2-map-btn">
              <span class="wp-pm2-action-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 12.5 7.35 12.8a.9.9 0 0 0 1.3 0C12.95 22.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg></span>
              Ver en el mapa
            </button>
            <button class="wp-pm2-action" id="wp-pm2-call-btn" style="display:none">
              <span class="wp-pm2-action-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
              Llamar
            </button>
            <button class="wp-pm2-action" id="wp-pm2-web-btn" style="display:none">
              <span class="wp-pm2-action-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
              Sitio web
            </button>
            <button class="wp-pm2-action" id="wp-pm2-more-btn">
              <span class="wp-pm2-action-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></span>
            </button>
          </div>

          <!-- HOURS — colapsable, igual que PlaceModal1 -->
          <div class="wp-pm2-hours-block" id="wp-pm2-hours" style="display:none">
            <div class="wp-pm2-hours-trigger" id="wp-pm2-hours-trigger">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#6b7280"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 100-16 8 8 0 000 16zm1-8V7a1 1 0 00-2 0v5a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L13 11.586z"/></svg>
              <span id="wp-pm2-hours-text"></span>
              <span class="wp-pm2-hours-status" id="wp-pm2-hours-status"></span>
              <svg class="wp-pm2-chevron" id="wp-pm2-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="wp-pm2-hours-list" id="wp-pm2-hours-list"></div>
          </div>

          <!-- PHOTO STRIP -->
          <div class="wp-pm2-section-heading">Fotos</div>
          <div id="wp-pm2-strip"></div>

          <!-- ADDRESS + MAP — misma fuente que el trigger de horarios -->
          <div class="wp-pm2-section-heading">Ubicación</div>
          <div id="wp-pm2-address-row" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 7.05 12.5 7.35 12.8a.9.9 0 0 0 1.3 0C12.95 22.5 20 15.4 20 10a8 8 0 0 0-8-8z"/></svg>
            <span id="wp-pm2-address"></span>
          </div>

          <!-- MAP PREVIEW — zoom 14, pin propio con el emoji de categoría -->
          <div id="wp-pm2-map-preview">
            <div id="wp-pm2-map-canvas"></div>
          </div>

          <!-- DESCRIPTION -->
          <div id="wp-pm2-desc-wrap" style="display:none">
            <p id="wp-pm2-desc"></p>
            <button id="wp-pm2-leer-mas" style="display:none">Leer más</button>
          </div>

          <!-- MENCIONADO EN -->
          <div id="wp-pm2-mentions" style="display:none">
            <div class="wp-pm2-section-title">Mencionado en</div>
            <div id="wp-pm2-mentions-list"></div>
          </div>

          <!-- REVIEWS -->
          <div id="wp-pm2-reviews-section">
            <div class="wpr-header-row" id="wpr-header-row"></div>
            <div id="wp-pm2-comment-input-row">
              <img id="wp-pm2-user-avatar" src="" alt="">
              <div id="wp-pm2-comment-box">
                <span>Añade un comentario...</span>
                <button id="wp-pm2-comment-send">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 19V5M5 12l7-7 7 7" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                </button>
              </div>
            </div>
            <div id="wpr-panel-google"></div>
            <div id="wpr-panel-community" style="display:none"></div>
          </div>

          <!-- BOTTOM SPACER — deja aire para que el footer flotante no tape
               el último contenido -->
          <div style="height:96px"></div>
        </div><!-- /body -->

        </div><!-- /content-area -->

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

    // Fuentes: Instrument Serif (título del hero) + Inter (descripción y reseñas)
    if (!document.getElementById('wp-pm2-fonts')) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
      const fontLink = document.createElement('link');
      fontLink.id = 'wp-pm2-fonts'; fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap';
      document.head.appendChild(pre1);
      document.head.appendChild(pre2);
      document.head.appendChild(fontLink);
    }

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
      #wp-pm2-card > #wp-pm2-topbar { position:absolute; }
      #wp-pm2.visible #wp-pm2-card { transform:translateY(0); }

      /* TOPBAR BG — foto del hero con blur, aparece al hacer scroll */
      /* TOPBAR */
      #wp-pm2-topbar {
        position:fixed; top:0; left:0; right:0;
        height:calc(68px + env(safe-area-inset-top,0px));
        padding-top:env(safe-area-inset-top,0px);
        display:flex; align-items:center;
        padding-left:12px; padding-right:12px;
        z-index:10; background:transparent;
        overflow:hidden;
      }
      /* Topbar 100% transparente (estilo iOS26): no tiene fondo propio, ni
         el del hero. El fondo detrás es #wp-pm2-topbar-fade, que sube
         desde y=0 y hace crossfade con el hero mientras éste se desvanece. */
      #wp-pm2-topbar-fade {
        position:fixed;
        /* Desde arriba del todo (y=0, status bar) hacia abajo — el hero
           ahora colapsa hasta 0 de verdad (fix en onScroll), así que ya
           no queda ningún remanente blanco estacionado que se sume a esto
           y genere el "fondo" que aparecía antes. */
        top:0;
        left:0; right:0;
        height:calc(env(safe-area-inset-top,20px) + 100px);
        background:linear-gradient(to bottom,
          rgba(255,255,255,0.95) 0%,
          rgba(255,255,255,0.7) 55%,
          rgba(255,255,255,0) 100%);
        z-index:9; pointer-events:none;
        /* Arranca bien transparente; JS sube la opacidad y agrega blur a
           medida que se scrollea (ver onScroll) */
        opacity:0.4;
        transition:opacity 0.05s linear;
      }

      /* ACTIVITY STACK — mini-fichas en abanico, fixed en la esquina */
      #wp-pm2-activity-stack {
        position:fixed;
        top:calc(78px + env(safe-area-inset-top,0px));
        right:2px;
        width:92px; height:118px;
        z-index:6; pointer-events:none;
        transform-origin:right center;
        transition:transform 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease;
      }
      #wp-pm2-activity-stack .wp-pm2-activity-card {
        position:absolute; inset:0;
        border-radius:18px; padding:10px;
        display:flex; flex-direction:column; justify-content:space-between;
        box-shadow:0 8px 20px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10);
        pointer-events:auto; cursor:pointer;
        transform:rotate(var(--rot,0deg)) translate(var(--tx,0), var(--ty,0)) scale(0.4);
        opacity:0;
        animation: wp-pm2-activity-in 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
        animation-delay: var(--delay, 0s);
      }
      @keyframes wp-pm2-activity-in {
        0%   { transform:rotate(var(--rot,0deg)) translate(var(--tx,0), var(--ty,0)) scale(0.4); opacity:0; }
        60%  { opacity:1; }
        100% { transform:rotate(var(--rot,0deg)) translate(var(--tx,0), var(--ty,0)) scale(1); opacity:1; }
      }
      .wp-pm2-activity-date {
        display:flex; flex-direction:column; align-items:center; line-height:1;
        background:rgba(255,255,255,0.35); border-radius:10px; padding:5px 8px;
        align-self:flex-start; backdrop-filter:blur(4px);
      }
      .wp-pm2-activity-date .d { font-size:16px; font-weight:800; color:#fff; }
      .wp-pm2-activity-date .m {
        font-size:9px; font-weight:700; color:rgba(255,255,255,0.85);
        text-transform:uppercase; letter-spacing:0.04em; margin-top:1px;
      }
      .wp-pm2-activity-title {
        font-size:11.5px; font-weight:700; color:#fff; line-height:1.25;
        text-shadow:0 1px 3px rgba(0,0,0,0.2);
        display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
        overflow:hidden;
      }
      .wp-pm2-activity-people {
        display:flex; align-items:center; gap:4px;
      }
      .wp-pm2-activity-avatar {
        width:20px; height:20px; border-radius:50%;
        border:1.5px solid rgba(255,255,255,0.85); object-fit:cover;
      }
      .wp-pm2-activity-people span {
        font-size:10px; font-weight:700; color:rgba(255,255,255,0.9);
      }
      /* Estado vacío: invitación a crear actividad */
      .wp-pm2-activity-empty {
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        gap:6px; background:repeating-linear-gradient(135deg,#f3f4f6,#f3f4f6 8px,#eceef1 8px,#eceef1 16px);
        border:1.5px dashed #c7cbd1;
      }
      .wp-pm2-activity-empty svg { color:#9ca3af; }
      .wp-pm2-activity-empty span {
        font-size:11px; font-weight:700; color:#6b7280; text-align:center;
        text-shadow:none; -webkit-line-clamp:2;
      }

      #wp-pm2-back {
        position:relative; z-index:1;
        width:44px; height:44px; border-radius:9999px; border:none; flex-shrink:0;
        background:rgba(255,255,255,0.88);
        backdrop-filter:blur(16px) saturate(1.8);
        -webkit-backdrop-filter:blur(16px) saturate(1.8);
        box-shadow:0 4px 16px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.9);
        color:#111; display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s; flex-shrink:0;
      }
      #wp-pm2-topbar-title {
        position:relative; z-index:1; margin-left:12px;
        flex:1 1 auto; min-width:0; max-width:85%;
        font-size:16px; font-weight:800; color:#111;
        letter-spacing:-0.2px; opacity:0;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        text-align:left;
      }
      #wp-pm2-topbar-actions {
        margin-left:auto; display:flex; align-items:center; gap:8px;
        position:relative; z-index:1;
      }
      .wp-pm2-tb-btn {
        width:40px; height:40px; border-radius:9999px; border:none; flex-shrink:0;
        background:rgba(255,255,255,0.88);
        backdrop-filter:blur(16px) saturate(1.8);
        -webkit-backdrop-filter:blur(16px) saturate(1.8);
        box-shadow:0 4px 16px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.9);
        color:#111; display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:transform 0.15s;
      }
      .wp-pm2-tb-btn:active { transform:scale(0.92); }

      /* CONTENT AREA — hero (overlay) encima de body (ocupa TODO el área,
         incl. detrás del hero) */
      #wp-pm2-content-area {
        position:relative; flex:1; overflow:hidden;
      }

      /* HERO — overlay absoluto que se encoge (overflow:hidden) */
      #wp-pm2-hero {
        position:absolute; top:0; left:0; right:0; z-index:5;
        height:72vw; min-height:260px; max-height:380px;
        overflow:hidden; background:transparent;
        will-change:height;
      }
      /* Wrapper de alto FIJO (= alto inicial del hero) que se traslada hacia
         arriba. Imagen + gradiente + título viven aquí y suben juntos. */
      #wp-pm2-hero-inner {
        position:absolute; top:0; left:0; right:0;
        will-change:transform;
      }
      #wp-pm2-hero-overlay-fast {
        position:absolute; top:0; left:0; right:0;
        will-change:transform;
        z-index:2;
      }
      #wp-pm2-hero-bg {
        position:absolute; inset:0;
        background-size:cover; background-position:center;
      }
      #wp-pm2-hero-gradient {
        position:absolute; left:0; right:0; bottom:0;
        height:60%; /* ocupa el 60% inferior del hero */
        background:linear-gradient(to bottom,
          transparent 0%,
          rgba(255,255,255,0.6) 50%,
          rgba(255,255,255,1) 100%);
        pointer-events:none;
        z-index:2;
        will-change:opacity;
      }
      #wp-pm2-hero-bottom {
        position:absolute; bottom:0; left:0; right:0;
        padding:8px 16px 16px; z-index:3;
      }
      .wp-pm2-featured-badge {
        display:inline-block; font-size:10px; font-weight:700; padding:3px 8px;
        border-radius:9999px; white-space:nowrap; letter-spacing:0.01em;
        margin-bottom:6px;
      }
      .wp-pm2-badge-featured {
        background:linear-gradient(135deg,#fef3c7,#fde68a);
        color:#92400e; border:1px solid rgba(253,230,138,0.6);
        box-shadow:0 2px 6px rgba(251,191,36,0.25);
      }
      .wp-pm2-badge-verified {
        background:linear-gradient(135deg,#f2f2f2,#e5e5e5);
        color:#111111; border:1px solid rgba(180,180,180,0.6);
        box-shadow:0 2px 6px rgba(28,28,30,0.20);
      }
      .wp-pm2-badge-premium {
        background:linear-gradient(135deg,#f3e8ff,#e9d5ff);
        color:#6b21a8; border:1px solid rgba(216,180,254,0.6);
        box-shadow:0 2px 6px rgba(168,85,247,0.22);
      }
      #wp-pm2-name {
        font-size:24px; font-weight:800; color:#0a0a0a; margin:0 0 4px;
        letter-spacing:-0.4px; line-height:1.2;
        max-width:70%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        font-family:'Instrument Serif', serif;
      }
      #wp-pm2-meta {
        display:flex; align-items:center; gap:5px;
        font-size:13px; color:#374151; font-weight:500;
      }
      .wp-pm2-dot { opacity:0.5; }

      /* BODY — ocupa TODA el content-area (incl. detrás del hero); el
         spacer de adentro queda tapado por el hero mientras esté grande */
      #wp-pm2-body {
        position:absolute; inset:0; z-index:1;
        overflow-y:auto; overscroll-behavior:contain;
        -webkit-overflow-scrolling:touch;
        background:#fff;
      }
      #wp-pm2-scroll-spacer {
        width:100%; height:0; /* alto real (=travel) seteado por JS */
      }

      /* AI DESCRIPTION */
      .wp-pm2-ai-block {
        margin:4px 16px 12px; padding:0; background:transparent; border:none;
        display:flex; flex-direction:column; gap:8px;
      }
      .wp-pm2-ai-header { display:flex; align-items:center; gap:8px; }
      .wp-pm2-ai-icon {
        flex-shrink:0; color:#1c1c1e; transition:color 0.3s ease;
        filter:drop-shadow(0 0 6px rgba(28,28,30,0.4));
        overflow:visible;
      }
      .wp-pm2-ai-badge {
        font-size:10px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase;
        color:#000; background:linear-gradient(135deg,#f2f2f2,#e5e5e5);
        border:1px solid rgba(180,180,180,0.5); padding:3px 9px; border-radius:999px;
        font-family:inherit; box-shadow:0 2px 6px rgba(28,28,30,0.15);
      }
      @keyframes wp-pm2-ai-pulse {
        0%   { color:#60a5fa; filter:drop-shadow(0 0 6px rgba(96,165,250,0.5)); }
        50%  { color:#818cf8; filter:drop-shadow(0 0 10px rgba(129,140,248,0.7)); }
        100% { color:#60a5fa; filter:drop-shadow(0 0 6px rgba(96,165,250,0.5)); }
      }
      .wp-pm2-ai-pulse { animation: wp-pm2-ai-pulse 1.4s ease-in-out infinite; }
      /* Cada sparkle tiene SU PROPIO color cíclico + SU PROPIO pulse, con
         distinta duración/delay — se ven "vivos" e independientes, no
         parpadeando todos al unísono */
      .wp-pm2-spark { transform-box:fill-box; transform-origin:center; }
      @keyframes wp-pm2-spark-color {
        0%   { fill:#60a5fa; }
        25%  { fill:#a78bfa; }
        50%  { fill:#f472b6; }
        75%  { fill:#fb923c; }
        100% { fill:#60a5fa; }
      }
      @keyframes wp-pm2-spark-scale {
        0%,100% { transform:scale(1); opacity:0.85; }
        50%     { transform:scale(1.1); opacity:1; }
      }
      .wp-pm2-ai-pulse .wp-pm2-spark-1 {
        animation: wp-pm2-spark-color 2.4s ease-in-out infinite,
                   wp-pm2-spark-scale 1.1s ease-in-out infinite;
      }
      .wp-pm2-ai-pulse .wp-pm2-spark-2 {
        animation: wp-pm2-spark-color 3.1s ease-in-out infinite 0.4s,
                   wp-pm2-spark-scale 1.6s ease-in-out infinite 0.2s;
      }
      .wp-pm2-ai-pulse .wp-pm2-spark-3 {
        animation: wp-pm2-spark-color 2.7s ease-in-out infinite 0.8s,
                   wp-pm2-spark-scale 1.3s ease-in-out infinite 0.5s;
      }
      @keyframes wp-pm2-dot-pulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%     { opacity:0.5; transform:scale(0.8); }
      }
      @keyframes wp-pm2-ai-fadein {
        from { opacity:0; transform:translateY(4px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .wp-pm2-ai-text {
        font-size:14px; line-height:1.6; color:#3a3a3c; font-weight:400;
        animation: wp-pm2-ai-fadein 0.4s ease both;
        font-family:'Inter Tight',sans-serif;
      }
      @keyframes wp-pm2-skeleton-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .wp-pm2-ai-skeleton { display:flex; flex-direction:column; gap:8px; }
      .wp-pm2-ai-sk-line {
        height:12px; border-radius:6px; width:100%;
        background:linear-gradient(90deg,#e8eaed 25%,#f3f4f6 50%,#e8eaed 75%);
        background-size:200% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      /* Skeleton de imágenes — sin !important: cada regla iguala/supera la
         especificidad de la regla base del elemento que targetea, así gana
         por cascada normal. El hero usa ::before (no toca su background-image
         real, que lo pone JS directamente sobre el div). */
      #wp-pm2-hero-bg.wp-pm2-skel::before {
        content:''; position:absolute; inset:0;
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      #wp-pm2-strip img.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      #wp-pm2-reviews-avatars .wp-pm2-fp-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      .wp-pm2-review-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      #wp-pm2-user-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s ease-in-out infinite;
      }

      /* ROWS */
      .wp-pm2-row {
        display:flex; align-items:center; gap:10px;
        padding:12px 16px;
      }
      .wp-pm2-pill-btn {
        display:inline-flex; align-items:center; gap:5px;
        padding:7px 14px; border-radius:999px; border:1.5px solid #e5e7eb;
        background:#fff; font-size:13px; font-weight:600; color:#374151;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        font-family:inherit;
      }

      /* CTA ROW */
      /* ETIQUETAR LUGAR — chip + scroll horizontal fullwidth de tags */
      #wp-pm2-tag-row {
        display:flex; align-items:center; gap:8px;
        padding:6px 16px 8px;
      }
      #wp-pm2-tag-toggle-btn { flex-shrink:0; }
      #wp-pm2-tag-toggle-btn.wp-pm2-active {
        background:#0a0a0a; color:#fff; border-color:#0a0a0a;
      }
      #wp-pm2-tag-scroll {
        flex:1; min-width:0; display:flex; gap:6px;
        overflow-x:auto; scrollbar-width:none;
      }
      #wp-pm2-tag-scroll::-webkit-scrollbar { display:none; }
      .wp-pm2-tag-chip {
        flex-shrink:0; white-space:nowrap;
        padding:6px 12px; border-radius:999px; border:1px solid #e5e7eb;
        font-size:12px; font-weight:600; color:#374151; background:#f9fafb;
        font-family:inherit;
      }
      /* Modo selección: chips tocables, con estado activo/inactivo */
      button.wp-pm2-tag-chip {
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:transform 0.1s ease;
      }
      button.wp-pm2-tag-chip:active { transform:scale(0.95); }
      button.wp-pm2-tag-chip.wp-pm2-tag-selected {
        background:#dbeafe; border-color:#93c5fd; color:#1d4ed8;
      }

      /* REVIEWS SUMMARY — facepile de avatares + contador */
      #wp-pm2-reviews-summary {
        display:flex; align-items:center; gap:8px;
        padding:4px 16px 12px; margin-top:-28px;
      }
      #wp-pm2-reviews-avatars {
        display:flex; align-items:center;
      }
      #wp-pm2-reviews-avatars .wp-pm2-fp-avatar {
        width:28px; height:28px; border-radius:9999px;
        border:2px solid #fff; background:#e2e8f0;
        object-fit:cover;
        margin-left:-8px; flex-shrink:0; position:relative;
      }
      #wp-pm2-reviews-avatars .wp-pm2-fp-more {
        width:28px; height:28px; border-radius:9999px;
        border:2px solid #fff; background:#374151;
        margin-left:-8px; flex-shrink:0; position:relative;
        display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; color:#fff;
      }
      #wp-pm2-reviews-avatars .wp-pm2-fp-avatar:first-child { margin-left:0; }
      #wp-pm2-reviews-count {
        font-size:13px; font-weight:600; color:#374151;
      }
      #wp-pm2-add-review {
        margin-left:auto; padding:6px 12px; font-size:12px; flex-shrink:0;
      }

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
        display:flex; gap:10px; padding:14px 16px; overflow-x:auto;
        scrollbar-width:none;
      }
      #wp-pm2-actions::-webkit-scrollbar { display:none; }
      .wp-pm2-action {
        display:inline-flex; align-items:center; gap:8px;
        padding:8px 16px 8px 8px; border-radius:999px; border:none;
        background:#fff; font-size:13px; font-weight:700; color:#1f2937;
        cursor:pointer; white-space:nowrap; flex-shrink:0; font-family:inherit;
        -webkit-tap-highlight-color:transparent;
        box-shadow:0 2px 10px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
        transition:transform 0.12s ease, box-shadow 0.12s ease;
      }
      .wp-pm2-action:active { transform:scale(0.96); box-shadow:0 1px 4px rgba(0,0,0,0.08); }
      .wp-pm2-action-icon {
        width:26px; height:26px; border-radius:50%; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
      }
      #wp-pm2-map-btn .wp-pm2-action-icon  { background:#dbeafe; color:#2563eb; }
      #wp-pm2-call-btn .wp-pm2-action-icon { background:#dcfce7; color:#16a34a; }
      #wp-pm2-web-btn .wp-pm2-action-icon  { background:#ede9fe; color:#7c3aed; }
      #wp-pm2-more-btn { padding:8px; }
      #wp-pm2-more-btn .wp-pm2-action-icon { background:#f3f4f6; color:#4b5563; }

      /* HOURS — colapsable */
      .wp-pm2-hours-trigger {
        display:flex; align-items:center; gap:8px;
        padding:12px 16px; cursor:pointer; font-size:14px; color:#374151;
        -webkit-tap-highlight-color:transparent;
      }
      #wp-pm2-hours-text { flex:1; font-weight:500; }
      .wp-pm2-hours-status {
        font-size:12px; font-weight:600; padding:2px 8px; border-radius:9999px;
      }
      .wp-pm2-hours-status.wp-pm2-open   { background:#e8fdf0; color:#16a34a; }
      .wp-pm2-hours-status.wp-pm2-closed { background:#fff1f0; color:#ef4444; }
      .wp-pm2-chevron { transition:transform 0.25s ease; flex-shrink:0; }
      .wp-pm2-hours-list {
        max-height:0; overflow:hidden;
        transition:max-height 0.3s ease;
        padding:0 16px;
      }
      .wp-pm2-hours-list.expanded { max-height:300px; padding-bottom:8px; }
      .wp-pm2-hours-row {
        display:flex; justify-content:space-between;
        padding:6px 0; font-size:13px; color:#9ca3af;
        border-bottom:0.5px solid #e5e5ea;
      }
      .wp-pm2-hours-row:last-child { border-bottom:none; }
      .wp-pm2-hours-day { min-width:90px; }
      .wp-pm2-hours-today .wp-pm2-hours-day,
      .wp-pm2-hours-today .wp-pm2-hours-time { color:#0a0a0a; font-weight:600; }

      /* PHOTO STRIP */
      #wp-pm2-strip {
        display:flex; gap:6px; padding:14px 18px;
        overflow-x:auto; scrollbar-width:none;
      }
      #wp-pm2-strip::-webkit-scrollbar { display:none; }
      #wp-pm2-strip img {
        width:150px; height:210px; object-fit:cover;
        border-radius:14px; flex-shrink:0; cursor:pointer;
      }
      #wp-pm2-strip:empty { display:none; }

      /* DESCRIPTION */
      #wp-pm2-desc-wrap { padding:14px 16px; }
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
      /* ADDRESS — misma fuente/estilo que el trigger de horarios */
      #wp-pm2-address-row {
        display:flex; align-items:center; gap:8px;
        padding:14px 16px; font-size:14px; color:#374151;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
      }
      #wp-pm2-address-row svg { flex-shrink:0; color:#6b7280; }
      #wp-pm2-address {
        font-weight:500; white-space:nowrap; overflow:hidden;
        text-overflow:ellipsis; min-width:0;
      }

      #wp-pm2-map-preview {
        margin:0 16px 12px; border-radius:16px; overflow:hidden;
        border:1px solid #e5e7eb; cursor:pointer; position:relative;
      }
      #wp-pm2-map-canvas {
        height:190px; width:100%; position:relative; background:#e8e8e8;
      }
      #wp-pm2-map-canvas .maplibregl-marker { cursor:pointer; }

      /* SECTION TITLE */
      .wp-pm2-section-title {
        font-size:15px; font-weight:800; color:#0a0a0a; padding:16px 16px 8px;
        letter-spacing:-0.2px;
      }
      /* Header con tabs de reseñas — calcado de PlaceModal1 */
      .wpr-header-row {
        display:flex; align-items:center; gap:10px;
        padding:16px 16px 10px;
      }
      .wpr-header-row .wp-pm2-reviews-title-text {
        font-family:'Instrument Serif', serif; font-size:20px; font-weight:600;
        color:#0a0a0a; flex-shrink:0; line-height:1;
      }
      /* Título de sección reutilizable (Fotos, Ubicación, etc.) — mismo
         padding y fuente que el título "Reseñas" */
      .wp-pm2-section-heading {
        font-family:'Instrument Serif', serif; font-size:20px; font-weight:600;
        color:#0a0a0a; line-height:1; padding:16px 16px 10px;
      }
      .wpr-header-tabs-row {
        display:flex; gap:5px; align-items:center; flex:1;
      }
      .wpr-tab {
        display:inline-flex; align-items:center; justify-content:center; gap:4px;
        padding:5px 10px; border-radius:999px; border:1px solid rgba(0,0,0,0.10);
        background:#f4f4f6; font-size:11px; font-weight:600;
        color:#6b7280; cursor:pointer; font-family:inherit;
        -webkit-tap-highlight-color:transparent;
        transition:all 0.15s ease; white-space:nowrap;
      }
      .wpr-tab-active { background:#0a0a0a; color:#fff; border-color:#0a0a0a; }
      .wpr-tab-count {
        font-size:10px; font-weight:700; padding:1px 6px; border-radius:999px;
        background:rgba(0,0,0,0.08); color:#6b7280;
      }
      .wpr-tab-active .wpr-tab-count { background:rgba(255,255,255,0.2); color:#fff; }
      /* Añadir reseña — naranja motivador, empujado a la derecha */
      .wpr-tab-add {
        margin-left:auto;
        background:linear-gradient(135deg,#f59e0b,#f97316);
        border-color:transparent; color:#fff !important;
        box-shadow:0 2px 8px rgba(249,115,22,0.30);
      }
      .wpr-tab-add:active { transform:scale(0.95); filter:brightness(0.92); }
      .wpr-empty {
        text-align:center; color:#9ca3af; font-size:13px; padding:24px 20px;
      }
      .wpr-see-more {
        display:block; text-align:center;
        font-size:12px; font-weight:600; color:#4285F4;
        padding:12px 0 4px; text-decoration:none;
        -webkit-tap-highlight-color:transparent;
      }
      .wpr-see-more:active { opacity:0.7; }


      /* MENTIONS */
      #wp-pm2-mentions { padding-bottom:16px; }
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
      .wp-pm2-review-row {
        display:flex; gap:10px; padding:10px 16px;
      }
      .wp-pm2-review-avatar {
        width:34px; height:34px; border-radius:50%; flex-shrink:0;
        background:#e5e7eb; object-fit:cover;
      }
      .wp-pm2-review-body { flex:1; }
      .wp-pm2-review-name { font-size:13px; font-weight:700; color:#0a0a0a; }
      .wp-pm2-review-stars { font-size:11px; color:#f59e0b; margin-top:1px; }
      .wp-pm2-review-text {
        font-size:13px; color:#374151; margin-top:4px; line-height:1.5;
        display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:6;
        overflow:hidden; font-family:'Inter Tight',sans-serif;
      }
      .wp-pm2-review-text.wp-pm2-expanded {
        -webkit-line-clamp:unset; overflow:visible;
      }
      .wp-pm2-review-more {
        display:none; margin-top:4px; font-size:12px; font-weight:700;
        color:#2563eb; background:none; border:none; padding:0;
        cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-review-time { font-size:11px; color:#9ca3af; margin-top:2px; }

      /* FOOTER */
      #wp-pm2-footer {
        position:absolute; left:0; right:0; bottom:0; z-index:6;
        display:flex; align-items:center; gap:10px;
        padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
        background:transparent;
        pointer-events:none; /* el aire entre botones deja pasar el scroll de abajo */
      }
      #wp-pm2-footer > * { pointer-events:auto; }
      #wp-pm2-here-btn {
        width:48px; height:48px; border-radius:50%; border:none;
        background:#0a0a0a; color:#fff; display:flex; align-items:center;
        justify-content:center; cursor:pointer; flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
        box-shadow:0 2px 12px rgba(255,255,255,0.5), 0 6px 16px rgba(0,0,0,0.25);
      }
      #wp-pm2-plan-btn {
        flex:1; height:48px; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff; font-size:16px; font-weight:700;
        display:flex; align-items:center; justify-content:center; gap:8px;
        cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
        box-shadow:0 2px 12px rgba(255,255,255,0.5), 0 6px 16px rgba(0,0,0,0.25);
      }
    `;
    document.head.appendChild(s);
  }

  // ── WIRE EVENTS ────────────────────────────────────────────────────
  _wireEvents() {
    const el = this._el;
    el.querySelector('#wp-pm2-back').addEventListener('click', () => this.hide());
    el.querySelector('#wp-pm2-backdrop').addEventListener('click', () => this.hide());

    this._wireTagToggle(el);

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
    el.querySelector('#wp-pm2-topbar-share').addEventListener('click', () => {
      if (navigator.share && this._place) navigator.share({ title: this._place.name, url: window.location.href });
    });
    el.querySelector('#wp-pm2-topbar-more').addEventListener('click', () => {
      console.log('[PM2] Más opciones (topbar)');
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
    el.querySelector('#wp-pm2-address-row').addEventListener('click', () => {
      const addrEl = el.querySelector('#wp-pm2-address');
      const text = addrEl.textContent;
      if (!text) return;
      const done = () => {
        const original = text;
        addrEl.textContent = '¡Dirección copiada!';
        setTimeout(() => { addrEl.textContent = original; }, 1400);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else {
        // Fallback para webviews sin Clipboard API
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
    el.querySelector('#wp-pm2-comment-box').addEventListener('click', () => {
      console.log('[PM2] Añadir comentario');
    });
    el.querySelector('#wp-pm2-add-review').addEventListener('click', () => {
      // Reutiliza el mismo flujo de "Añade un comentario..." que ya existe
      el.querySelector('#wp-pm2-comment-input-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.querySelector('#wp-pm2-comment-box').click();
    });
  }

  // Toggle del chip "Etiquetar lugar": alterna entre mostrar las etiquetas
  // YA aplicadas al lugar (modo ver, por defecto) y mostrar TODO el catálogo
  // de etiquetas disponibles para que el usuario elija/desmarque (modo
  // selección) — mismo scroll horizontal, solo cambia el contenido.
  _wireTagToggle(el) {
    const btn = el.querySelector('#wp-pm2-tag-toggle-btn');
    if (!btn) return; // pausado por ahora, sin nodo en el DOM
    btn.addEventListener('click', () => {
      this._tagSelectMode = !this._tagSelectMode;
      if (!this._tagSelectMode && this._place) {
        this._loadTags(this._place); // refresca con lo que quedó realmente aplicado
      } else {
        this._renderTagScroll();
      }
    });
  }

  // ── SHOW ──────────────────────────────────────────────────────────
  // ── MINI SNAP — panel fijo intermedio entre el minicard de MapView y la
  // ficha completa (porteado de PlaceModal1: showMini/_showMiniSnap). Flujo
  // completo en mapview normal: tap pin → minicard (MapView) → tap minicard
  // → showMini() acá → tap minisnap → show() completo.
  showMini(place) {
    this._place = place;
    // El minicard de MapView se queda abierto (no se cierra) — el minisnap
    // aparece encima de él, no lo reemplaza
    try {
      this._showMiniSnap(place);
    } catch (e) {
      console.error('[PM2] Error al abrir el minisnap:', e);
    }
  }

  _showMiniSnap(place) {
    const self = this;
    this._miniSnapPlace = place; // propio, independiente de this._place (que hide() limpia)
    let ms = document.getElementById('wp-minisnap-panel');
    const isAlreadyVisible = ms && ms.style.opacity === '1';
    if (!ms) {
      ms = document.createElement('div');
      ms.id = 'wp-minisnap-panel';
      document.body.appendChild(ms);
    }

    const name   = place.name || place.displayName || '';
    const rating = parseFloat(place.rating) || 0;
    const count  = place.userRatingCount || place.user_ratings_total || 0;
    const isOpen = self._isOpenNow(place);
    const statusTxt   = isOpen === true ? 'Abierto' : isOpen === false ? 'Cerrado' : 'Sin horario';

    const photosAll = place.photosUrls || place.photos_urls || (place.photoUrl || place.photo_url ? [place.photoUrl || place.photo_url] : []);
    const photos4 = photosAll.slice(0, 4);
    const remaining = photosAll.length - 3;

    const panelEl = document.querySelector('.map-results-panel-float');
    const panelHeight = panelEl ? panelEl.offsetHeight : 156;

    ms.style.cssText = [
      'position:fixed',
      'bottom:calc(84px + env(safe-area-inset-bottom,0px))',
      'left:12px', 'right:12px',
      'height:' + panelHeight + 'px',
      'border-radius:32px',
      'background:rgba(255,255,255,0.82)',
      'backdrop-filter:blur(24px) saturate(1.6)',
      '-webkit-backdrop-filter:blur(24px) saturate(1.6)',
      'box-shadow:0 12px 48px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,0.9)',
      'border:1px solid rgba(255,255,255,0.6)',
      'overflow:hidden', 'z-index:2000', 'opacity:0',
      'transition:opacity 0.22s ease',
      "font-family:'Inter Tight',sans-serif",
      'cursor:pointer', 'box-sizing:border-box',
      'padding:8px 14px 8px', 'display:flex', 'flex-direction:column', 'gap:6px',
    ].join(';');

    const avatarCount = Math.min(count || 4, 5);
    const avatarsHtml = Array.from({ length: avatarCount }, (_, i) =>
      `<img src="${getAvatarUrl('guest_' + i)}" style="width:24px;height:24px;border-radius:50%;border:2px solid #fff;margin-left:${i > 0 ? '-7px' : '0'};object-fit:cover;position:relative;z-index:${avatarCount - i};background:#e2e8f0">`
    ).join('');

    const glassBtn = 'height:28px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,0.10);background:rgba(255,255,255,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.9);color:#0a0a0a;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent';
    const dotStyle = isOpen === true
      ? 'display:inline-block;width:5px;height:5px;border-radius:50%;flex-shrink:0;background:#34c759;box-shadow:0 0 4px rgba(52,199,89,0.6);animation:wp-pm2-dot-pulse 1.8s ease-in-out infinite'
      : isOpen === false
      ? 'display:inline-block;width:5px;height:5px;border-radius:50%;flex-shrink:0;background:#ff3b30;box-shadow:0 0 3px rgba(255,59,48,0.5)'
      : '';
    const badgeDot = isOpen !== null ? `<span style="${dotStyle}"></span>` : '';
    const glassBadge = isOpen === true
      ? 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:linear-gradient(135deg,rgba(52,199,89,0.18),rgba(52,199,89,0.10));color:#15803d;border:1px solid rgba(52,199,89,0.25)'
      : isOpen === false
      ? 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:linear-gradient(135deg,rgba(255,59,48,0.14),rgba(255,59,48,0.08));color:#c0392b;border:1px solid rgba(255,59,48,0.20)'
      : 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:rgba(118,118,128,0.12);color:#8e8e93;border:1px solid rgba(118,118,128,0.18)';

    const photoCardHtml = (url, isLast) => `
      <div style="width:68px;height:68px;flex-shrink:0;border-radius:22px;overflow:hidden;position:relative;">
        <img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.25s" onload="this.style.opacity=1">
        ${isLast && remaining > 1 ? `<div style="position:absolute;inset:0;border-radius:22px;background:rgba(0,0,0,0.48);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">+${remaining - 1}</div>` : ''}
      </div>`;

    ms.innerHTML = `
      <div id="wp-ms-handle" style="position:absolute;top:0;left:0;right:0;height:20px;display:flex;align-items:center;justify-content:center;cursor:grab;z-index:2">
        <div style="width:36px;height:4px;border-radius:2px;background:#1a5cf5;opacity:0.75;pointer-events:none"></div>
      </div>
      <div style="position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:2px;min-height:32px">
        <span style="position:absolute;left:0;${glassBadge}">${badgeDot}${statusTxt}</span>
        <span style="font-size:15px;font-weight:800;color:#0a0a0a;text-align:center;padding:0 88px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;box-sizing:border-box">${name}</span>
        <div style="position:absolute;right:0;display:flex;align-items:center;gap:6px">
          <button id="wp-ms-fav-btn" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.92);box-shadow:0 4px 14px rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;">
            <svg viewBox="0 0 512 512" width="14" height="14"><path d="M256,448a32,32,0,0,1-18-5.57c-78.59-53.35-112.62-89.93-131.39-112.8-40-48.75-59.15-98.8-58.61-153C48.63,114.52,98.46,64,159.08,64c44.08,0,74.61,24.83,92.39,45.51a6,6,0,0,0,9.06,0C278.31,88.81,308.84,64,352.92,64,413.54,64,463.37,114.52,464,176.64c.54,54.21-18.63,104.26-58.61,153-18.77,22.87-52.8,59.45-131.39,112.8A32,32,0,0,1,256,448Z" fill="none" stroke="#6b7280" stroke-width="40"/></svg>
          </button>
          <button id="wp-ms-close-btn" style="width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,0.92);box-shadow:0 4px 14px rgba(0,0,0,0.10);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div style="display:flex;gap:8px;height:68px;flex-shrink:0;justify-content:center;align-items:center">
        ${photos4.length
          ? photos4.map((u, i) => photoCardHtml(u, i === photos4.length - 1)).join('')
          : `<div style="width:68px;height:68px;border-radius:22px;background:#f4f4f6;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span style="font-size:20px">📷</span></div>`}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:7px">
          <div style="display:flex;align-items:center">${avatarsHtml}</div>
          ${count > 0 ? `<span style="font-size:11px;font-weight:600;color:#6b7280">${count} reseñas</span>` : `<span style="font-size:11px;color:#9ca3af">Sin reseñas</span>`}
        </div>
        <button id="wp-ms-cta-btn" style="${glassBtn}">+ Detalles</button>
      </div>`;

    ms.className = 'wp-minisnap-panel';
    document.dispatchEvent(new CustomEvent('wp:minisnap:show'));

    if (!isAlreadyVisible) {
      ms.style.transition = 'none';
      ms.style.opacity = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ms.style.transition = 'opacity 0.22s ease';
        ms.style.opacity = '1';
      }));
    } else {
      ms.style.transition = 'none';
      ms.style.opacity = '1';
    }

    const favBtn = ms.querySelector('#wp-ms-fav-btn');
    if (favBtn) favBtn.onclick = (e) => {
      e.stopPropagation();
      favBtn.classList.toggle('active');
      const svg = favBtn.querySelector('path');
      const active = favBtn.classList.contains('active');
      svg.setAttribute('fill', active ? '#ef4444' : 'none');
      svg.setAttribute('stroke', active ? '#ef4444' : '#6b7280');
    };

    const closeBtn = ms.querySelector('#wp-ms-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); self._hideMiniSnap(); });

    const goFull = () => { self._fromMiniSnap = true; self.show(self._miniSnapPlace); };
    const handle = ms.querySelector('#wp-ms-handle');
    if (handle) {
      let hY = 0;
      handle.addEventListener('touchstart', (e) => { hY = e.touches[0].clientY; e.stopPropagation(); }, { passive: true });
      handle.addEventListener('touchend', (e) => { e.stopPropagation(); if (hY - e.changedTouches[0].clientY > 25) goFull(); }, { passive: true });
      handle.addEventListener('click', (e) => { e.stopPropagation(); goFull(); });
    }
    const cta = ms.querySelector('#wp-ms-cta-btn');
    if (cta) cta.onclick = goFull;
    ms.addEventListener('click', (e) => {
      if (!e.target.closest('#wp-ms-cta-btn') && !e.target.closest('#wp-ms-fav-btn') && !e.target.closest('#wp-ms-close-btn') && !e.target.closest('#wp-ms-handle')) goFull();
    });
  }

  _hideMiniSnap() {
    const ms = document.getElementById('wp-minisnap-panel');
    if (!ms) return;
    ms.style.pointerEvents = 'none';
    ms.style.transition = 'opacity 0.2s ease';
    ms.style.opacity = '0';
    this._miniSnapPlace = null;
    document.dispatchEvent(new CustomEvent('wp:minisnap:hide'));
    setTimeout(() => { if (ms.parentNode) ms.parentNode.removeChild(ms); }, 220);
  }

  show(place) {
    this._fromSearch = false;
    this._place = place;
    this._populate(place);
    this._el.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Ocultar el footer menu del mapview mientras la ficha está abierta
    // (tiene z-index:9995, más alto que el modal, así que quedaba encima)
    const footerMenu = document.getElementById('wp-footer-menu');
    if (footerMenu) footerMenu.style.display = 'none';

    const body        = this._el.querySelector('#wp-pm2-body');
    const spacer      = this._el.querySelector('#wp-pm2-scroll-spacer');
    const heroEl      = this._el.querySelector('#wp-pm2-hero');
    const heroInner   = this._el.querySelector('#wp-pm2-hero-inner');
    const heroOverlayFast = this._el.querySelector('#wp-pm2-hero-overlay-fast');
    const heroGradient = this._el.querySelector('#wp-pm2-hero-gradient');
    const topbar      = this._el.querySelector('#wp-pm2-topbar');
    const topbarFade  = this._el.querySelector('#wp-pm2-topbar-fade');
    this._activityStack = this._el.querySelector('#wp-pm2-activity-stack');
    if (this._activityStack) { this._activityStack.style.transform = ''; this._activityStack.style.opacity = '1'; }
    const nameEl      = this._el.querySelector('#wp-pm2-hero-bottom');
    const topbarTitle = this._el.querySelector('#wp-pm2-topbar-title');
    const topbarActions = this._el.querySelector('#wp-pm2-topbar-actions');

    // Reset
    heroEl.style.height = '';
    heroEl.style.minHeight = '';   // usar el min-height del CSS SOLO para medir fullH
    heroInner.style.height = '';
    heroInner.style.transform = '';
    heroInner.style.opacity = '';
    heroOverlayFast.style.transform = '';
    heroGradient.style.opacity = '';
    spacer.style.height = '0px';
    nameEl.style.opacity = '';
    topbar.classList.remove('scrolled');
    topbar.style.boxShadow = '';
    topbarFade.style.opacity = '0.4';
    if (topbarTitle) topbarTitle.style.opacity = '0';
    if (topbarActions) { topbarActions.style.opacity = '0'; topbarActions.style.pointerEvents = 'none'; }
    body.scrollTop = 0;

    // hero (overlay absoluto encima del body) + hero-inner (alto FIJO fullH,
    // translateY) — imagen+overlay suben juntos, sin huecos. El spacer al
    // inicio del body mide `travel` (chico, no fullH) para que el hero lo
    // termine de tapar justo cuando colapsa del todo.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const topbarH = topbar.offsetHeight;
      const fullH   = heroEl.offsetHeight;   // con min-height:260px del CSS todavía activo
      if (!fullH) return;
      const travel = fullH - topbarH;
      heroInner.style.height = fullH + 'px';
      heroOverlayFast.style.height = fullH + 'px';
      spacer.style.height = (travel + topbarH * 1.5) + 'px';
      heroEl.style.minHeight = '0px';

      const onScroll = () => {
        const sy    = body.scrollTop;
        const prog  = Math.min(1, Math.max(0, sy / travel));
        const shift = Math.min(sy, travel);
        // El hero colapsa hasta 0 (antes tenía un mínimo de topbarH, y esa
        // franja remanente dejaba visible la parte blanca del gradiente
        // ESTACIONADA detrás del topbar transparente — ese era el "fondo"
        // que aparecía con el scroll, no el fade ni el topbar en sí)
        const newH  = Math.max(0, fullH - sy);

        // Parallax muy lento SOLO para la foto (estilo iOS26): la imagen
        // avanza mucho más despacio que el scroll real — factor 0.22
        const HERO_PARALLAX = 0.22;
        const innerShift = shift * HERO_PARALLAX;

        heroEl.style.height = newH + 'px';
        heroInner.style.transform = `translateY(-${innerShift}px)`; // SOLO la foto, lenta
        heroInner.style.opacity   = Math.max(0, 1 - prog);          // la foto se desvanece

        // Overlay (sombra/gradiente) + título/rating: viajan a la MISMA
        // velocidad que el contenido real (shift, 1:1 con el scroll) — no
        // con el parallax lento de la foto. Así llegan junto con el resto
        // del contenido hasta arriba y se disuelven en la sombra del topbar
        heroOverlayFast.style.transform = `translateY(-${shift}px)`;
        // El overlay (gradiente blanco) NO se desvanece por opacity — así
        // siempre hace de "puente" blanco entre la foto y el contenido de
        // abajo. Se pierde de vista solo por posición (viaja rápido, junto
        // con el contenido) cuando el hero termina de colapsar. Si se
        // lo hace desaparecer por opacity antes de tiempo, queda un borde
        // duro visible justo donde el hero recorta (overflow:hidden).

        // Título/rating del hero: fade-out rápido al iniciar el scroll
        nameEl.style.opacity = Math.max(0, 1 - prog * 2.2);

        // Activity stack: NO desaparece — encoge y se desliza apenas hacia
        // el borde, quedando "asomada" (nunca menos de 0.4 de escala ni
        // menos de 0.6 de opacidad). Se restaura solo al volver arriba.
        if (this._activityStack) {
          const scale = 1 - prog * 0.6;   // hasta ~0.4
          const tx    = prog * 46;        // se acerca al borde, no se va del todo
          this._activityStack.style.transform = `translateX(${tx}px) scale(${scale})`;
          this._activityStack.style.opacity = Math.max(0.6, 1 - prog * 0.5);
        }

        // Sombra del status bar: a medida que el contenido llega arriba
        // (scroll avanza), se pone cada vez menos transparente — el
        // contenido detrás queda cada vez más tapado/blanco.
        topbarFade.style.opacity = Math.min(1, 0.4 + prog * 2.2);

        // Título centrado del topbar aparece cuando el hero ya casi terminó
        // El título solo vive en el hero (nameEl) — ya no se duplica en
        // el topbar en ningún punto del scroll.
        if (topbarActions) {
          const actOpacity = Math.max(0, Math.min(1, (prog - 0.5) / 0.4));
          topbarActions.style.opacity = actOpacity;
          topbarActions.style.pointerEvents = actOpacity > 0.5 ? 'auto' : 'none';
        }

        if (prog >= 1) topbar.classList.add('scrolled');
        else            topbar.classList.remove('scrolled');
      };

      if (this._scrollHandler) body.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = onScroll;
      body.addEventListener('scroll', onScroll, { passive: true });
    }));
  }

  hide() {
    this._el.classList.remove('visible');
    document.body.style.overflow = '';
    this._place = null;
    if (this._aiAbort) this._aiAbort();
    // Restaurar el footer menu del mapview
    const footerMenu = document.getElementById('wp-footer-menu');
    if (footerMenu) footerMenu.style.display = '';
    const body = this._el.querySelector('#wp-pm2-body');
    if (this._scrollHandler) body.removeEventListener('scroll', this._scrollHandler);
    this._scrollHandler = null;
    // Reset topbar
    this._el.querySelector('#wp-pm2-topbar')?.classList.remove('scrolled');
  }

  // ── POPULATE ──────────────────────────────────────────────────────
  _populate(place) {
    const $ = id => this._el.querySelector('#' + id);

    // Etiquetar lugar — cada ficha nueva arranca en modo "ver etiquetas"
    // (no en modo selección)
    this._tagSelectMode = false;
    const toggleBtn = $('wp-pm2-tag-toggle-btn');
    if (toggleBtn) toggleBtn.classList.remove('wp-pm2-active');

    // Name
    $('wp-pm2-name').textContent = place.name || '';

    // Category (el ícono ya no se muestra en texto — se usa más abajo como pin del mapa)
    const catIcon = place.subcategory_icon || place.category_icon || '';
    const catName = place.subcategory_label || place.category_label || place.category || '';
    $('wp-pm2-cat').textContent = catName;

    // Featured badge — "✦ Destacado" / "✓ Verificado" / "✦ Premium", igual
    // que PlaceModal1 (place.featured: 'featured' | 'verified' | 'premium')
    const featuredEl = $('wp-pm2-featured-badge');
    if (place.featured) {
      const labels = { premium:'✦ Premium', featured:'✦ Destacado', verified:'✓ Verificado' };
      featuredEl.textContent = labels[place.featured] || place.featured;
      featuredEl.className   = `wp-pm2-featured-badge wp-pm2-badge-${place.featured}`;
      featuredEl.style.display = '';
    } else {
      featuredEl.style.display = 'none';
    }

    // Rating (+ total real de reseñas de Google entre paréntesis, igual que PlaceModal1)
    const rating = parseFloat(place.rating);
    const ratingCount = place.userRatingCount || place.user_ratings_total || 0;
    $('wp-pm2-rating-hero').textContent = rating
      ? '⭐ ' + rating.toFixed(1) + (ratingCount ? ` (${ratingCount})` : '')
      : '';

    // Photos array (used for hero bg + strip)
    const firstPhoto = place.photoUrl || place.photo_url || place.photosUrls?.[0] || null;
    const rawPhotos = place.photosUrls || (firstPhoto ? [firstPhoto] : []);
    const photos = rawPhotos.slice(0, 6).map(u => this.proxyPhoto(u)).filter(Boolean);

    // Photo strip
    const stripEl = $('wp-pm2-strip');
    stripEl.innerHTML = '';
    photos.forEach(url => {
      const img = document.createElement('img');
      img.alt = ''; img.loading = 'lazy';
      this._skelOn(img);
      img.onload  = () => this._skelOff(img);
      img.onerror = () => this._skelOff(img);
      img.src = url;
      stripEl.appendChild(img);
    });

    // Hero background — primera foto con parallax, con skeleton mientras carga
    const heroBg = $('wp-pm2-hero-bg');
    if (heroBg) {
      heroBg.style.backgroundImage = '';
      if (photos.length) {
        this._skelOn(heroBg);
        const preload = new Image();
        preload.onload  = () => { heroBg.style.backgroundImage = `url('${photos[0]}')`; this._skelOff(heroBg); };
        preload.onerror = () => { this._skelOff(heroBg); };
        preload.src = photos[0];
      } else {
        this._skelOff(heroBg);
      }
    }

    // Topbar title
    const ttEl = $('wp-pm2-topbar-title');
    if (ttEl) ttEl.textContent = place.name || '';

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

    // Hours — colapsable, igual que PlaceModal1
    const hoursRaw = place.openingHoursText || place.opening_hours || place.hours;
    const hoursBlock = $('wp-pm2-hours');
    if (hoursRaw && typeof hoursRaw === 'object') {
      hoursBlock.style.display = '';
      const DAY_ORDER  = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const DAY_LABELS = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' };
      const todayKey = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];

      $('wp-pm2-hours-text').textContent = `Hoy: ${hoursRaw[todayKey] || 'Sin horario'}`;

      const isOpen = this._isOpenNow(place);
      const statusEl = $('wp-pm2-hours-status');
      if (isOpen === true)       { statusEl.textContent = 'Abierto'; statusEl.className = 'wp-pm2-hours-status wp-pm2-open'; }
      else if (isOpen === false) { statusEl.textContent = 'Cerrado'; statusEl.className = 'wp-pm2-hours-status wp-pm2-closed'; }
      else                       { statusEl.textContent = ''; statusEl.className = 'wp-pm2-hours-status'; }

      const list = $('wp-pm2-hours-list');
      list.innerHTML = DAY_ORDER.map(d =>
        `<div class="wp-pm2-hours-row${d === todayKey ? ' wp-pm2-hours-today' : ''}">
          <span class="wp-pm2-hours-day">${DAY_LABELS[d]}</span>
          <span class="wp-pm2-hours-time">${hoursRaw[d] || 'Cerrado'}</span>
        </div>`
      ).join('');
      list.classList.remove('expanded');

      const trigger = $('wp-pm2-hours-trigger');
      const chevron = $('wp-pm2-chevron');
      let expanded = false;
      trigger.onclick = () => {
        expanded = !expanded;
        list.classList.toggle('expanded', expanded);
        chevron.style.transform = expanded ? 'rotate(180deg)' : '';
      };
    } else if (typeof hoursRaw === 'string' && hoursRaw) {
      hoursBlock.style.display = '';
      $('wp-pm2-hours-text').textContent = hoursRaw;
      $('wp-pm2-hours-status').textContent = '';
      $('wp-pm2-hours-list').innerHTML = '';
      $('wp-pm2-hours-trigger').onclick = null;
    } else {
      hoursBlock.style.display = 'none';
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

    // Address — el campo real es formattedAddress (camelCase), no
    // "address" ni "formatted_address" (por eso nunca se mostraba)
    const addr = place.formattedAddress || place.formatted_address || place.address || '';
    const addrRow = $('wp-pm2-address-row');
    if (addr) { $('wp-pm2-address').textContent = addr; addrRow.style.display = ''; }
    else addrRow.style.display = 'none';

    // Map — MISMO MapLibre que usa MapView.js (ya está cargado global en la
    // app, sin API de Google, sin archivos nuevos). Instancia liviana y
    // no-interactiva (solo preview), con el pin "mini-modal" del lugar.
    const lat = place.location?.lat || place.lat;
    const lng = place.location?.lng || place.lng;
    this._renderMiniMap(place, lat, lng, catIcon);

    // Tags — vienen de Supabase (tabla place_tags), pedidas async
    this._loadTags(place);

    // Activity stack — mini-fichas en abanico (fixed, esquina superior derecha)
    this._loadPlaceActivities(place);

    // User avatar — misma resolución que PlaceModal1: foto real del perfil,
    // o si no tiene, memoji de Tapback generado con su nombre (nunca vacío)
    const user = this.getCurrentUser?.();
    const avatarEl = $('wp-pm2-user-avatar');
    if (user) {
      const displayName = user.user_metadata?.display_name
        || user.user_metadata?.full_name
        || user.email?.split('@')[0]
        || 'Usuario';
      this._skelOn(avatarEl);
      avatarEl.onload  = () => this._skelOff(avatarEl);
      avatarEl.onerror = () => this._skelOff(avatarEl);
      avatarEl.src = user.user_metadata?.avatar_url || getAvatarUrl(displayName);
    } else {
      this._skelOff(avatarEl);
      avatarEl.src = '';
    }

    // Reviews (async)
    this._loadReviews(place);

    // Descripción generada con IA (misma función que PlaceModal1)
    this._populateAI(place);
  }

  // Descripción generada con IA — misma lógica que PlaceModal1._populateAI:
  // 1) si el place ya trae `ai_descriptions` (guardadas en Supabase), muestra
  //    una al azar de inmediato; 2) si no, pide una nueva a
  //    /api/groq-description (que arma el prompt en base a place.reviews)
  _populateAI(place) {
    const block    = this._el.querySelector('#wp-pm2-ai-block');
    const textEl   = this._el.querySelector('#wp-pm2-ai-text');
    const skelEl   = this._el.querySelector('#wp-pm2-ai-skeleton');
    const icon     = this._el.querySelector('.wp-pm2-ai-icon');
    if (!block || !textEl) return;

    if (this._aiAbort) this._aiAbort();
    this._aiAbort = null;

    const placeId = place.place_id || place.id;
    if (!placeId) { block.style.display = 'none'; return; }

    // Skeleton de 6 renglones visible DESDE EL ARRANQUE — el texto real
    // aparece arriba recién cuando termina de cargar/generarse
    block.style.display = '';
    textEl.textContent  = '';
    textEl.style.display = 'none';
    skelEl.style.display = '';

    const showText = (desc, animate) => {
      skelEl.style.display = 'none';
      textEl.style.display = '';
      if (animate) {
        if (icon) icon.classList.add('wp-pm2-ai-pulse');
        return this._typewrite(textEl, desc, null, () => {
          if (icon) icon.classList.remove('wp-pm2-ai-pulse');
        });
      }
      this._typewrite(textEl, desc);
      return null;
    };

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];
    if (existing.length > 0) {
      const desc = existing[Math.floor(Math.random() * existing.length)];
      showText(desc, false);
      return;
    }

    let aborted = false;
    let cancelTypewrite = null;
    this._aiAbort = () => {
      aborted = true;
      if (cancelTypewrite) cancelTypewrite();
      block.style.display = 'none';
      textEl.textContent  = '';
      if (icon) icon.classList.remove('wp-pm2-ai-pulse');
    };

    fetch(`/api/groq-description?place_id=${encodeURIComponent(placeId)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (aborted) return;
        if (!ok || !data || !data.description) { block.style.display = 'none'; return; }
        cancelTypewrite = showText(data.description, true);
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
      } else if (onDone) onDone();
    };
    if (onStart) onStart();
    timer = setTimeout(step, 16);
    return function cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }

  // Google Reviews — vienen embebidas en el propio `place.reviews` (columna
  // JSONB de Supabase, cargada por /api/supabase-places al listar lugares),
  // así que no hace falta ningún fetch acá: son las mismas reseñas de
  // Google que Google Place Details trajo al guardar el lugar.
  // Calcula si el lugar está abierto ahora mismo en base a regularOpeningHours
  // (mismo cálculo que PlaceModal1._isOpenNow)
  // Skeleton a prueba de conflictos de especificidad: se setea inline con
  // !important (máxima prioridad posible), no depende de la cascada de CSS
  // Skeleton sin !important: cada imagen tiene su propia clase .wp-pm2-skel
  // con selector de la MISMA especificidad que su regla base (ver CSS), así
  // que gana por cascada normal, no por fuerza bruta. El hero (que es un
  // <div> con background-image seteado por JS) usa un ::before aparte para
  // no pisar nunca la foto real.
  _skelOn(el) {
    if (!el) return;
    el.classList.add('wp-pm2-skel');
  }
  _skelOff(el) {
    if (!el) return;
    el.classList.remove('wp-pm2-skel');
  }

  // Etiquetas del lugar — Supabase (tabla place_tags), agrupadas y
  // ordenadas por votos en PlaceTagService.getTagsForPlace()
  async _loadTags(place) {
    try {
      this._appliedTags = await PlaceTagService.getTagsForPlace(place);
    } catch (e) {
      this._appliedTags = [];
    }
    this._renderTagScroll();
  }

  // Pinta el scroll horizontal de etiquetas — modo ver (las ya aplicadas,
  // de solo lectura) o modo selección (todo el catálogo, tocable para
  // activar/desactivar cada una)
  _renderTagScroll() {
    const scroll = this._el.querySelector('#wp-pm2-tag-scroll');
    const btn = this._el.querySelector('#wp-pm2-tag-toggle-btn');
    if (!scroll || !btn) return;
    scroll.innerHTML = '';

    if (this._tagSelectMode) {
      btn.textContent = 'Listo';
      btn.classList.add('wp-pm2-active');
      const appliedKeys = new Set((this._appliedTags || []).map(t => t.key));

      PLACE_TAGS.forEach(tag => {
        const b = document.createElement('button');
        b.className = 'wp-pm2-tag-chip' + (appliedKeys.has(tag.key) ? ' wp-pm2-tag-selected' : '');
        b.textContent = `${tag.emoji} ${tag.label}`;
        b.addEventListener('click', async () => {
          const user = this.getCurrentUser?.();
          if (!user) { console.log('[PM2] Hay que iniciar sesión para etiquetar'); return; }
          b.disabled = true;
          try {
            const res = await PlaceTagService.toggleTag(this._place, tag.key, user.id);
            const nowActive = res.action === 'added';
            b.classList.toggle('wp-pm2-tag-selected', nowActive);
            if (nowActive) appliedKeys.add(tag.key); else appliedKeys.delete(tag.key);
          } catch (e) {
            console.log('[PM2] Error al etiquetar:', e.message);
          } finally {
            b.disabled = false;
          }
        });
        scroll.appendChild(b);
      });
    } else {
      btn.textContent = 'Etiquetar lugar';
      btn.classList.remove('wp-pm2-active');
      (this._appliedTags || []).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'wp-pm2-tag-chip';
        span.textContent = `${tag.emoji} ${tag.label}`;
        scroll.appendChild(span);
      });
    }
  }

  // Mapa mini — mismo MapLibre que usa MapView.js (window.maplibregl, ya
  // cargado global en index.html, mismo MAP_STYLE). Se crea UNA sola vez
  // y se reutiliza entre lugares (solo se mueve center + marker).
  // Mini-fichas de actividades en este lugar, en abanico. Por ahora con
  // datos de muestra (place.activities si existiera, si no un mock) — falta
  // definir de dónde vienen los datos reales (ActivityService no tiene
  // todavía un getForPlace(placeId), solo getActiveActivities() general).
  // Trae TODAS las actividades activas de la app (ActivityService no tiene
  // un getForPlace propio) y filtra client-side por el place_id de esta
  // ficha. Si falla o no hay match, cae al estado vacío (invitar a crear).
  async _loadPlaceActivities(place) {
    const placeId = place.place_id || place.id;
    let matched = [];
    try {
      const all = await ActivityService.getActiveActivities();
      matched = (all || []).filter(a => a.place_id && placeId && a.place_id === placeId);
    } catch (e) {
      matched = [];
    }
    this._renderActivityStack(place, matched);
  }

  _renderActivityStack(place, activitiesRaw) {
    const stack = this._el.querySelector('#wp-pm2-activity-stack');
    if (!stack) return;
    stack.innerHTML = '';

    const activities = (Array.isArray(activitiesRaw) ? activitiesRaw : []).slice(0, 3);
    const GRADIENTS = [
      'linear-gradient(145deg,#f472b6,#fb7185)', // coral/rosa
      'linear-gradient(145deg,#fbbf24,#f59e0b)', // amarillo
      'linear-gradient(145deg,#818cf8,#6366f1)', // azul/violeta
    ];
    const ROT = ['-14deg', '5deg', '16deg'];
    const OFFSET = [
      { tx: '6px',  ty: '2px' },
      { tx: '-2px', ty: '-4px' },
      { tx: '-8px', ty: '4px' },
    ];

    if (!activities.length) {
      // Sin actividades — invita a crear una
      const card = document.createElement('div');
      card.className = 'wp-pm2-activity-card wp-pm2-activity-empty';
      card.style.setProperty('--rot', '-8deg');
      card.style.setProperty('--delay', '0.05s');
      card.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="align-self:center;margin-top:8px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Crear actividad<br>en este lugar</span>
      `;
      card.addEventListener('click', () => console.log('[PM2] Crear actividad en:', place.name));
      stack.appendChild(card);
      return;
    }

    activities.forEach((act, i) => {
      const d = act.scheduled_at ? new Date(act.scheduled_at) : null;
      const day   = d ? d.getDate() : '--';
      const month = d ? d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase() : '';
      const creatorName = act.profiles?.name || 'Alguien';
      const participantCount = Array.isArray(act.participants) ? act.participants.length : 0;

      const card = document.createElement('div');
      card.className = 'wp-pm2-activity-card';
      card.style.background = GRADIENTS[i % GRADIENTS.length];
      card.style.setProperty('--rot', ROT[i % ROT.length]);
      card.style.setProperty('--tx', OFFSET[i % OFFSET.length].tx);
      card.style.setProperty('--ty', OFFSET[i % OFFSET.length].ty);
      card.style.setProperty('--delay', (i * 0.08) + 's');
      card.style.zIndex = activities.length - i;

      card.innerHTML = `
        <div class="wp-pm2-activity-date"><span class="d">${day}</span><span class="m">${month}</span></div>
        <div class="wp-pm2-activity-title">${act.title || act.type || 'Actividad'}</div>
        <div class="wp-pm2-activity-people">
          <img class="wp-pm2-activity-avatar">
          <span>${participantCount ? '+' + participantCount : ''}</span>
        </div>
      `;
      const avImg = card.querySelector('.wp-pm2-activity-avatar');
      this._skelOn(avImg);
      avImg.onload = avImg.onerror = () => this._skelOff(avImg);
      avImg.src = act.profiles?.avatar_url || getAvatarUrl(creatorName);

      card.addEventListener('click', () => console.log('[PM2] Ver actividad:', act));
      stack.appendChild(card);
    });
  }

  _renderMiniMap(place, lat, lng, catIcon) {
    const container = this._el.querySelector('#wp-pm2-map-canvas');
    const preview = this._el.querySelector('#wp-pm2-map-preview');
    if (!lat || !lng) { preview.style.display = 'none'; return; }
    preview.style.display = '';

    if (typeof window.maplibregl === 'undefined') {
      // MapLibre no cargó (no debería pasar, ya está en index.html) —
      // evitamos romper el resto de la ficha
      return;
    }

    const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

    if (!this._miniMap) {
      this._miniMap = new window.maplibregl.Map({
        container,
        style: MAP_STYLE,
        center: [lng, lat],
        zoom: 14,
        attributionControl: false,
        interactive: false,   // preview: sin pan/zoom/rotate, solo mostrar
        keyboard: false,
        renderWorldCopies: false,
      });
    } else {
      this._miniMap.setCenter([lng, lat]);
      this._miniMap.setZoom(14);
    }

    // Punto pulsante azul — más simple y limpio que el pin liquid-glass
    if (!document.getElementById('wp-pm2-pulse-style')) {
      const st = document.createElement('style');
      st.id = 'wp-pm2-pulse-style';
      st.textContent = `
        @keyframes wp-pm2-pulse-ring {
          0%   { transform:scale(1); opacity:0.55; }
          100% { transform:scale(2.6); opacity:0; }
        }
      `;
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.style.cssText = 'position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = `
      <div style="position:absolute;width:18px;height:18px;border-radius:50%;background:#2563eb;animation:wp-pm2-pulse-ring 1.8s ease-out infinite;"></div>
      <div style="position:relative;width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>`;

    if (this._miniMapMarker) this._miniMapMarker.remove();
    this._miniMapMarker = new window.maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(this._miniMap);

    // El contenedor puede medir 0 si el modal recién se está abriendo —
    // resize() una vez que ya tiene layout real
    requestAnimationFrame(() => requestAnimationFrame(() => this._miniMap.resize()));
  }

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

  _loadReviews(place) {
    const summaryEl = this._el.querySelector('#wp-pm2-reviews-summary');
    const avatarsEl = this._el.querySelector('#wp-pm2-reviews-avatars');
    const countEl   = this._el.querySelector('#wp-pm2-reviews-count');

    let reviews = place.reviews;
    if (typeof reviews === 'string') { try { reviews = JSON.parse(reviews); } catch(e) { reviews = []; } }
    if (!Array.isArray(reviews)) reviews = [];

    // Facepile: solo 3 avatares reales (memoji de Tapback vía getAvatarUrl,
    // misma función que usa PlaceModal1) + una bolita "+N" con el resto.
    const totalReal = place.userRatingCount || place.user_ratings_total || reviews.length;
    if (reviews.length) {
      avatarsEl.innerHTML = '';
      const shown = reviews.slice(0, 3);
      shown.forEach((r, i) => {
        const av = document.createElement('img');
        av.className = 'wp-pm2-fp-avatar';
        av.style.zIndex = shown.length - i; // el primero queda arriba, igual que PlaceModal1
        this._skelOn(av);
        av.onload  = () => this._skelOff(av);
        av.onerror = () => { this._skelOff(av); av.style.background = '#e2e8f0'; };
        av.src = getAvatarUrl(r.author_name || 'user');
        avatarsEl.appendChild(av);
      });
      const remaining = Math.max(0, totalReal - shown.length);
      if (remaining > 0) {
        const more = document.createElement('div');
        more.className = 'wp-pm2-fp-more';
        more.textContent = '+' + (remaining > 99 ? '99' : remaining);
        more.style.zIndex = 0;
        avatarsEl.appendChild(more);
      }
      countEl.textContent = `(${totalReal} reseñas)`;
      summaryEl.style.display = '';
    } else {
      summaryEl.style.display = 'none';
    }

    this._googleReviews = reviews;
    this._buildReviewsHeader(place);
    this._renderGooglePanel(place);
    this._loadCommunityReviews(place); // async, WhatsPlan
  }

  // Header con "Reseñas" + tabs (Google / WhatsPlan) + pill "Añadir reseña",
  // calcado de PlaceModal1 (_populateReviews → headerRow)
  _buildReviewsHeader(place) {
    const headerRow = this._el.querySelector('#wpr-header-row');
    if (!headerRow) return;
    const gCount = (this._googleReviews || []).length;
    const cCount = (this._communityReviews || []).length;

    headerRow.innerHTML = `
      <span class="wp-pm2-reviews-title-text">Reseñas</span>
      <div class="wpr-header-tabs-row">
        <button class="wpr-tab wpr-tab-active" data-tab="google">Google <span class="wpr-tab-count">${gCount}</span></button>
        <button class="wpr-tab" data-tab="community">WhatsPlan <span class="wpr-tab-count">${cCount}</span></button>
        <button class="wpr-tab wpr-tab-add" id="wpr-add-btn">✦ Añadir reseña</button>
      </div>
    `;

    headerRow.querySelectorAll('.wpr-tab[data-tab]').forEach(tab => {
      tab.onclick = () => {
        headerRow.querySelectorAll('.wpr-tab[data-tab]').forEach(t => t.classList.remove('wpr-tab-active'));
        tab.classList.add('wpr-tab-active');
        this._el.querySelector('#wpr-panel-google').style.display    = tab.dataset.tab === 'google'    ? '' : 'none';
        this._el.querySelector('#wpr-panel-community').style.display = tab.dataset.tab === 'community' ? '' : 'none';
      };
    });
    const addBtn = headerRow.querySelector('#wpr-add-btn');
    if (addBtn) addBtn.onclick = () => {
      this._el.querySelector('#wp-pm2-comment-input-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
      this._el.querySelector('#wp-pm2-comment-box').click();
    };
  }

  // Construye una tarjeta de reseña (misma estructura para Google y
  // WhatsPlan, solo cambian los datos de entrada)
  _buildReviewCard(name, rating, text, timeLabel, photoSeed) {
    const row = document.createElement('div');
    row.className = 'wp-pm2-review-row';
    const stars = rating ? '⭐'.repeat(Math.round(rating)) : '';
    row.innerHTML = `
      <img class="wp-pm2-review-avatar">
      <div class="wp-pm2-review-body">
        <div class="wp-pm2-review-name">${name}</div>
        ${stars ? `<div class="wp-pm2-review-stars">${stars}</div>` : ''}
        <div class="wp-pm2-review-text">${text || ''}</div>
        <button class="wp-pm2-review-more">Ver más</button>
        ${timeLabel ? `<div class="wp-pm2-review-time">${timeLabel}</div>` : ''}
      </div>`;

    const avImg = row.querySelector('.wp-pm2-review-avatar');
    this._skelOn(avImg);
    avImg.onload  = () => this._skelOff(avImg);
    avImg.onerror = () => { this._skelOff(avImg); avImg.style.background = '#e2e8f0'; };
    avImg.src = photoSeed;

    const textEl = row.querySelector('.wp-pm2-review-text');
    const moreBtn = row.querySelector('.wp-pm2-review-more');
    requestAnimationFrame(() => {
      if (textEl.scrollHeight > textEl.clientHeight + 1) {
        moreBtn.style.display = 'block';
        moreBtn.onclick = () => {
          const expanded = textEl.classList.toggle('wp-pm2-expanded');
          moreBtn.textContent = expanded ? 'Ver menos' : 'Ver más';
        };
      }
    });
    return row;
  }

  // Panel de reseñas de Google + link "Ver todas las reseñas en Google"
  // (misma URL que PlaceModal1: search.google.com/local/reviews)
  _renderGooglePanel(place) {
    const panel = this._el.querySelector('#wpr-panel-google');
    const reviews = this._googleReviews || [];
    panel.innerHTML = '';
    if (!reviews.length) {
      panel.innerHTML = '<p class="wpr-empty">Sin reseñas de Google todavía</p>';
      return;
    }
    reviews.slice(0, 5).forEach(r => {
      panel.appendChild(this._buildReviewCard(
        r.author_name || 'Usuario de Google',
        r.rating, r.text, r.relative_time,
        getAvatarUrl(r.author_name || 'user')
      ));
    });
    const placeId = place.place_id || place.id;
    if (placeId) {
      const a = document.createElement('a');
      a.className = 'wpr-see-more';
      a.href = `https://search.google.com/local/reviews?placeid=${placeId}`;
      a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Ver todas las reseñas en Google →';
      panel.appendChild(a);
    }
  }

  // Panel de reseñas de WhatsPlan (tabla place_reviews vía ReviewService)
  async _loadCommunityReviews(place) {
    const panel = this._el.querySelector('#wpr-panel-community');
    try {
      const reviews = await ReviewService.getForPlace(place.place_id || place.id);
      this._communityReviews = reviews || [];
      panel.innerHTML = '';
      if (!this._communityReviews.length) {
        panel.innerHTML = '<p class="wpr-empty">Sé el primero en reseñar este lugar</p>';
      } else {
        this._communityReviews.forEach(r => {
          panel.appendChild(this._buildReviewCard(
            r.display_name || 'Usuario',
            r.rating, r.text, '',
            getAvatarUrl(r.display_name || 'user')
          ));
        });
      }
    } catch (e) {
      this._communityReviews = [];
      panel.innerHTML = '<p class="wpr-empty">Sé el primero en reseñar este lugar</p>';
    }
    this._buildReviewsHeader(place); // refresca el conteo del tab WhatsPlan
  }

  isVisible() { return this._el?.classList.contains('visible'); }
}

export { PlaceModal2 as PlaceModal };