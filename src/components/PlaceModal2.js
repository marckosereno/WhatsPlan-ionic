// ══════════════════════════════════════════════════════════════════════
// WHATSPLAN — PlaceModal2.js  (diseño alternativo, Google Maps-inspired)
// ══════════════════════════════════════════════════════════════════════
import { PlaceTagService, PLACE_TAGS } from '/src/services/PlaceTagService.js';
import { ReviewService }               from '/src/services/ReviewService.js';
import { ActivityService }             from '/src/services/SupabaseService.js';
import { getAvatarUrl }                from '/src/services/AvatarService.js';
import { PlaceClaimService }           from '/src/services/PlaceClaimService.js';
import { FavoriteService }             from '/src/services/FavoriteService.js';

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
    // Volvimos a fullscreen — el <div> a mano de antes, sin ion-modal.
    const el = document.createElement('div');
    el.id = 'wp-pm2';
    el.innerHTML = `
      <div id="wp-pm2-backdrop"></div>
      <div id="wp-pm2-card">

        <!-- WHITE OVERLAY grows upward on scroll -->
<!-- TOPBAR -->
        <div id="wp-pm2-topbar">
          <button id="wp-pm2-back">
            <svg width="13" height="13" viewBox="0 0 32.75 32.75" fill="#000000" xmlns="http://www.w3.org/2000/svg"><path d="M32.75,16.377c0,2.209-1.791,4-4,4H12.646l3.754,4.42c1.431,1.684,1.224,4.207-0.46,5.638 c-0.752,0.64-1.672,0.95-2.587,0.95c-1.134,0-2.26-0.479-3.051-1.41l-9.351-11.01c-1.268-1.492-1.268-3.687,0-5.178l9.351-11.01 c1.431-1.684,3.954-1.89,5.638-0.459s1.891,3.954,0.46,5.638l-3.754,4.42H28.75C30.959,12.376,32.75,14.167,32.75,16.377z"/></svg>
          </button>
          <span id="wp-pm2-topbar-title"></span>
          <div id="wp-pm2-topbar-actions">
            <button id="wp-pm2-topbar-share" class="wp-pm2-tb-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1141,4.49112 L9.91063,7.63542 L9.891,8.05196 L9.8012,8.06134 C5.36297,8.583 2,12.3671 2,17 C2,17.457 2.03414,17.91 2.10168,18.3565 C2.38094,20.2022 2.59088,20.3807 3.87391,18.8547 C4.18977,18.479 4.54227,18.1439 4.91368,17.8247 C6.24977,16.7224 7.90632,16.0786 9.66842,16.0067 L9.894,16.002 L9.95549,17.2308 L10.1215,19.576 C10.2008,20.38 11.0467,20.9293 11.8253,20.4902 C12.1766,20.2919 12.52,20.0809 12.8641,19.8706 C14.652,18.7519 16.3249,17.4666 17.9553,16.1321 C18.9147,15.3326 19.7558,14.5744 20.4714,13.8844 C20.8007,13.5606 21.1304,13.2376 21.4496,12.9037 C21.9118,12.42 21.9575,11.6189 21.4737,11.1124 C20.3603,9.94706 18.7862,8.48751 16.8271,6.94049 C15.2394,5.69825 13.597,4.53773 11.8571,3.51856 C11.0203,3.04172 10.1902,3.69599 10.1141,4.49112 Z"/></svg>
            </button>
            <button id="wp-pm2-topbar-more" class="wp-pm2-tb-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#000000"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM8.0002 13.3C8.71817 13.3 9.3002 12.7179 9.3002 12C9.3002 11.282 8.71817 10.7 8.0002 10.7C7.28223 10.7 6.7002 11.282 6.7002 12C6.7002 12.7179 7.28223 13.3 8.0002 13.3ZM16.0002 13.3C16.7182 13.3 17.3002 12.7179 17.3002 12C17.3002 11.282 16.7182 10.7 16.0002 10.7C15.2822 10.7 14.7002 11.282 14.7002 12C14.7002 12.7179 15.2822 13.3 16.0002 13.3ZM12.0002 13.3C12.7182 13.3 13.3002 12.7179 13.3002 12C13.3002 11.282 12.7182 10.7 12.0002 10.7C11.2822 10.7 10.7002 11.282 10.7002 12C10.7002 12.7179 11.2822 13.3 12.0002 13.3Z"/></svg>
            </button>
          </div>
        </div>
        <!-- FADE — degradado blanco pegado debajo del topbar; el contenido
             que scrollea ahí se desvanece gradual en vez de cortarse -->
        <div id="wp-pm2-topbar-fade"></div>
        <div id="wp-pm2-bottom-fade"></div>

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
                <span id="wp-pm2-fav-badge" class="wp-pm2-featured-badge wp-pm2-fav-badge" style="display:none"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>En tus favoritos</span>
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
            <button id="wp-pm2-add-review" class="wp-pm2-pill-btn wp-pm2-fav-add"></button>
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
          <div class="wp-pm2-section-heading" id="wp-pm2-photos-heading">Fotos</div>
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
                <span>Escribe una reseña...</span>
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

      <!-- LIGHTBOX — carrusel de fotos a pantalla completa, con swipe -->
      <div id="wp-pm2-lightbox">
        <button id="wp-pm2-lb-close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div id="wp-pm2-lb-counter"></div>
        <div id="wp-pm2-lb-track"></div>
      </div>
    `;
    // El hero vive DENTRO del área que hace scroll (#wp-pm2-body): así su
    // borde inferior y el título se desplazan con el scroll NATIVO del
    // sistema, pegados al contenido, sin depender de JS (antes JS los movía
    // y en el teléfono se escalonaban o, con suavizado, se separaban del
    // contenido dejando un hueco). JS solo mueve la foto (parallax lento)
    // y las opacidades. Sigue siendo position:absolute top:0, ahora
    // relativo al contenido del body, encima del spacer.
    // Capas del hero (de atrás hacia adelante):
    //  1. #wp-pm2-hero-inner (FOTO): fuera del scroll, detrás de todo. JS
    //     la mueve despacio (parallax 22%) con suavizado. Nunca pelea con
    //     el scroll nativo (si estuviera dentro, el sistema la subiría y JS
    //     la bajaría un cuadro tarde → temblor).
    //  2. #wp-pm2-body (scroll, fondo transparente) con:
    //     - #wp-pm2-hero (degradado blanco + título): se desplaza con el
    //       scroll nativo, pegado al contenido.
    //     - #wp-pm2-sheet (todo el contenido, fondo blanco): al subir tapa
    //       la foto de forma nativa.
    const heroNode   = el.querySelector('#wp-pm2-hero');
    const bodyNode   = el.querySelector('#wp-pm2-body');
    const photoNode  = el.querySelector('#wp-pm2-hero-inner');
    const areaNode   = el.querySelector('#wp-pm2-content-area');
    const spacerNode = el.querySelector('#wp-pm2-scroll-spacer');
    if (heroNode && bodyNode && photoNode && areaNode && spacerNode) {
      areaNode.insertBefore(photoNode, areaNode.firstChild);
      bodyNode.prepend(heroNode);
      const sheet = document.createElement('div');
      sheet.id = 'wp-pm2-sheet';
      [...bodyNode.children].forEach(c => {
        if (c !== heroNode && c !== spacerNode) sheet.appendChild(c);
      });
      bodyNode.appendChild(sheet);
    }
    document.body.appendChild(el);
    this._el = el;
    this._lightboxEl = el.querySelector('#wp-pm2-lightbox'); // vive adentro de nuevo

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
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap';
      document.head.appendChild(pre1);
      document.head.appendChild(pre2);
      document.head.appendChild(fontLink);
    }

    const s = document.createElement('style');
    s.id = 'wp-pm2-css';
    s.textContent = `
      #wp-pm2 {
        display:none; position:fixed; inset:0;
        /* 2100 alcanza de sobra contra el mapa/minicard normal — pero
           cuando la ficha se abre desde el slide de cluster (el flip en
           MapView.js), el slide NO se destruye, se pausa: sus tarjetas y
           decoraciones se quedan en el DOM a z-index 100000+ (hasta
           999999 el puente que "vuela" hacia acá), solo con
           pointer-events:none. Con 2100 la ficha se abría por DEBAJO de
           todo eso — se veía perfecto desde el minicard (nada compite
           ahí) pero invisible desde el slide (tapada por sus propias
           tarjetas, que siguen ahí, pausadas pero visibles). Subida por
           encima de cualquier cosa que el slide pueda dejar viva detrás. */
        z-index: 1500000;
        /* Fuente global: se cambia solo en styles/fonts.css */
        font-family: var(--wp-font);
        font-weight:400;
      }
      #wp-pm2.visible { display:block; }
      /* Todo lo que queda DETRÁS de la ficha abierta (mapa con sus pins
         animados, slide de clusters pausado, minicard, paneles): se oculta
         y se congelan sus animaciones mientras la ficha lo tapa completo.
         Ver _coverBehind. */
      .wp-pm2-under { visibility:hidden; }
      #wp-pm2-backdrop { opacity:0; transition:opacity 0.32s ease-out; }
      #wp-pm2.wp-pm2-in #wp-pm2-backdrop { opacity:1; }
      #wp-pm2-card {
        opacity:0; transform:translateY(18px) scale(0.97);
        transition:opacity 0.26s ease-out, transform 0.3s cubic-bezier(0.22,1,0.36,1);
      }
      #wp-pm2.wp-pm2-in #wp-pm2-card { opacity:1; transform:none; }
      /* Modo flip (viene del slide, o vuelve hacia él) — el card entero
         solo hace fade, nunca traslado/escala: ese movimiento ya lo
         hace el puente que vuela por fuera, y si el card TAMBIÉN se
         mueve son dos cosas animando a la vez. Especificidad (0,2,0)
         contra la base #wp-pm2-card (0,1,0) — no hace falta !important,
         gana por ser más específica.
         0.34s — misma duración que el vuelo del puente (ver flyTo() en
         MapView.js). Antes esto duraba menos (0.22s) que el vuelo: el
         fondo de la ficha desaparecía mientras la foto todavía seguía
         volando sola contra un fondo casi vacío — eso es lo que se veía
         forzado/descoordinado. Con la misma duración, todo resuelve
         junto. */
      /* Modo flip (viene del slide, o vuelve hacia él) — ya NO hay
         puente volando por fuera (se sacó, era la parte pesada de la
         transición: recreaba posición+tamaño+radio+borde a la vez).
         Ahora el card entero hace su propio pulse — entra achicado y
         transparente, sale igual — independiente de la tarjeta del
         slide, que hace SU PROPIO pulse-in por separado, sin ninguna
         interpolación de forma entre una y otra. Rápido (0.22s) porque
         es un pulse simple, no un vuelo con distancia real que
         recorrer. */
      #wp-pm2.wp-pm2-flip-entry #wp-pm2-card {
        transform:scale(0.92);
        transition:opacity 0.22s ease-out, transform 0.22s cubic-bezier(0.34,1.4,0.64,1);
      }
      #wp-pm2.wp-pm2-in.wp-pm2-flip-entry #wp-pm2-card { transform:scale(1); }
      /* Salida: fade puro, sin ningún movimiento (ni escala ni
         traslado) — el card entero se desvanece en el lugar. Sin nada
         viajando, no hay "rectángulo con esquinas cuadradas" que se
         note rígido en pleno movimiento; ver también la regla del hero
         más abajo (#wp-pm2.wp-pm2-flip-exit #wp-pm2-hero), que le
         redondea las esquinas apenas arranca esta salida.
         SOLO depende de wp-pm2-flip-exit — a propósito, sin exigir
         también wp-pm2-flip-entry: hide() agrega esta clase siempre
         (ver el JS), sin importar si la ficha se abrió desde el flip
         del slide, desde el minicard o desde la búsqueda global. Así
         esta salida es la misma en los tres casos. */
      #wp-pm2.wp-pm2-flip-exit #wp-pm2-card {
        transform:none;
        transition:opacity 0.24s ease-in;
      }
      #wp-pm2-backdrop {
        position:absolute; inset:0; background:rgba(0,0,0,0.45);
      }
      #wp-pm2-card {
        position:absolute; inset:0;
        background:#fff;
        display:flex; flex-direction:column;
        overflow:hidden;
      }
      /* Mientras el flip de una foto viene "volando" desde el slide, la
         foto real del hero se mantiene invisible — revealHeroNow() la
         hace aparecer recién cuando el clon que vuela llega a destino,
         para que no se vean las dos superpuestas ni un salto entre una y
         otra. */
      #wp-pm2-hero-bg.wp-pm2-hero-pending { opacity:0; }

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
        font-family:var(--wp-font);
        /* Misma entrada que usa el header del slide (.wp-ce-collage-header
           en MapView.js) — mismos valores exactos (opacity, distancia del
           translateY, duración, curva bouncy) para que se sientan como
           el mismo gesto en las dos pantallas. Es SOLO del topbar — el
           resto de la ficha (fondo, contenido) sigue con su propia
           entrada de siempre, sin tocar. Aplica siempre que la ficha
           entra, sin importar si es flip desde el slide o apertura
           normal — .wp-pm2-in se activa en los dos casos por igual. */
        opacity:0; transform:translateY(-10px);
        transition:opacity 0.38s cubic-bezier(0.34,1.56,0.64,1), transform 0.38s cubic-bezier(0.34,1.56,0.64,1);
      }
      #wp-pm2.wp-pm2-in #wp-pm2-topbar { opacity:1; transform:translateY(0); }
      /* Topbar 100% transparente: no tiene fondo propio. La sombra usa el
         mismo blur sutil (0.5px) + mask-image que la versión nativa de
         app.css (ion-app::before) — acá con control propio para poder
         reaccionar al scroll (la nativa es estática). */
      #wp-pm2-topbar-fade {
        position:fixed; top:0; left:0; right:0;
        height:calc(env(safe-area-inset-top,20px) + 100px);
        background:linear-gradient(to bottom,
          rgba(255,255,255,0.9) 0%,
          rgba(255,255,255,0.5) 55%,
          rgba(255,255,255,0) 100%);
        /* Sin backdrop-filter: el blur de 0.5px casi no se notaba y en
           Safari (y en Android mientras la ficha hace fade-in) el borde
           inferior de esa capa de blur se dibujaba como una LÍNEA oscura
           horizontal — Safari no le aplica el mask-image al blur, así que
           el corte quedaba duro. Además esa capa se repinta tarde durante
           el scroll con inercia, que es el "retraso" de la sombra. */
        mask-image:linear-gradient(to bottom, black 0%, black 40%, transparent 100%);
        -webkit-mask-image:linear-gradient(to bottom, black 0%, black 40%, transparent 100%);
        z-index:9; pointer-events:none;
        opacity:0.4; /* JS la sube con el scroll — sin transition: la
                        transición de 0.05s le sumaba retraso al seguir el scroll */
      }

      /* Sombra blanca en el borde inferior — igual que la del top pero
         invertida (blanco abajo, transparente arriba), fija (no se anima
         con el scroll). Vive DETRÁS de los botones flotantes del footer
         (z-index menor) para que el contenido se pierda ahí suavemente. */
      #wp-pm2-bottom-fade {
        position:absolute;
        left:0; right:0; bottom:0;
        height:110px;
        background:linear-gradient(to top,
          rgba(255,255,255,0.95) 0%,
          rgba(255,255,255,0.7) 45%,
          rgba(255,255,255,0) 100%);
        z-index:5; pointer-events:none;
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
      /* Abanico de fotos (experimento PHOTO_STACK) */
      #wp-pm2-activity-stack .wp-pm2-photo-card {
        padding:0;
        background-color:#e5e7eb; background-size:cover; background-position:center;
        border:2.5px solid #fff;
        box-shadow:0 8px 20px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12);
      }
      .wp-pm2-photo-count {
        position:absolute; left:6px; bottom:6px;
        display:inline-flex; align-items:center; gap:4px;
        padding:3px 7px; border-radius:999px;
        background:rgba(0,0,0,0.55); color:#fff;
        font-size:10.5px; font-weight:700; font-family:var(--wp-font);
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
      #wp-pm2-back:active { transform:scale(0.92); }
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

      /* Destello tipo GPS al tocar — mismo lenguaje visual que el anillo
         de las actividades en el mapa (.pin-pulse-ring/@keyframes
         pinPulse en map.css: scale(1)→scale(2.2), opacity 0.7→0), pero
         disparado UNA vez por toque (no infinito) en vez de repetirse
         solo. z-index:-1 para quedar SIEMPRE detrás del ícono del
         botón, nunca tapándolo. */
      @keyframes wpPm2TapFlash {
        0%   { transform:scale(1);   opacity:0.55; }
        100% { transform:scale(1.5); opacity:0; }
      }
      #wp-pm2-back::after, .wp-pm2-tb-btn::after {
        content:''; position:absolute; inset:0; border-radius:9999px;
        background:rgba(255,255,255,0.75);
        opacity:0; pointer-events:none; z-index:-1;
      }
      #wp-pm2-back.wp-pm2-tap-flash::after, .wp-pm2-tb-btn.wp-pm2-tap-flash::after {
        animation:wpPm2TapFlash 0.5s ease-out;
      }

      /* CONTENT AREA — hero (overlay) encima de body (ocupa TODO el área,
         incl. detrás del hero) */
      #wp-pm2-content-area {
        position:relative; flex:1; overflow:hidden;
      }

      /* HERO — overlay absoluto que se encoge (overflow:hidden) */
      #wp-pm2-hero {
        position:absolute; top:0; left:0; right:0; z-index:5;
        height:88vw; min-height:320px; max-height:460px;
        overflow:hidden; background:transparent;
        will-change:height;
        /* Al salir (wp-pm2-flip-exit, ver más abajo), las esquinas se
           redondean RÁPIDO (0.15s — más corto que el fade de 0.24s del
           card) para que ya estén redondeadas antes de que el
           desvanecido se note. Es lo que evita que la foto se lea como
           un cartón cuadrado despidiéndose. */
        border-radius:0px;
        transition:border-radius 0.15s ease-out;
      }
      #wp-pm2.wp-pm2-flip-exit #wp-pm2-hero { border-radius:22px; }
      /* PARALLAX — el hero está DENTRO de #wp-pm2-body y se desplaza con
         el scroll nativo (borde inferior y título pegados al contenido).
         Como en el activity stack ("Crear actividad en este lugar"), lo
         que mueve JS (la foto y las opacidades) usa solo transform/opacity
         con una transición corta que tapa los cuadros perdidos. La clase
         se pone después de ubicar todo al abrir (si no, al reabrir
         animaría desde la posición de la ficha anterior). */
      /* Solo la FOTO se suaviza (su parallax lo calcula JS): el borde del
         hero y el título ya se mueven con el scroll nativo, sin retraso. */
      #wp-pm2.wp-pm2-hero-smooth #wp-pm2-hero-inner {
        transition:border-radius 0.15s ease-out, transform 0.14s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease;
      }
      #wp-pm2.wp-pm2-hero-smooth #wp-pm2-hero-bottom,
      #wp-pm2.wp-pm2-hero-smooth #wp-pm2-topbar-fade,
      #wp-pm2.wp-pm2-hero-smooth #wp-pm2-topbar-actions {
        transition:opacity 0.2s ease;
      }
      /* Wrapper de alto FIJO (= alto inicial del hero) que se traslada hacia
         arriba. Imagen + gradiente + título viven aquí y suben juntos. */
      /* height:100% = alto del hero mientras el JS todavía no fijó fullH
         en px (los primeros frames de la apertura). Sin esto medían 0 y
         la foto/gradiente aparecían de golpe un par de frames después. */
      /* FOTO del hero — capa de fondo, fuera del scroll (ver _build).
         Mismo alto inicial que #wp-pm2-hero; JS lo fija en px al abrir. */
      #wp-pm2-hero-inner {
        position:absolute; top:0; left:0; right:0; z-index:0;
        height:88vw; min-height:320px; max-height:460px;
        overflow:hidden; border-radius:0px;
        transition:border-radius 0.15s ease-out;
        will-change:transform;
      }
      #wp-pm2.wp-pm2-flip-exit #wp-pm2-hero-inner { border-radius:22px; }
      #wp-pm2-hero-overlay-fast {
        position:absolute; top:0; left:0; right:0; height:100%;
        will-change:transform;
        z-index:2;
      }
      #wp-pm2-hero-bg {
        position:absolute; inset:0;
        background-size:cover; background-position:center;
        /* SIN filter: un filter:saturate() en la foto del hero hacía que el
           WebView de Android la re-dibujara con glitch cada vez que una
           hoja se animaba encima (confirmado en el teléfono quitándolo). */
      }
      /* bottom:-6px + blanco sólido en los últimos 8px: el borde de
         recorte del hero (height en px, se ajusta al píxel) y el gradiente
         (que sube con transform, se posiciona con subpíxeles) nunca
         coinciden exacto. Esa diferencia de ~1px dejaba ver una fila de la
         foto debajo del blanco = la línea oscura bajo el header, más
         visible en Safari al scrollear y durante el pulse de entrada (el
         scale reacomoda los subpíxeles). Ahora el blanco sobra por debajo
         del recorte, así que el borde siempre cae sobre blanco. */
      #wp-pm2-hero-gradient {
        position:absolute; left:0; right:0; bottom:-6px;
        height:60%; /* ocupa el 60% inferior del hero */
        background:linear-gradient(to bottom,
          transparent 0%,
          rgba(255,255,255,0.6) 50%,
          rgba(255,255,255,1) calc(100% - 8px),
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
        /* none: sin el estirado/brillo propio de Android en los bordes —
           el rebote elástico lo hace _wireElastic (y no hay dos a la vez) */
        overflow-y:auto; overscroll-behavior:none;
        overflow-x:hidden; /* el swipe de responder desplaza tarjetas a la derecha */
        -webkit-overflow-scrolling:touch;
        background:transparent; /* deja ver la foto; el blanco lo pone #wp-pm2-sheet */
      }
      /* Todo el contenido debajo del hero: fondo blanco que al subir tapa la
         foto. padding-top (JS) = el aire entre el borde del hero y el primer
         contenido, para que el blanco empiece justo donde termina el hero. */
      #wp-pm2-sheet { position:relative; background:#fff; min-height:100%; }
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
      /* Solo color (antes también animaba filter:drop-shadow, que obliga
         a re-dibujar la sombra en cada cuadro) */
      @keyframes wp-pm2-ai-pulse {
        0%   { color:#60a5fa; }
        50%  { color:#818cf8; }
        100% { color:#60a5fa; }
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
        font-family:var(--wp-font);
      }
      /* Revelado suave (estilo Apple Intelligence): el texto completo ya
         está puesto (su alto es el final, nada de abajo se mueve) y una
         máscara con borde difuminado baja de arriba hacia abajo. Solo se
         re-dibuja el párrafo ~1.3s; sin transform/filter (sin capas
         nuevas). Al terminar se quita la clase: en reposo no hay máscara. */
      .wp-pm2-ai-text.wp-pm2-ai-reveal {
        -webkit-mask-image:linear-gradient(to bottom, #000 0%, #000 44%, transparent 56%, transparent 100%);
        mask-image:linear-gradient(to bottom, #000 0%, #000 44%, transparent 56%, transparent 100%);
        -webkit-mask-size:100% 260%; mask-size:100% 260%;
        -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;
        animation: wp-pm2-ai-reveal 1.3s cubic-bezier(0.25,0.6,0.3,1) both;
      }
      @keyframes wp-pm2-ai-reveal {
        from { -webkit-mask-position:0 100%; mask-position:0 100%; }
        to   { -webkit-mask-position:0 0%;   mask-position:0 0%; }
      }
      /* steps(28): el brillo avanza a ~20 cuadros/s en vez de 120. Es una
         animación de background-position (se re-dibuja en cada cuadro);
         a 120 cuadros/s, con varios skeletons a la vez, cargaba la ficha. */
      @keyframes wp-pm2-skeleton-shimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .wp-pm2-ai-skeleton { display:flex; flex-direction:column; gap:8px; }
      .wp-pm2-ai-sk-line {
        height:12px; border-radius:6px; width:100%;
        background:linear-gradient(90deg,#e8eaed 25%,#f3f4f6 50%,#e8eaed 75%);
        background-size:200% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
      }
      /* Skeleton de imágenes — sin !important: cada regla iguala/supera la
         especificidad de la regla base del elemento que targetea, así gana
         por cascada normal. El hero usa ::before (no toca su background-image
         real, que lo pone JS directamente sobre el div). */
      #wp-pm2-hero-bg.wp-pm2-skel::before {
        content:''; position:absolute; inset:0;
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
      }
      #wp-pm2-strip img.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
      }
      #wp-pm2-strip img { cursor:pointer; }

      /* LIGHTBOX — carrusel de fotos a pantalla completa, con swipe */
      #wp-pm2-lightbox {
        display:none; position:fixed; inset:0; z-index:3000;
        background:#000;
      }
      #wp-pm2-lightbox.visible { display:block; }
      #wp-pm2-lb-close {
        position:fixed; top:calc(12px + env(safe-area-inset-top,0px)); right:12px;
        z-index:3002; width:38px; height:38px; border-radius:50%; border:none;
        background:rgba(255,255,255,0.16); backdrop-filter:blur(12px);
        -webkit-backdrop-filter:blur(12px);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
      }
      #wp-pm2-lb-counter {
        position:fixed; top:calc(20px + env(safe-area-inset-top,0px)); left:0; right:0;
        z-index:3001; text-align:center;
        font-size:13px; font-weight:700; color:#fff;
        text-shadow:0 1px 4px rgba(0,0,0,0.5);
        pointer-events:none;
      }
      #wp-pm2-lb-track {
        display:flex; height:100%; overflow-x:auto;
        scroll-snap-type:x mandatory; scrollbar-width:none;
        -webkit-overflow-scrolling:touch;
      }
      #wp-pm2-lb-track::-webkit-scrollbar { display:none; }
      .wp-pm2-lb-slide {
        flex:0 0 100%; scroll-snap-align:center;
        display:flex; align-items:center; justify-content:center;
        height:100%;
      }
      .wp-pm2-lb-slide img {
        max-width:100%; max-height:100%; object-fit:contain;
      }

      #wp-pm2-reviews-avatars .wp-pm2-fp-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
      }
      .wp-pm2-review-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
      }
      #wp-pm2-user-avatar.wp-pm2-skel {
        background-image:linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
        background-size:400% 100%;
        animation: wp-pm2-skeleton-shimmer 1.4s steps(28) infinite;
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
      /* Mismo estilo que el "✦ Añadir reseña" de las pestañas (naranja
         con gradiente): es la misma acción, se ve igual en los dos lugares */
      /* Botón bajo el hero: "Añadir a favoritos" → (ya guardado) "Añadir a
         una colección". Antes era "Añadir reseña" (sigue en la sección de
         reseñas y en "Escribe una reseña"). */
      #wp-pm2-add-review {
        margin-left:auto; padding:6px 12px; font-size:12px; font-weight:700; flex-shrink:0;
        white-space:nowrap; border-color:transparent;
        display:inline-flex; align-items:center; gap:5px;
      }
      #wp-pm2-add-review.wp-pm2-fav-add {
        background:linear-gradient(135deg,#fb7185,#e11d48); color:#fff;
        box-shadow:0 2px 8px rgba(225,29,72,0.30);
      }
      #wp-pm2-add-review.wp-pm2-fav-coll {
        background:#0a0a0a; color:#fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.18);
      }
      /* Ya está en una colección: muestra cuál (estado, no acción) */
      #wp-pm2-add-review.wp-pm2-fav-in {
        background:#f3f4f6; color:#111827; border:1px solid rgba(0,0,0,0.08);
        box-shadow:none; flex-shrink:1; min-width:0; max-width:58%;
      }
      .wp-pm2-fav-in-emoji { font-size:13px; line-height:1;
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; }
      .wp-pm2-fav-in-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-pm2-fav-in-more {
        flex:none; padding:1px 6px; border-radius:999px; background:#0a0a0a; color:#fff;
        font-size:10.5px; font-weight:800;
      }
      .wp-pm2-fav-chev { flex:none; opacity:0.55; }
      #wp-pm2-reviews-count { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      /* Pill "♥ En tus favoritos" en el hero (junto a Destacado/Verificado) */
      .wp-pm2-fav-badge {
        display:inline-flex; align-items:center; gap:4px;
        cursor:pointer; -webkit-tap-highlight-color:transparent; pointer-events:auto;
        background:linear-gradient(135deg,#ffe4ea,#fecdd6);
        color:#be123c; border:1px solid rgba(251,113,133,0.5);
        box-shadow:0 2px 6px rgba(225,29,72,0.18);
      }
      /* Hoja "Añadir a una colección" */
      .wp-pm2-col-meta { margin-left:auto; display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:#9ca3af; }
      .wp-pm2-col-check {
        width:22px; height:22px; border-radius:50%; border:2px solid #d1d5db;
        display:flex; align-items:center; justify-content:center; color:transparent;
        transition:background-color 0.15s, border-color 0.15s;
      }
      .wp-pm2-col-check.wp-pm2-on { background:#0a0a0a; border-color:#0a0a0a; color:#fff; }
      .wp-pm2-ms-ico.wp-pm2-col-fav-ico { color:#e11d48; opacity:1; }
      div.wp-pm2-ms-opt { box-sizing:border-box; }
      .wp-pm2-col-unfav.wp-pm2-col-done { background:#0a0a0a; color:#fff; }
      .wp-pm2-col-unfav {
        margin-left:auto; border:none; background:#f3f4f6; color:#4b5563;
        font-size:12px; font-weight:700; font-family:var(--wp-font);
        padding:6px 12px; border-radius:999px; cursor:pointer;
      }
      .wp-pm2-col-sep { height:1px; background:#f0f0f2; margin:4px 20px; }
      .wp-pm2-col-emoji { width:22px; text-align:center; font-size:19px; line-height:1;
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; }
      .wp-pm2-col-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      /* Nueva colección: [ícono] [campo], cada uno con su propio redondeado */
      .wp-pm2-col-list.wp-pm2-col-list-clip { overflow:hidden; }
      .wp-pm2-col-list.wp-pm2-col-list-scroll { overflow-y:auto; overscroll-behavior:contain; }
      .wp-pm2-col-composer {
        padding:12px 16px 4px; display:flex; flex-direction:column; gap:10px;
        border-top:1px solid rgba(0,0,0,0.06); margin-top:4px;
      }
      .wp-pm2-col-row { display:flex; align-items:center; gap:10px; }
      /* Campo pill con el ícono (redondo) adentro, a la izquierda */
      .wp-pm2-col-field {
        position:relative; flex:1; min-width:0; height:48px; box-sizing:border-box;
        display:flex; align-items:center; gap:10px; padding:0 16px 0 5px;
        border-radius:999px; background:#f3f4f6; border:1px solid rgba(0,0,0,0.06);
        transition:background-color 0.15s, border-color 0.15s;
      }
      .wp-pm2-col-field:focus-within { background:#fff; border-color:#93c5fd; }
      /* Botón del ícono estilo "push button": sobresale con su borde de
         abajo y al tocarlo / con los íconos abiertos se queda hundido.
         Se mueve con top (no transform) para no crear capas. */
      .wp-pm2-col-pick {
        position:relative; top:-1px; z-index:1; flex:none; width:36px; height:36px; padding:0;
        border-radius:999px; border:1px solid #e5e7eb; background:linear-gradient(180deg,#ffffff 0%,#f6f7f9 100%);
        box-shadow:0 3px 0 #d6d9de, 0 4px 8px rgba(0,0,0,0.10);
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:top 0.08s ease, box-shadow 0.08s ease, background 0.12s;
      }
      .wp-pm2-col-pick:active,
      .wp-pm2-col-pick.wp-pm2-on {
        top:2px; background:#eef0f3;
        box-shadow:0 0 0 #d6d9de, inset 0 2px 4px rgba(0,0,0,0.12);
      }
      .wp-pm2-col-preview-emoji {
        font-size:21px; line-height:1;
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
      }
      .wp-pm2-col-input2 {
        flex:1; min-width:0; height:100%; padding:0; border:none; background:transparent; outline:none;
        font-size:15px; font-weight:500; font-family:var(--wp-font); color:#0a0a0a;
      }
      /* Tira de íconos: a la derecha del ícono, dentro del campo;
         difuminada al principio y al final */
      .wp-pm2-col-strip {
        position:absolute; top:0; bottom:0; left:46px; right:0;
        border-radius:0 999px 999px 0;
        overflow:hidden; touch-action:pan-y;
        display:flex; align-items:center;
        -webkit-mask-image:linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 26px), transparent 100%);
        mask-image:linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 26px), transparent 100%);
      }
      .wp-pm2-col-strip[hidden] { display:none; }
      .wp-pm2-col-strip-track { display:flex; align-items:center; gap:2px; width:max-content; padding:0 26px 0 12px; }
      /* Íconos de la tira: los no elegidos un poco más chicos y suaves;
         el elegido completo, en una pastilla blanca con un puntito abajo */
      .wp-pm2-col-strip-track button {
        position:relative; width:34px; height:38px; border:none; border-radius:999px; background:transparent; padding:0;
        font-size:17px; line-height:1; cursor:pointer; -webkit-tap-highlight-color:transparent;
        font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
        transition:font-size 0.15s, width 0.15s;
      }
      /* Listo: botón redondo fuera del campo */
      .wp-pm2-col-ok {
        flex:none; width:48px; height:48px; padding:0; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s, color 0.15s, opacity 0.15s;
      }
      .wp-pm2-col-ok:disabled { background:#e5e7eb; color:#9ca3af; }
      .wp-pm2-col-ok.wp-pm2-busy { opacity:0.5; }
      /* Cada colección va en una "tarjeta" redondeada (.wp-pm2-col-sw):
         el hundido, el swipe y el arrastre se ven redondos */
      .wp-pm2-col-sw { position:relative; margin:0 8px; border-radius:999px; overflow:hidden; }
      .wp-pm2-col-sw .wp-pm2-ms-opt.wp-pm2-col-row-item {
        position:relative; width:100%; margin:0; padding:11px 16px; border-radius:999px;
        background:#fff; touch-action:pan-y; transition:background-color 0.25s ease;
        user-select:none; -webkit-user-select:none; -webkit-touch-callout:none;
      }
      /* Al tocar y al deslizar se ve la tarjeta redonda completa */
      .wp-pm2-col-sw.wp-pm2-tap .wp-pm2-ms-opt.wp-pm2-col-row-item,
      .wp-pm2-col-sw.wp-pm2-swiping .wp-pm2-ms-opt.wp-pm2-col-row-item { background:#f4f5f7; transition:none; }
      /* Botones que aparecen al deslizar a la izquierda */
      .wp-pm2-col-acts { position:absolute; right:8px; top:0; bottom:0; display:flex; align-items:center; gap:8px; }
      .wp-pm2-col-act {
        width:34px; height:34px; padding:0; border:none; border-radius:999px;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-col-act-edit { background:#e5e7eb; color:#111827; }
      .wp-pm2-col-act-del  { background:#e11d48; color:#fff; }
      /* Modos Ordenar / Eliminar: tarjetas gris claro (se ven tocables) */
      .wp-pm2-col-sw.wp-pm2-col-tile { margin:0 8px 6px; overflow:visible; }
      .wp-pm2-col-tile .wp-pm2-ms-opt.wp-pm2-col-row-item { background:#f4f5f7; transition:background-color 0.15s; }
      .wp-pm2-col-tile.wp-pm2-sel .wp-pm2-ms-opt.wp-pm2-col-row-item { background:#fff1f2; }
      .wp-pm2-col-tile.wp-pm2-editing .wp-pm2-ms-opt.wp-pm2-col-row-item { background:#eaf2ff; box-shadow:inset 0 0 0 1.5px #93c5fd; }
      .wp-pm2-col-pen { color:#6b7280; }
      .wp-pm2-col-selbox {
        flex:none; width:22px; height:22px; border-radius:50%; border:2px solid #d1d5db; box-sizing:border-box;
        display:flex; align-items:center; justify-content:center; color:transparent; background:#fff;
      }
      .wp-pm2-sel .wp-pm2-col-selbox { background:#e11d48; border-color:#e11d48; color:#fff; }
      .wp-pm2-col-grip { margin-left:auto; padding:6px; color:#9ca3af; display:flex; touch-action:none; }
      .wp-pm2-col-sw.wp-pm2-shift { transition:top 0.16s ease; }
      .wp-pm2-col-sw.wp-pm2-dragging { z-index:5; border-radius:999px; box-shadow:0 10px 26px rgba(0,0,0,0.18); }
      .wp-pm2-col-sw.wp-pm2-dragging .wp-pm2-ms-opt.wp-pm2-col-row-item { background:#fff; }
      /* Botón del header: ⋯ / ✓ (listo) / ✕ */
      .wp-pm2-ms-header.wp-pm2-col-header { position:relative; padding-right:110px; }
      .wp-pm2-col-hbtn {
        position:absolute; right:14px; top:2px; width:36px; height:36px; padding:0;
        border:none; border-radius:999px; background:transparent; color:#374151;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s;
      }
      .wp-pm2-col-hbtn:active { background:#eef0f3; }
      /* En Ordenar / Eliminar: pill con texto ("Listo" / "Cancelar") */
      .wp-pm2-col-hbtn.wp-pm2-pill {
        width:auto; height:34px; padding:0 16px;
        font-size:14px; font-weight:700; font-family:var(--wp-font);
        background:#f3f4f6; color:#111827;
      }
      .wp-pm2-col-hbtn.wp-pm2-pill.wp-pm2-done { background:#0a0a0a; color:#fff; }
      .wp-pm2-col-hbtn.wp-pm2-pill:active { background:#e5e7eb; }
      .wp-pm2-col-hbtn.wp-pm2-pill.wp-pm2-done:active { background:#262626; }
      /* Barra de abajo del modo Eliminar */
      .wp-pm2-col-composer[hidden], .wp-pm2-col-bulk[hidden] { display:none; }
      .wp-pm2-col-bulk { padding:12px 16px 4px; border-top:1px solid rgba(0,0,0,0.06); margin-top:4px; }
      .wp-pm2-col-bulk-del {
        width:100%; height:48px; border:none; border-radius:999px;
        background:#e11d48; color:#fff; font-size:15px; font-weight:700; font-family:var(--wp-font);
        cursor:pointer; -webkit-tap-highlight-color:transparent; transition:opacity 0.15s;
      }
      .wp-pm2-col-bulk-del:disabled { opacity:0.35; }
      .wp-pm2-col-editing {
        display:flex; align-items:center; justify-content:space-between;
        padding:0 4px; font-size:12.5px; font-weight:700; color:#2563eb;
      }
      .wp-pm2-col-editing[hidden] { display:none; }
      .wp-pm2-col-editing-x {
        border:none; background:none; padding:4px 6px; color:#6b7280;
        font-size:12.5px; font-weight:700; font-family:var(--wp-font); cursor:pointer;
      }
      /* Menú ⋯ tipo iOS */
      .wp-pm2-pop { position:fixed; inset:0; z-index:1500400; }
      .wp-pm2-pop-catch { position:absolute; inset:0; }
      .wp-pm2-pop-menu {
        position:absolute; min-width:210px; max-width:260px; padding:5px 0;
        background:#fff; border-radius:14px;
        box-shadow:0 10px 38px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08);
        font-family:var(--wp-font);
      }
      .wp-pm2-pop-item {
        width:100%; display:flex; align-items:center; justify-content:space-between; gap:14px;
        padding:11px 16px; border:none; background:transparent; text-align:left;
        font-size:15px; font-weight:500; color:#111827; font-family:var(--wp-font);
        cursor:pointer; -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-pop-item:active { background:#f3f4f6; }
      .wp-pm2-pop-item:disabled { color:#c4c7cc; }
      .wp-pm2-pop-item.wp-pm2-danger { color:#e11d48; }
      .wp-pm2-pop-sep { height:6px; background:#f3f4f6; }
      .wp-pm2-col-hint { margin:2px 20px 6px; font-size:11.5px; color:#9ca3af; }
      /* El elegido crece un poco respecto a los demás */
      .wp-pm2-col-strip-track button.wp-pm2-on {
        width:40px; height:40px; font-size:23px; background:#fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
      }
      .wp-pm2-col-empty { padding:6px 20px 10px; font-size:13px; color:#8e8e93; }

      /* PULSE al tocar — se hunde y rebota. Lo dispara _pulseTap() y la
         acción (abrir la hoja) espera a que se vea el rebote. */
      @keyframes wpPm2TapPulse {
        0%   { transform:scale(1); }
        35%  { transform:scale(0.92); }
        70%  { transform:scale(1.04); }
        100% { transform:scale(1); }
      }
      @keyframes wpPm2TapPulseWide {
        0%   { transform:scale(1); }
        35%  { transform:scale(0.97); }
        70%  { transform:scale(1.015); }
        100% { transform:scale(1); }
      }
      .wp-pm2-tap-pulse      { animation:wpPm2TapPulse 0.34s cubic-bezier(0.34,1.4,0.64,1); }
      /* Dentro del scroll de la ficha (reseñas, chips, "Escribe una
         reseña"…) el pulse lo hace JS cuadro por cuadro con un transform
         2D sin transición/animación CSS (ver _scaleKeys): se ve igual
         que el rebote de siempre, pero el teléfono lo re-dibuja en vez de
         crear capas — y no separa en capas lo de alrededor (eso era el
         parpadeo del long-press con 3+ respuestas). */
      .wp-pm2-tap-pulse-wide { animation:wpPm2TapPulseWide 0.34s cubic-bezier(0.34,1.4,0.64,1); }

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
      /* overflow:hidden (NO auto): una franja con scroll horizontal propio
         dentro del scroll de la ficha hacía que el WebView de Android
         re-dibujara la galería con glitch cada vez que una hoja aparecía
         encima (confirmado en el teléfono: con overflow hidden, sin
         glitch). El deslizamiento lo hace JS (_wireStripDrag) moviendo
         la tira interna con transform; pan-y deja el scroll vertical de
         la ficha en manos del sistema. */
      #wp-pm2-strip {
        padding:14px 18px;
        overflow:hidden;
        touch-action:pan-y;
      }
      .wp-pm2-strip-track {
        display:flex; gap:6px; width:max-content;
      }
      /* Solo mientras se arrastra / sigue por inercia: capa propia para
         que el movimiento lo haga la GPU sin re-dibujar. Al terminar se
         quita (sin capa en reposo = sin glitch al abrir hojas). */
      .wp-pm2-strip-track.wp-pm2-moving { will-change:transform; }
      #wp-pm2-strip::-webkit-scrollbar { display:none; }
      #wp-pm2-strip img {
        width:150px; height:210px; object-fit:cover;
        border-radius:0; flex-shrink:0; cursor:pointer;
      }
      /* Solo los bordes EXTERNOS del strip quedan bien redondeados —
         izquierdo de la primera foto, derecho de la última — como si
         todo el slide fuera una sola píldora continua */
      #wp-pm2-strip img:first-child {
        border-top-left-radius:14px;
        border-bottom-left-radius:14px;
      }
      #wp-pm2-strip img:last-child {
        border-top-right-radius:14px;
        border-bottom-right-radius:14px;
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
      .wpr-tab.wpr-tab-add {
        margin-left:auto;
        background:linear-gradient(135deg,#f59e0b,#f97316);
        border-color:transparent; color:#fff;
        box-shadow:0 2px 8px rgba(249,115,22,0.30);
      }
      .wpr-tab.wpr-tab-add:active { filter:brightness(0.92); }
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
        transition:background-color 0.15s ease;
        -webkit-tap-highlight-color:transparent;
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
        font-size:13px; color:#374151; margin-top:4px; line-height:1.5; font-weight:400;
        display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:6;
        overflow:hidden; font-family:var(--wp-font);
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

      /* ── REACCIONES Y RESPUESTAS ─────────────────────────────────── */
      /* La tarjeta no permite seleccionar texto: el long-press abre las
         reacciones en vez del menú de copiar del sistema. */
      .wp-pm2-review-row {
        -webkit-user-select:none; user-select:none;
        -webkit-touch-callout:none;
        transition:background-color 0.2s ease;
        border-radius:16px;
      }
      /* touch-action:pan-y → el scroll vertical lo maneja el navegador y
         el gesto horizontal (swipe para responder) llega al JS */
      .wp-pm2-review-row { position:relative; touch-action:pan-y; }
      /* Long-press: solo se tiñe el fondo. Antes también se encogía
         (transform:scale), y eso convertía la tarjeta en una capa aparte
         y obligaba al teléfono a separar en capas todo lo que tiene
         encima/debajo (las demás respuestas) → parpadeo en esa zona, más
         notorio con 3+ respuestas. */
      .wp-pm2-review-row.wp-pm2-rv-pressing { background-color:#f6f7f9; }
      .wp-pm2-review-row.wp-pm2-rv-focus { background-color:#f3f4f6; }
      .wp-pm2-emoji {
        font-family:'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif;
        line-height:1;
      }
      /* Chips con el resumen de reacciones (😍 4  😂 1) */
      .wp-pm2-rv-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
      .wp-pm2-rv-chips:empty { display:none; }
      .wp-pm2-rv-chip {
        display:inline-flex; align-items:center; gap:4px;
        padding:3px 8px 3px 6px; border-radius:999px;
        background:#f3f4f6; border:1px solid transparent;
        font-size:11px; font-weight:700; color:#4b5563;
        font-family:var(--wp-font); cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s ease;
      }
      .wp-pm2-rv-chip .wp-pm2-emoji { font-size:13px; }
      .wp-pm2-rv-chip.wp-pm2-mine { background:#eef4ff; border-color:#bfd4fb; color:#1d4ed8; }
      
      /* Fila de acciones: Útil · Responder */
      .wp-pm2-rv-actions { display:flex; align-items:center; gap:8px; margin-top:8px; }
      .wp-pm2-rv-btn {
        display:inline-flex; align-items:center; gap:5px;
        height:26px; padding:0 10px; border-radius:999px; border:none;
        background:#f3f4f6; color:#6b7280;
        font-size:11.5px; font-weight:700; font-family:var(--wp-font);
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s ease;
      }
      .wp-pm2-rv-btn svg { flex-shrink:0; }
            .wp-pm2-rv-btn.wp-pm2-on {
        background:linear-gradient(180deg,#4f8ff7 0%,#2563eb 100%);
        color:#fff;
      }

      /* Respuestas — un solo nivel, colapsadas por defecto */
      .wp-pm2-rv-replies { margin-top:6px; }
      .wp-pm2-rv-replies:empty { display:none; }
      .wp-pm2-rv-toggle {
        display:inline-flex; align-items:center; gap:6px;
        background:none; border:none; padding:4px 0; cursor:pointer;
        font-size:12px; font-weight:700; color:#2563eb; font-family:var(--wp-font);
        -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-rv-toggle::before {
        content:''; width:18px; height:1px; background:#d1d5db;
      }
      .wp-pm2-rv-reply {
        /* padding + margin negativo del mismo valor: el texto queda
           alineado igual que antes, pero el fondo del long-press/focus
           deja aire alrededor del avatar en vez de pegarse a él */
        display:flex; gap:8px; padding:8px 10px; margin:0 -10px;
        position:relative; touch-action:pan-y; border-radius:12px;
        transition:background-color 0.2s ease;
      }
      .wp-pm2-rv-reply.wp-pm2-rv-pressing { background-color:#f3f4f6; }
      .wp-pm2-rv-reply.wp-pm2-rv-focus { background-color:#eef0f3; }
      .wp-pm2-rv-reply-to { margin-left:6px; font-size:11px; font-weight:600; color:#9ca3af; }
      .wp-pm2-rv-mention { color:#2563eb; font-weight:600; }
      .wp-pm2-rv-reply-act {
        background:none; border:none; padding:0; cursor:pointer;
        font-size:11px; font-weight:700; color:#6b7280; font-family:var(--wp-font);
        -webkit-tap-highlight-color:transparent;
      }
      .wp-pm2-rv-chips-sm { margin-top:4px; gap:4px; }
      .wp-pm2-rv-chips-sm .wp-pm2-rv-chip { padding:1px 6px 1px 4px; font-size:10px; }
      .wp-pm2-rv-chips-sm .wp-pm2-rv-chip .wp-pm2-emoji { font-size:11px; }
      /* Ícono que aparece a la izquierda al deslizar para responder */
      .wp-pm2-rv-swipe-icon {
        position:absolute; left:0; top:50%;
        width:28px; height:28px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        background:#e5e7eb; color:#6b7280;
        opacity:0; transform:translateY(-50%) scale(0.6);
        pointer-events:none; z-index:2;
      }
      .wp-pm2-review-row > .wp-pm2-rv-swipe-icon { top:27px; }
      .wp-pm2-rv-swipe-icon.wp-pm2-on {
        background:linear-gradient(180deg,#4f8ff7 0%,#2563eb 100%);
        color:#fff;
      }
      .wp-pm2-rv-reply img {
        width:24px; height:24px; border-radius:50%; object-fit:cover;
        flex-shrink:0; background:#e5e7eb;
      }
      .wp-pm2-rv-reply-body { flex:1; min-width:0; }
      .wp-pm2-rv-reply-name { font-size:12px; font-weight:700; color:#0a0a0a; }
      .wp-pm2-rv-reply-text {
        font-size:12.5px; color:#374151; line-height:1.45; margin-top:1px;
        font-family:var(--wp-font); word-wrap:break-word;
      }
      .wp-pm2-rv-reply-meta { display:flex; gap:10px; margin-top:2px; font-size:11px; color:#9ca3af; }

      /* Botón ⋯ (Copiar / Editar / Eliminar / Reportar / Bloquear) */
      .wp-pm2-rv-more {
        position:absolute; top:4px; right:6px; z-index:3;
        width:32px; height:32px; border-radius:50%; border:none;
        background:transparent; color:#9ca3af;
        display:flex; align-items:center; justify-content:center;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s;
      }
      .wp-pm2-rv-more:active { background-color:#e5e7eb; }
      .wp-pm2-rv-more-sm { top:2px; right:4px; width:28px; height:28px; }
      .wp-pm2-review-name, .wp-pm2-rv-reply-name { padding-right:30px; }

      /* Contenido que ESTE usuario reportó (pendiente de revisión) */
      .wp-pm2-rv-review-badge {
        display:inline-block; margin-left:6px; vertical-align:1px;
        padding:1px 7px; border-radius:999px;
        background:linear-gradient(180deg,#fde68a 0%,#fbbf24 100%);
        color:#78350f; font-size:10px; font-weight:700; letter-spacing:0.01em;
      }
      .wp-pm2-rv-blur { filter:blur(5px); opacity:0.7; pointer-events:none; }
      .wp-pm2-rv-reveal {
        display:inline-flex; align-items:center; gap:5px;
        margin-top:4px; padding:3px 10px; border-radius:999px;
        border:none; background:#f3f4f6; color:#4b5563;
        font-size:11px; font-weight:700; font-family:var(--wp-font);
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.15s;
      }
            .wp-pm2-ms-opt:disabled { color:#9ca3af; cursor:default; }
      .wp-pm2-ms-opt:disabled:active { background-color:transparent; }

      /* Pill "Dueño" (dueño verificado del lugar) */
      .wp-pm2-rv-owner-badge {
        display:inline-block; margin-left:6px; vertical-align:1px;
        padding:1px 7px; border-radius:999px;
        background:linear-gradient(180deg,#3a3a3c 0%,#111111 100%);
        color:#fff; font-size:10px; font-weight:700; letter-spacing:0.01em;
      }

      /* Formulario "¿Es tu negocio?" */
      .wp-pm2-cl { padding:0 20px 6px; }
      .wp-pm2-cl-intro { margin:0 0 12px; font-size:13px; line-height:1.45; color:#4b5563; }
      .wp-pm2-cl-intro b { color:#111827; }
      .wp-pm2-cl-field { display:block; margin-bottom:10px; }
      .wp-pm2-cl-field > span { display:block; font-size:12px; font-weight:700; color:#374151; margin-bottom:4px; }
      .wp-pm2-cl-field em { font-style:normal; font-weight:500; color:#9ca3af; }
      .wp-pm2-cl-input {
        width:100%; box-sizing:border-box; border-radius:12px;
        border:1px solid rgba(0,0,0,0.10); background:#f9f9f9;
        padding:10px 12px; font-size:14px; color:#0a0a0a;
        font-family:var(--wp-font); outline:none; resize:none;
      }
      .wp-pm2-cl-input:focus { border-color:#93c5fd; background:#fff; }
      .wp-pm2-cl-roles { display:flex; gap:8px; }
      .wp-pm2-cl-role {
        flex:1; height:36px; border-radius:999px; border:1px solid rgba(0,0,0,0.10);
        background:#f3f4f6; color:#4b5563; font-size:13px; font-weight:700;
        font-family:var(--wp-font); cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
      }
      .wp-pm2-cl-role:active { transform:scale(0.92); }
      .wp-pm2-cl-role.wp-pm2-on {
        background:linear-gradient(180deg,#4f8ff7 0%,#2563eb 100%);
        color:#fff; border-color:transparent;
      }
      .wp-pm2-cl-note { margin:4px 0 12px; font-size:11.5px; line-height:1.45; color:#8e8e93; }
      .wp-pm2-cl-submit {
        width:100%; height:46px; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff; font-size:15px; font-weight:700;
        font-family:var(--wp-font); cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:opacity 0.15s;
      }
      .wp-pm2-cl-submit:disabled { opacity:0.4; }
      /* Hojas altas (solo el formulario "¿Es tu negocio?"): el scroll va
         en el CONTENIDO, nunca en .wp-pm2-ms-menu. Ponerle overflow a la
         hoja que se anima con transform + border-radius hacía que el
         WebView de Android creara una capa de scroll aparte y la pintara
         un cuadro tarde, sin recortar las esquinas → destello al abrir
         TODAS las hojas. */
      #wp-pm2-menu-sheet.wp-pm2-ms-tall .wp-pm2-ms-body {
        max-height:calc(100vh - 150px - env(safe-area-inset-top,0px));
        max-height:calc(100dvh - 150px - env(safe-area-inset-top,0px));
        overflow-y:auto; overscroll-behavior:contain;
      }



      /* Hoja de opciones / reportar / confirmar */
      #wp-pm2-menu-sheet .wp-pm2-ms-overlay {
        position:fixed; inset:0; z-index:1500100;
        background:rgba(0,0,0,0.3); opacity:0; transition:opacity 0.25s ease;
      }
      #wp-pm2-menu-sheet.wp-pm2-in .wp-pm2-ms-overlay { opacity:1; }
      /* Hoja abierta desde otra: el fondo arranca ya oscuro, sin fade */
      #wp-pm2-menu-sheet.wp-pm2-ms-chained .wp-pm2-ms-overlay { opacity:1; transition:none; }
      #wp-pm2-menu-sheet .wp-pm2-ms-menu {
        position:fixed; left:12px; right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px)); z-index:1500200;
        background:#fff; border-radius:24px; padding:8px 0 10px;
        box-shadow:0 8px 40px rgba(0,0,0,0.18);
        transform:translateY(110%);
        transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);
        font-family:var(--wp-font);
      }
      #wp-pm2-menu-sheet.wp-pm2-in .wp-pm2-ms-menu { transform:translateY(0); }
      .wp-pm2-ms-handle { width:36px; height:4px; border-radius:2px; background:rgba(0,0,0,0.15); margin:0 auto 8px; }
      .wp-pm2-ms-header { padding:4px 20px 8px; }
      .wp-pm2-ms-title { display:block; font-size:16px; font-weight:700; color:#0a0a0a; }
      .wp-pm2-ms-sub { display:block; font-size:12px; color:#8e8e93; margin-top:2px; }
      .wp-pm2-ms-opt {
        width:100%; display:flex; align-items:center; gap:12px;
        padding:13px 20px; border:none; background:transparent;
        font-size:15px; font-weight:600; color:#111827; font-family:var(--wp-font);
        text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:background-color 0.12s;
      }
      .wp-pm2-ms-opt:active { background-color:#f3f4f6; }
      .wp-pm2-ms-opt.wp-pm2-danger { color:#e60000; }
      .wp-pm2-ms-ico { display:flex; width:20px; justify-content:center; color:inherit; opacity:0.85; }
      .wp-pm2-ms-ico:empty { display:none; }
      .wp-pm2-ms-msg { margin:0; padding:0 20px 14px; font-size:14px; line-height:1.45; color:#4b5563; }
      .wp-pm2-ms-actions { display:flex; gap:10px; padding:0 16px 6px; }
      .wp-pm2-ms-btn {
        flex:1; height:46px; border-radius:999px; border:none;
        font-size:15px; font-weight:700; font-family:var(--wp-font);
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1);
      }
      .wp-pm2-ms-btn:active { transform:scale(0.94); }
      .wp-pm2-ms-cancel { background:#f3f4f6; color:#111827; }
      .wp-pm2-ms-danger-btn { background:linear-gradient(180deg,#ff4d4d 0%,#e60000 100%); color:#fff; }
      .wp-pm2-ms-primary-btn { background:#0a0a0a; color:#fff; }

      /* Barra flotante de reacciones (long-press) — vive en <body>,
         por encima de la ficha (#wp-pm2 = 1500000) */
      #wp-pm2-react-layer { position:fixed; inset:0; z-index:1500100; }
      #wp-pm2-react-dim {
        position:absolute; inset:0; background:rgba(0,0,0,0.08);
        opacity:0; transition:opacity 0.2s ease;
      }
      #wp-pm2-react-layer.wp-pm2-in #wp-pm2-react-dim { opacity:1; }
      #wp-pm2-react-bar {
        position:absolute; display:flex; gap:2px; padding:6px 8px;
        background:#fff; border-radius:999px;
        box-shadow:0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
        transform:scale(0.6); opacity:0; transform-origin:var(--wp-pm2-origin, 50% 100%);
        transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease;
      }
      #wp-pm2-react-layer.wp-pm2-in #wp-pm2-react-bar { transform:scale(1); opacity:1; }
      .wp-pm2-react-opt {
        width:44px; height:44px; border-radius:50%; border:none; background:transparent;
        display:flex; align-items:center; justify-content:center;
        font-size:28px; cursor:pointer; -webkit-tap-highlight-color:transparent;
        transform:translateY(8px) scale(0.5); opacity:0;
        transition:transform 0.34s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease, background-color 0.15s;
      }
      #wp-pm2-react-layer.wp-pm2-in .wp-pm2-react-opt { transform:none; opacity:1; }
      .wp-pm2-react-opt.wp-pm2-mine { background:#eef4ff; }
      .wp-pm2-react-opt:active { transform:scale(1.25); }

      /* FOOTER */
      #wp-pm2-footer {
        position:absolute; left:0; right:0; bottom:0; z-index:6;
        display:flex; align-items:center; gap:10px;
        padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
        background:transparent;
        pointer-events:none; /* el aire entre botones deja pasar el scroll de abajo */
        font-family:var(--wp-font);
      }
      #wp-pm2-footer > * { pointer-events:auto; }
      #wp-pm2-here-btn {
        width:48px; height:48px; border-radius:50%; border:none;
        background:#0a0a0a; color:#fff; display:flex; align-items:center;
        justify-content:center; cursor:pointer; flex-shrink:0;
        -webkit-tap-highlight-color:transparent;
        box-shadow:none;
      }
      #wp-pm2-plan-btn {
        flex:1; height:48px; border-radius:999px; border:none;
        background:#0a0a0a; color:#fff; font-size:16px; font-weight:700;
        display:flex; align-items:center; justify-content:center; gap:8px;
        cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
        box-shadow:none;
      }
    `;
    document.head.appendChild(s);
  }

  // ── WIRE EVENTS ────────────────────────────────────────────────────
  _wireEvents() {
    const el = this._el;
    this._wireStripDrag(el.querySelector('#wp-pm2-strip'));
    this._wirePressSquish(el.querySelector('#wp-pm2-body'));
    this._wireElastic(el.querySelector('#wp-pm2-body'));

    // Destello tipo GPS en los botones del topbar — se dispara en
    // pointerdown (no click) para que arranque en el mismo instante que
    // el squish de :active, no un instante después. remove+reflow+add
    // es necesario para poder re-disparar la animación en toques
    // seguidos y rápidos — si solo se agregara la clase, un segundo tap
    // mientras la animación anterior sigue corriendo no haría nada (la
    // clase ya estaba puesta, "agregarla de nuevo" no es un cambio).
    const triggerTapFlash = (btn) => {
      btn.classList.remove('wp-pm2-tap-flash');
      void btn.offsetWidth; // fuerza reflow — sin esto el browser puede no notar el remove+add como dos cambios distintos
      btn.classList.add('wp-pm2-tap-flash');
    };
    el.querySelectorAll('#wp-pm2-back, .wp-pm2-tb-btn').forEach(btn => {
      btn.addEventListener('pointerdown', () => triggerTapFlash(btn));
    });

    el.querySelector('#wp-pm2-back').addEventListener('click', () => this.hide());
    el.querySelector('#wp-pm2-backdrop').addEventListener('click', () => this.hide());

    this._wireTagToggle(el);

    // Lightbox: cerrar con el botón X o tocando el fondo (no la imagen)
    // Vive aparte de `el` ahora (ver _build()) — this._lightboxEl, no
    // el.querySelector.
    this._lightboxEl.querySelector('#wp-pm2-lb-close').addEventListener('click', () => this._closeLightbox());
    this._lightboxEl.addEventListener('click', (e) => {
      if (e.target.id === 'wp-pm2-lightbox') this._closeLightbox();
    });

    el.querySelector('#wp-pm2-plan-btn').addEventListener('click', () => {
      console.log('[PM2] Planear visita:', this._place);
    });
    el.querySelector('#wp-pm2-here-btn').addEventListener('click', () => {
      console.log('[PM2] Estoy aquí:', this._place);
    });
    el.querySelector('#wp-pm2-fuiste').addEventListener('click', () => {
      console.log('[PM2] ¿Fuiste?:', this._place);
    });
    el.querySelector('#wp-pm2-share').addEventListener('click', () => this._sharePlace());
    el.querySelector('#wp-pm2-topbar-share').addEventListener('click', () => this._sharePlace());
    // Los dos "⋯" (topbar y el de las pills bajo la descripción) abren
    // el mismo menú del lugar
    el.querySelector('#wp-pm2-topbar-more').addEventListener('click', () => this._openPlaceMenu());
    el.querySelector('#wp-pm2-more-btn').addEventListener('click', (e) => {
      this._pulseTap(e.currentTarget, () => this._openPlaceMenu());
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
    // "Añade un comentario..." → popup de reseña (estrellas + texto)
    el.querySelector('#wp-pm2-comment-box').addEventListener('click', (e) => {
      this._pulseTap(e.currentTarget, () => this._openReviewModal(), true);
    });
    // Tocar la pill "♥ En tus favoritos" la quita al instante, con
    // "Deshacer" en el aviso (sin pedir confirmación)
    el.querySelector('#wp-pm2-fav-badge').addEventListener('click', (e) => {
      e.stopPropagation();
      this._scaleKeys(e.currentTarget, [1, 0.88, 1], 220);
      this._setFavorite(false, { undo: true });
    });
    el.querySelector('#wp-pm2-add-review').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      this._pulseTap(btn, () => {
        if (this._isFav) this._openCollectionsSheet();
        else this._setFavorite(true);
      });
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
    // Bug real encontrado: _hideMiniSnap() pone pointer-events:none al
    // ocultar, y SearchBar.activate() TAMBIÉN se lo pone al entrar a
    // búsqueda — pero la restauración de ese segundo caso
    // (SearchBar.deactivate()) es CONDICIONAL a una bandera
    // (ms._searchHidden) que no siempre queda bien puesta. Resultado:
    // el panel volvía a aparecer visualmente (opacity:1) pero sin
    // poder tocarse — para siempre, hasta reiniciar la app. La función
    // que MUESTRA el panel tiene que garantizar que quede interactivo,
    // sin importar quién ni por qué se lo haya sacado antes.
    ms.style.pointerEvents = '';

    const name   = place.name || place.displayName || '';
    const rating = parseFloat(place.rating) || 0;
    const count  = place.userRatingCount || place.user_ratings_total || 0;
    const isOpen = self._isOpenNow(place);
    const statusTxt   = isOpen === true ? 'Abierto' : isOpen === false ? 'Cerrado' : 'Sin horario';

    const photosAll = place.photosUrls || place.photos_urls || (place.photoUrl || place.photo_url ? [place.photoUrl || place.photo_url] : []);
    // Antes se cortaba a las primeras 4 con un "+N" en la última — eso
    // no dejaba nada para scrollear de verdad. Ahora se muestran todas
    // (tope de 12 por performance, casi ningún lugar tiene más fotos
    // que eso cargadas) en una tira horizontal con scroll real.
    const photos4 = photosAll.slice(0, 12);

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
      "font-family:var(--wp-font); font-weight:400;",
      'cursor:pointer', 'box-sizing:border-box',
      'padding:8px 14px 8px', 'display:flex', 'flex-direction:column', 'gap:6px',
    ].join(';');

    const avatarCount = Math.min(count || 4, 5);
    const avatarsHtml = Array.from({ length: avatarCount }, (_, i) =>
      `<img src="${getAvatarUrl('guest_' + i)}" style="width:24px;height:24px;border-radius:50%;border:2px solid #fff;margin-left:${i > 0 ? '-7px' : '0'};object-fit:cover;position:relative;z-index:${avatarCount - i};background:#e2e8f0">`
    ).join('');

    const glassBtn = 'height:28px;padding:0 14px;border-radius:999px;border:1px solid rgba(0,0,0,0.10);background:rgba(255,255,255,0.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,0.9);color:#0a0a0a;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent';
    const dotStyle = isOpen === true
      ? 'display:inline-block;width:5px;height:5px;border-radius:50%;flex-shrink:0;background:#fff;box-shadow:0 0 4px rgba(255,255,255,0.8);animation:wp-pm2-dot-pulse 1.8s ease-in-out infinite'
      : isOpen === false
      ? 'display:inline-block;width:5px;height:5px;border-radius:50%;flex-shrink:0;background:#fff;box-shadow:0 0 3px rgba(255,255,255,0.7)'
      : '';
    const badgeDot = isOpen !== null ? `<span style="${dotStyle}"></span>` : '';
    const glassBadge = isOpen === true
      ? 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:linear-gradient(180deg,#34d36b 0%,#16a34a 100%);color:#fff;border:1px solid transparent;background-origin:border-box'
      : isOpen === false
      ? 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:linear-gradient(180deg,#ff4d4d 0%,#e60000 100%);color:#fff;border:1px solid transparent;background-origin:border-box'
      : 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:3px 9px;border-radius:999px;font-family:inherit;background:linear-gradient(180deg,#a3a9b3 0%,#6b7280 100%);color:#fff;border:1px solid transparent;background-origin:border-box';

    const photoCardHtml = (url) => `
      <div class="wp-ms-photo" style="width:68px;height:68px;flex-shrink:0;border-radius:22px;overflow:hidden;position:relative;scroll-snap-align:start;">
        <img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.25s" onload="this.style.opacity=1">
      </div>`;

    ms.innerHTML = `
      <div id="wp-ms-handle" style="position:absolute;top:0;left:0;right:0;height:20px;display:flex;align-items:center;justify-content:center;cursor:grab;z-index:2">
        <div style="width:36px;height:4px;border-radius:2px;background:#1a5cf5;opacity:0.75;pointer-events:none"></div>
      </div>
      <div style="position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:2px;min-height:32px">
        <span style="position:absolute;left:0;${glassBadge}">${badgeDot}${statusTxt}</span>
        <span style="font-size:15px;font-weight:800;color:#0a0a0a;text-align:center;padding:0 100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;box-sizing:border-box">${name}</span>
        <div style="position:absolute;right:0;display:flex;align-items:center;gap:3px;"><button id="wp-ms-fav-btn" style="flex-shrink:0;width:34px;height:30px;padding:0;border-radius:999px;border:none;background:linear-gradient(180deg,#e3ecf8 0%,#c5d5ea 100%);display:flex;align-items:center;justify-content:center;color:#4a5f7e;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 0.18s cubic-bezier(0.34,1.7,0.64,1);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button><button id="wp-ms-close-btn" style="flex-shrink:0;width:34px;height:30px;padding:0;border-radius:999px;border:none;background:linear-gradient(180deg,#ff4d4d 0%,#e60000 100%);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 0.18s cubic-bezier(0.34,1.7,0.64,1);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 7L7 17M7 7l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
      </div>
      <div id="wp-ms-photo-strip" style="display:flex;gap:8px;height:68px;flex-shrink:0;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;margin:0 -14px;padding:0 14px;scroll-padding:0 14px;scrollbar-width:none;">
        ${photos4.length
          ? photos4.map((u) => photoCardHtml(u)).join('')
          : `<div style="width:68px;height:68px;border-radius:22px;background:#f4f4f6;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:20px">📷</span></div>`}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:7px">
          <div style="display:flex;align-items:center">${avatarsHtml}</div>
          ${count > 0 ? `<span style="font-size:11px;font-weight:600;color:#6b7280">${count} reseñas</span>` : `<span style="font-size:11px;color:#9ca3af">Sin reseñas</span>`}
        </div>
        <button id="wp-ms-cta-btn" aria-label="Detalles" style="flex-shrink:0;width:40px;height:30px;padding:0;border-radius:999px;border:1px solid rgba(0,0,0,0.06);background:linear-gradient(180deg,#ffffff 0%,#f1f3f6 100%);box-shadow:0 2px 6px rgba(0,0,0,0.10),inset 0 1.5px 1px #fff,inset 0 -2px 3px rgba(148,163,184,0.20);display:flex;align-items:center;justify-content:center;color:#1f2937;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 0.18s cubic-bezier(0.34,1.7,0.64,1);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
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

    // Corazón del minisnap: el MISMO favorito que el botón de la ficha
    // (guardado en Supabase, ver FavoriteService)
    const favBtn = ms.querySelector('#wp-ms-fav-btn');
    const paintFav = (active) => {
      if (!favBtn) return;
      favBtn.classList.toggle('active', active);
      const svg = favBtn.querySelector('path');
      if (svg) svg.setAttribute('fill', active ? '#fff' : 'none');
      favBtn.style.color = active ? '#fff' : '#4a5f7e';
      favBtn.style.background = active
        ? 'linear-gradient(180deg,#ff7aa8 0%,#ec4899 100%)'
        : 'linear-gradient(180deg,#e3ecf8 0%,#c5d5ea 100%)';
    };
    paintFav(false);
    const msUid = this.getCurrentUser?.()?.id || null;
    const msPid = place.place_id || place.id;
    if (msUid && msPid) {
      FavoriteService.isFavorite(msPid, msUid)
        .then(f => { if (ms.isConnected) paintFav(f); })
        .catch(() => {});
    }
    if (favBtn) favBtn.onclick = async (e) => {
      e.stopPropagation();
      const user = this._requireUser('Inicia sesión para guardar en favoritos');
      if (!user || !msPid) return;
      const on = !favBtn.classList.contains('active');
      paintFav(on);
      this._haptic(on ? 'success' : 'light');
      try {
        if (on) await FavoriteService.add(msPid, user.id);
        else    await FavoriteService.remove(msPid, user.id);
        if (this._place && (this._place.place_id || this._place.id) === msPid) { this._isFav = on; this._renderFavUI(false); }
        this._showToast(on ? '♥ Guardado en favoritos' : 'Quitado de favoritos');
      } catch (err) {
        console.error('[PM2] Favoritos (minisnap):', err);
        paintFav(!on);
        this._showToast('No se pudo guardar');
      }
    };

    // Feedback de presión: se hunde como botón físico y rebota al soltar
    [ms.querySelector('#wp-ms-fav-btn'), ms.querySelector('#wp-ms-close-btn'), ms.querySelector('#wp-ms-cta-btn')].forEach(b => {
      if (!b) return;
      b.addEventListener('pointerdown', () => { b.style.transform = 'scale(0.88,0.82)'; });
      const up = () => { b.style.transform = ''; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });

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

  show(place, opts = {}) {
    this._fromSearch = false;
    this._place = place;
    // Se usa más abajo para ignorar clics-fantasma que aterrizan sobre
    // contenido recién insertado — ver el comentario largo en el listener
    // de las fotos, en _populate().
    this._shownAt = Date.now();
    this._diagMem('abrir'); // [DIAG] temporal
    // Ver el comentario largo en _populate(): si viene con una foto YA
    // cargada (el flip desde el slide), se usa esa directo, sin el
    // ciclo de skeleton+precarga que se sentía como una recarga.
    this._preloadedHeroBg = opts.preloadedHeroUrl ? `url('${opts.preloadedHeroUrl}')` : null;
    // flipContext.onDismiss(rect, bgImage) se llama desde hide() — es el
    // gancho para que quien abrió esta ficha (MapView, desde el slide)
    // arme el vuelo de vuelta. Sin esto, hide() cierra normal, sin flip.
    this._flipContext = opts.flipContext || null;
    this._populate(place);
    document.body.style.overflow = 'hidden';
    // Activa la sombra superior "oficial" con blur real (ion-app::before,
    // variante body.wp-pm-open en app.css) + el blur del mapa de fondo —
    // mismo mecanismo que usaba PlaceModal1, nunca portado hasta ahora
    document.body.classList.add('wp-pm-open');

    // Ocultar el footer menu del mapview mientras la ficha está abierta
    // (tiene z-index:9995, más alto que el modal, así que quedaba encima)
    const footerMenu = document.getElementById('wp-footer-menu');
    if (footerMenu) footerMenu.style.display = 'none';

    const body        = this._el.querySelector('#wp-pm2-body');
    const spacer      = this._el.querySelector('#wp-pm2-scroll-spacer');
    const heroEl      = this._el.querySelector('#wp-pm2-hero');
    const heroInner   = this._el.querySelector('#wp-pm2-hero-inner');
    const heroBg      = this._el.querySelector('#wp-pm2-hero-bg');
    const heroOverlayFast = this._el.querySelector('#wp-pm2-hero-overlay-fast');
    const topbarFade = this._el.querySelector('#wp-pm2-topbar-fade');
    const heroGradient = this._el.querySelector('#wp-pm2-hero-gradient');
    const topbar      = this._el.querySelector('#wp-pm2-topbar');
    this._activityStack = this._el.querySelector('#wp-pm2-activity-stack');
    if (this._activityStack) { this._activityStack.style.transform = ''; this._activityStack.style.opacity = '1'; }
    const nameEl      = this._el.querySelector('#wp-pm2-hero-bottom');
    const topbarTitle = this._el.querySelector('#wp-pm2-topbar-title');
    const topbarActions = this._el.querySelector('#wp-pm2-topbar-actions');

    // Reset
    this._el.classList.remove('wp-pm2-hero-smooth'); // sin transición mientras se reubica
    heroEl.style.transform = '';
    heroEl.style.height = '';
    heroEl.style.minHeight = '';   // usar el min-height del CSS SOLO para medir fullH
    heroInner.style.height = '';
    heroOverlayFast.style.height = '';
    heroInner.style.transform = '';
    this._heroShift = 0; this._heroStretch = 1;
    heroInner.style.opacity = '';
    heroOverlayFast.style.transform = '';
    heroGradient.style.opacity = '';
    // hide() (si esta ficha se cerró antes con flip) pudo haber dejado
    // heroBg con opacity:0 y transition:none puestos en línea a mano —
    // ver el comentario largo ahí. Sin este reset, una apertura NORMAL
    // posterior (sin flip) heredaría ese hero invisible para siempre.
    heroBg.style.opacity = '';
    heroBg.style.transition = '';
    spacer.style.height = '0px';
    nameEl.style.opacity = '';
    topbar.classList.remove('scrolled');
    topbar.style.boxShadow = '';
    topbarFade.style.opacity = '0.4'; // igual a la base del CSS — ver el comentario largo en la regla #wp-pm2-topbar-fade
    if (topbarTitle) topbarTitle.style.opacity = '0';
    if (topbarActions) { topbarActions.style.opacity = '0'; topbarActions.style.pointerEvents = 'none'; }
    body.scrollTop = 0;

    // ── Modo flip: viene un clon volando desde el slide hasta acá ──────
    // El hero real queda invisible (el clon que vuela lo tapa) hasta que
    // quien llamó a show() confirma que el clon llegó (revealHeroNow()).
    // Sin flip, es el flujo de siempre: se muestra tal cual.
    if (heroBg) heroBg.classList.toggle('wp-pm2-hero-pending', !!opts.flipFromRect);
    this._pendingHeroReveal = !!opts.flipFromRect;

    this._el.classList.add('visible');
    this._el.style.pointerEvents = ''; // (hide() lo apaga durante su salida)
    this._el.classList.remove('wp-pm2-in'); // por si quedó de una apertura anterior sin cerrar bien
    this._el.classList.remove('wp-pm2-flip-exit'); // por si quedó de un cierre anterior — la próxima entrada usa el pulse normal, no la salida deslizada
    // Cuando viene del flip, el card NO hace su propio pop de
    // escala+traslado — ese movimiento ya lo aporta el puente que vuela
    // por fuera (en MapView). Si el card TAMBIÉN escala/traslada al
    // mismo tiempo, son dos cosas moviéndose a la vez compitiendo por la
    // atención — un fade simple deja que el puente sea lo único que se
    // mueve, y el resto de la ficha (header, fondo) solo aparece detrás.
    this._el.classList.toggle('wp-pm2-flip-entry', !!opts.flipFromRect);

    // Transición de entrada del modal completo — backdrop con fade, card
    // con la misma curva que usa el resto de la app. Doble rAF: primero
    // se pinta el estado inicial (opacity:0, definido en la clase base
    // de #wp-pm2-card/#wp-pm2-backdrop), recién en el segundo frame se
    // agrega la clase que dispara la transición — si no, el navegador
    // puede colapsar ambos estados en uno y la entrada no se ve.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._el.classList.add('wp-pm2-in');
      this._coverBehind(true);
    }));

    // El rect destino del hero se puede medir YA — sus dimensiones salen
    // de una regla CSS fija (88vw, clamp 320-460px), no dependen de la
    // foto ni de ningún cálculo posterior. Quien llama con flipFromRect
    // lo necesita ANTES para saber hacia dónde animar su propio clon.
    const heroTargetRect = heroEl.getBoundingClientRect();

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
      // spacer = alto del hero (lo tapa el hero); el aire extra que antes
      // tenía el spacer ahora es padding del sheet blanco, así el blanco
      // arranca justo en el borde del hero y la foto no asoma por ahí
      spacer.style.height = fullH + 'px';
      const sheetEl = this._el.querySelector('#wp-pm2-sheet');
      if (sheetEl) sheetEl.style.paddingTop = (topbarH * 0.5) + 'px';
      heroEl.style.minHeight = '0px';
      heroEl.style.height = fullH + 'px'; // alto fijo: se desplaza con el scroll, no se encoge

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

        // El hero (degradado+título) sube `sy` con el scroll nativo; la foto
        // está fuera del scroll y solo sube el 22% (innerShift). El overlay
        // se queda quieto al llegar a `travel` (compensa lo que sigue
        // subiendo el hero), igual que la versión anterior.
        this._heroShift = innerShift;
        heroInner.style.transform = this._heroPhotoTransform(); // parallax (+ estirado si se está jalando)
        heroOverlayFast.style.transform = sy > travel ? `translate3d(0,${sy - travel}px,0)` : '';
        heroInner.style.opacity   = Math.max(0, 1 - prog);          // la foto se desvanece

        // Overlay (sombra/gradiente) + título/rating: viajan a la MISMA
        // velocidad que el contenido real (shift, 1:1 con el scroll) — no
        // con el parallax lento de la foto. Así llegan junto con el resto
        // del contenido hasta arriba y se disuelven en la sombra del topbar
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

      // Una sola actualización por cuadro (rAF), aunque lleguen varios
      // eventos de scroll entre medio
      let rafPending = false;
      const onScrollRaf = () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => { rafPending = false; onScroll(); });
      };
      if (this._scrollHandler) body.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = onScrollRaf;
      body.addEventListener('scroll', onScrollRaf, { passive: true });
      // Ubicar todo en su posición inicial y RECIÉN después activar la
      // transición de suavizado
      onScroll();
      requestAnimationFrame(() => this._el.classList.add('wp-pm2-hero-smooth'));
    }));

    return heroTargetRect;
  }

  // Revela el hero real después de un show(place, {flipFromRect}) — se
  // llama cuando el clon que "vuela" desde el origen (el slide) termina
  // su animación y llega a destino. Antes de esto el hero real está
  // invisible (wp-pm2-hero-pending), así que no hay un instante con las
  // dos fotos superpuestas ni un salto entre el clon y la foto real.
  revealHeroNow() {
    const heroBg = this._el.querySelector('#wp-pm2-hero-bg');
    if (!heroBg || !this._pendingHeroReveal) return;
    this._pendingHeroReveal = false;
    heroBg.style.transition = 'opacity 0.16s ease-out';
    heroBg.classList.remove('wp-pm2-hero-pending');
    // Limpiar la transición puntual después de que corra, para no dejarla
    // pisando cualquier otra transición propia que #wp-pm2-hero-bg use en
    // el resto del ciclo de vida de la ficha.
    setTimeout(() => { heroBg.style.transition = ''; }, 200);
  }

  // Antes esto era instantáneo (classList.remove('visible') → display:none
  // en el mismo tick). Ahora primero se dispara la transición inversa
  // (quitar wp-pm2-in), y recién cuando termina se saca del DOM
  // (display:none real) — el setTimeout espera esa transición CSS.
  //
  // Si la ficha se abrió desde el slide (_flipContext seteado), este es
  // también el punto donde se avisa a quien la abrió — con el rect
  // ACTUAL del hero (puede estar colapsado si hubo scroll) y su imagen —
  // para que arme el vuelo de vuelta hacia la tarjeta original.
  hide() {
    this._coverBehind(false); // lo de atrás vuelve a verse ANTES del fade de salida
    // Mientras la ficha se desvanece (350ms) ya no debe atrapar toques: el
    // primer toque en lo de atrás (p.ej. "volver" del slide) se perdía.
    this._el.style.pointerEvents = 'none';
    setTimeout(() => this._diagMem('cerrar +1s'), 1000); // [DIAG] temporal
    this._closeLightbox();
    this._closeReactionBar(true);
    ['wp-pm2-review-modal', 'wp-pm2-reply-sheet', 'wp-pm2-menu-sheet'].forEach(id => {
      const n = document.getElementById(id);
      if (n) n.remove();
    });
    if (this._aiAbort) this._aiAbort();

    const flipCtx = this._flipContext;
    this._flipContext = null;
    if (flipCtx) {
      // try/catch a propósito: si algo dentro de onDismiss (código de
      // MapView, fuera de este archivo) tirara una excepción, sin este
      // try TODO lo que sigue en hide() se corta a mitad de camino — la
      // ficha no termina de limpiarse y el slide de atrás tampoco
      // recupera su estado.
      //
      // Ya no hace falta capturar rect/imagen del hero ni ocultarlo por
      // separado — antes eso era para que un puente en MapView pudiera
      // "recibir la posta" y mostrar la misma foto volando de vuelta.
      // Ese puente se sacó (era la parte pesada de la transición): ahora
      // el regreso es un pulse-in casi instantáneo de la tarjeta real en
      // el slide, sin ningún puente ni recreación de forma. El hero de
      // ACÁ simplemente se desvanece como parte del pulse-out de toda
      // la card — ver la regla #wp-pm2.wp-pm2-flip-entry.
      try {
        flipCtx.onDismiss();
      } catch (err) {
        console.error('[PlaceModal2] error en flipContext.onDismiss — el cierre continúa igual', err);
      }
    }

    // Dispara la salida de fade puro (ver la regla CSS
    // #wp-pm2.wp-pm2-flip-exit) — se agrega SIEMPRE, sin importar si la
    // ficha se abrió desde el flip del slide, desde el minicard o desde
    // la búsqueda global, así la salida es la misma en los tres casos.
    this._el.classList.add('wp-pm2-flip-exit');
    this._el.classList.remove('wp-pm2-in');
    document.body.classList.remove('wp-pm-open');
    // Restaurar el footer menu del mapview YA (no depende de la
    // transición, y si se tarda se nota más que si aparece de una)
    const footerMenu = document.getElementById('wp-footer-menu');
    if (footerMenu) footerMenu.style.display = '';

    setTimeout(() => {
      this._el.classList.remove('visible');
      document.body.style.overflow = '';
      this._place = null;
      const body = this._el.querySelector('#wp-pm2-body');
      if (this._scrollHandler) body.removeEventListener('scroll', this._scrollHandler);
      this._scrollHandler = null;
      this._el.querySelector('#wp-pm2-topbar')?.classList.remove('scrolled');
    }, 350);
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

    // Rating del hero — combina Google + comunidad (ver _ratingSummary).
    // Acá todavía no cargaron las reseñas de la comunidad: se pinta con lo
    // de Google y se actualiza solo cuando llegan (_loadCommunityReviews).
    this._communityReviews = [];
    this._googleReviews = [];
    this._renderRatingHero(place);

    // Photos array (used for hero bg + strip)
    const firstPhoto = place.photoUrl || place.photo_url || place.photosUrls?.[0] || null;
    const rawPhotos = place.photosUrls || (firstPhoto ? [firstPhoto] : []);
    const photos = rawPhotos.map(u => this.proxyPhoto(u)).filter(Boolean);

    // Photo strip
    const stripEl = $('wp-pm2-strip');
    this._stripStop?.(); // sin inercia de la ficha anterior, al inicio
    stripEl.innerHTML = '';
    const trackEl = document.createElement('div');
    trackEl.className = 'wp-pm2-strip-track';
    stripEl.appendChild(trackEl);
    const useStack = PlaceModal2.PHOTO_STACK;
    stripEl.style.display = photos.length && !useStack ? '' : 'none';
    const photosHeading = $('wp-pm2-photos-heading');
    if (photosHeading) photosHeading.style.display = photos.length && !useStack ? '' : 'none';
    this._lbPhotos = photos; // para el lightbox
    // Miniaturas: cada foto se carga YA REDUCIDA al tamaño en que se ve
    // (150×210 × densidad de pantalla), no el original de 800×1067. Con
    // los originales la galería ocupaba ~3 MB de memoria gráfica por foto
    // y el WebView de Android, al aparecer una hoja encima, re-dibujaba
    // las fotos con glitch (confirmado en el teléfono: ocultando solo la
    // galería, el glitch desaparecía). El lightbox sigue usando el original.
    this._revokeThumbs();
    const thumbToken = (this._thumbToken = (this._thumbToken || 0) + 1);
    const stripImgs = [];
    (useStack ? [] : photos).forEach((url, i) => {
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async';
      this._skelOn(img);
      img.onload  = () => this._skelOff(img);
      img.onerror = () => this._skelOff(img);
      stripImgs.push([img, url]);
      // Guard contra clic-fantasma: cuando la ficha se abre desde el
      // flip del slide, el toque original (touchend/pointerup) puede
      // generar un "click" sintético del navegador que se dispara un
      // instante después — y como esta grilla de fotos se acaba de
      // insertar EN ESE MISMO momento, si una foto queda posicionada
      // justo donde estaba el dedo, ese click sintético cae sobre ELLA
      // en vez de perderse en el vacío. Ignorar cualquier clic en los
      // primeros 400ms desde que show() arrancó descarta ese caso sin
      // afectar un tap genuino posterior (nadie llega a tocar una foto
      // real en menos de 400ms de que la ficha recién apareció).
      img.addEventListener('click', () => {
        if (Date.now() - (this._shownAt || 0) < 400) return;
        this._openLightbox(i);
      });
      trackEl.appendChild(img);
    });
    this._loadThumbs(stripImgs, thumbToken);

    // Hero background — primera foto con parallax, con skeleton mientras
    // carga. EXCEPCIÓN: si viene de un flip desde el slide
    // (this._preloadedHeroBg, seteado por showFromSlide antes de llamar
    // acá), esa foto YA está cargada y en pantalla — pasar por el
    // skeleton+precarga de nuevo se sentía como "la imagen se recarga",
    // aunque técnicamente sea la misma URL cacheada: el flash del
    // skeleton alcanza a verse igual. Se pisa directo, sin la danza.
    const heroBg = $('wp-pm2-hero-bg');
    if (heroBg) {
      if (this._preloadedHeroBg) {
        heroBg.style.backgroundImage = this._preloadedHeroBg;
        this._skelOff(heroBg);
      } else {
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

    // Revelado suave + brillo en los destellos ✨ mientras aparece
    const showText = (desc) => {
      skelEl.style.display = 'none';
      textEl.style.display = '';
      if (icon) icon.classList.add('wp-pm2-ai-pulse');
      return this._revealText(textEl, desc, null, () => {
        if (icon) icon.classList.remove('wp-pm2-ai-pulse');
      });
    };

    const existing = Array.isArray(place.ai_descriptions) ? place.ai_descriptions : [];
    if (existing.length > 0) {
      const desc = existing[Math.floor(Math.random() * existing.length)];
      const cancel = showText(desc);
      this._aiAbort = () => { cancel(); if (icon) icon.classList.remove('wp-pm2-ai-pulse'); };
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
        cancelTypewrite = showText(data.description);
      })
      .catch(() => { if (!aborted) block.style.display = 'none'; });
  }

  // Revelado suave de la descripción (ver CSS .wp-pm2-ai-reveal).
  // Antes era "máquina de escribir" letra por letra: re-dibujaba la ficha
  // completa decenas de veces por segundo. Devuelve cancel().
  _revealText(el, text, onStart, onDone) {
    el.classList.remove('wp-pm2-ai-reveal');
    el.textContent = text;
    void el.offsetWidth; // reinicia la animación si se reabre la ficha
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      el.classList.remove('wp-pm2-ai-reveal');
      el.removeEventListener('animationend', onEnd);
      clearTimeout(safety);
      if (onDone) onDone();
    };
    const onEnd = (e) => { if (e.animationName === 'wp-pm2-ai-reveal') finish(); };
    el.addEventListener('animationend', onEnd);
    const safety = setTimeout(finish, 1800); // por si animationend no llega
    if (onStart) onStart();
    el.classList.add('wp-pm2-ai-reveal');
    return function cancel() { done = true; clearTimeout(safety); el.removeEventListener('animationend', onEnd); el.classList.remove('wp-pm2-ai-reveal'); };
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
  // Transform de la foto del hero = parallax del scroll + estirado del
  // rebote elástico. Los DOS escriben aquí, así uno nunca borra al otro
  // (antes, si jalabas y a la vez se movía el scroll, el parallax pisaba
  // el estirado: la foto volvía a su tamaño con la ficha todavía abajo
  // → línea dura y hueco blanco bajo el hero).
  _heroPhotoTransform() {
    const shift = this._heroShift || 0, st = this._heroStretch || 1;
    return `translate3d(0,${-shift}px,0)` + (st > 1.0005 ? ` scale(${st.toFixed(4)})` : '');
  }

  // ── Rebote elástico de la ficha (estilo iOS) ───────────────────────
  // Arriba: al jalar hacia abajo la ficha baja con resistencia y la foto
  // del hero se agranda (sin dejar hueco). Abajo: al seguir empujando
  // hacia arriba la ficha sube con resistencia. Al soltar regresa suave.
  // Listeners PASIVOS (no frenan el scroll): en los bordes el scroll
  // nativo ya no se mueve, así que no hay nada que bloquear. El transform
  // solo existe mientras dura el gesto; al terminar se quita.
  _wireElastic(body) {
    if (!body) return;
    const photo = this._el.querySelector('#wp-pm2-hero-inner');
    let lastY = 0, anchor = 0, dir = 0, off = 0, photoH = 1, raf = 0, active = false, x0 = 0, y0 = 0;
    const rubber = (d) => {                     // fórmula de rebote de iOS
      const D = window.innerHeight, a = Math.abs(d);
      return Math.sign(d) * (1 - 1 / ((a * 0.55 / D) + 1)) * D;
    };
    const unrubber = (o) => {                   // inversa: cuánto dedo da ese desplazamiento
      const D = window.innerHeight, r = Math.min(0.95, Math.abs(o) / D);
      return Math.sign(o) * (r / (1 - r)) * D / 0.55;
    };
    const apply = (o) => {
      off = o;
      body.style.transform = o ? `translate3d(0,${o.toFixed(1)}px,0)` : '';
      if (photo && dir === 1) {
        this._heroStretch = o > 0 ? 1 + o / photoH : 1;
        photo.style.transform = this._heroPhotoTransform();
      }
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const finish = () => {
      body.style.transform = '';
      // La foto solo se toca al jalar ARRIBA (ahí su parallax vale 0); abajo
      // su transform es el del parallax y no se debe borrar
      if (photo && dir === 1) {
        this._heroStretch = 1;
        photo.style.transform = this._heroPhotoTransform();
        photo.style.transformOrigin = '';
        // El suavizado del parallax vuelve un cuadro DESPUÉS: si vuelve en
        // el mismo cuadro, el último paso del regreso se animaría (parpadeo)
        requestAnimationFrame(() => { if (!dir) photo.style.transition = ''; });
      }
      off = 0; dir = 0; active = false;
    };
    const springBack = (D = 420) => {
      stop();
      if (!off) { finish(); return; }
      const from = off, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D);
        apply(from * Math.pow(1 - k, 3));       // ease-out, sin rebote extra
        if (k < 1) raf = requestAnimationFrame(step);
        else { raf = 0; finish(); }
      };
      raf = requestAnimationFrame(step);
    };
    body.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || this._lightboxEl?.classList.contains('visible')) return;
      if (e.target.closest?.('#wp-pm2-strip')) return; // la galería tiene su propio arrastre
      lastY = y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
      active = true;
      if (raf && off) {
        // Lo toca mientras regresa: lo "agarra" donde va, sin salto
        stop();
        anchor = lastY - unrubber(off);
      } else { stop(); if (off) finish(); dir = 0; }
    }, { passive: true });
    body.addEventListener('touchmove', (e) => {
      if (!active || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      if (!dir) {
        // Solo gestos claramente verticales (no el swipe de responder)
        if (Math.abs(y - y0) < 4 || Math.abs(y - y0) < Math.abs(e.touches[0].clientX - x0)) { lastY = y; return; }
        const max = body.scrollHeight - body.clientHeight;
        if (body.scrollTop <= 0 && y > lastY) {
          dir = 1; anchor = lastY;
          if (photo) {
            photoH = photo.offsetHeight || 1;
            photo.style.transition = 'none';
            photo.style.transformOrigin = '50% 0';
          }
        } else if (body.scrollTop >= max - 1 && y < lastY) {
          dir = -1; anchor = lastY;
        }
      }
      if (dir) {
        const d = y - anchor;
        if ((dir === 1 && d < 0) || (dir === -1 && d > 0)) { apply(0); finish(); }
        else apply(rubber(d));
      }
      lastY = y;
    }, { passive: true });
    const end = () => { if (!active) return; active = false; if (dir) springBack(); };
    body.addEventListener('touchend', end, { passive: true });
    body.addEventListener('touchcancel', end, { passive: true });
    // Si con la ficha estirada el dedo cambia de sentido, el scroll normal
    // toma el control: el estirado se recoge rápido (sin sumar los dos
    // movimientos ni dejar la foto desfasada)
    body.addEventListener('scroll', () => {
      if (!dir || !off || raf) return;
      const max = body.scrollHeight - body.clientHeight;
      if ((dir === 1 && body.scrollTop > 0) || (dir === -1 && body.scrollTop < max - 1)) {
        active = false;
        springBack(160);
      }
    }, { passive: true });
  }

  // ── Galería: deslizamiento horizontal hecho a mano ─────────────────
  // La franja tiene overflow:hidden (ver CSS). La tira interna se mueve
  // con transform: el dedo la arrastra 1:1 y al soltar sigue por inercia,
  // con rebote suave en los extremos. Un arrastre de más de 6px no cuenta
  // como toque (no abre el lightbox).
  // register=false: otra tira (p. ej. los emojis de colección) que no debe
  // pisar el "stop" de la galería
  _wireStripDrag(strip, { register = true } = {}) {
    if (!strip) return;
    const track = () => strip.firstElementChild;
    let pos = 0;                 // desplazamiento actual (px, >= 0)
    let id = null, x0 = 0, y0 = 0, pos0 = 0, dragging = false, moved = false;
    let samples = [], raf = 0;
    const max = () => {
      const t = track(); if (!t) return 0;
      const cs = getComputedStyle(strip);
      const inner = strip.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return Math.max(0, t.offsetWidth - inner);
    };
    // En movimiento: translate3d + will-change (capa propia, fluido).
    // En reposo: translateX 2D sin will-change → SIN capa propia. Un
    // translate3d en reposo deja la tira como capa aparte y con eso
    // volvía el glitch al abrir hojas (igual que con el scroll nativo).
    let isMoving = false;
    const apply = (x) => {
      const t = track(); if (!t) return;
      t.style.transform = isMoving ? `translate3d(${-x}px,0,0)` : (x ? `translateX(${-x}px)` : '');
    };
    const moving = (on) => {
      isMoving = on;
      track()?.classList.toggle('wp-pm2-moving', on);
      if (!on) apply(Math.round(pos));
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    // Fuera de los límites se mueve a la mitad (resistencia)
    const rubber = (x, m) => x < 0 ? x * 0.35 : x > m ? m + (x - m) * 0.35 : x;
    const stopAll = () => { stop(); pos = 0; moving(false); };
    if (register) this._stripStop = stopAll;

    strip.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (raf) { stop(); pos = Math.min(max(), Math.max(0, pos)); moving(false); } // toque durante la inercia: se detiene ahí
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; pos0 = pos;
      samples = [[e.timeStamp, e.clientX]];
      dragging = false; moved = false;
    });
    strip.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (!dragging) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        dragging = true; moved = true;
        x0 = e.clientX; // sin salto de 6px al arrancar
        moving(true);
        try { strip.setPointerCapture(id); } catch (_) {}
      }
      const m = max();
      pos = rubber(pos0 - (e.clientX - x0), m);
      apply(pos);
      samples.push([e.timeStamp, e.clientX]);
      if (samples.length > 6) samples.shift();
    });
    const end = e => {
      if (e.pointerId !== id) return;
      id = null;
      if (!dragging) return;
      dragging = false;
      // Velocidad con los últimos ~100ms de movimiento (px/ms)
      const now = e.timeStamp;
      const recent = samples.filter(s => now - s[0] < 100);
      let vel = 0;
      if (recent.length >= 2) {
        const a = recent[0], b = recent[recent.length - 1];
        if (b[0] > a[0]) vel = (a[1] - b[1]) / (b[0] - a[0]);
      }
      vel = Math.max(-6, Math.min(6, vel));
      const m = max();
      let t = performance.now();
      const step = (tn) => {
        const dt = Math.min(32, tn - t); t = tn;
        if (pos < 0 || pos > m) {
          // Fuera del límite: vuelve con resorte
          const target = pos < 0 ? 0 : m;
          vel = 0;
          pos += (target - pos) * Math.min(1, dt * 0.018);
          if (Math.abs(target - pos) < 0.5) pos = target;
        } else {
          vel *= Math.pow(0.9975, dt);      // fricción tipo scroll nativo
          pos += vel * dt;
          if (pos < 0 || pos > m) vel *= 0.4; // al chocar con el borde, frena
        }
        apply(pos);
        const settled = Math.abs(vel) < 0.02 && pos >= 0 && pos <= m;
        if (settled) { raf = 0; moving(false); }
        else raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    strip.addEventListener('pointerup', end);
    strip.addEventListener('pointercancel', end);
    // Después de arrastrar, el "click" que sigue no abre la foto
    strip.addEventListener('click', e => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
  }

  // ── Miniaturas de la galería ───────────────────────────────────────
  // Una por una (no 12 originales decodificándose a la vez). Si la foto no
  // permite reducirla (servidor sin CORS) o ya es chica, se usa tal cual.
  async _loadThumbs(list, token) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const queue = list.slice();
    // De 3 en 3: el skeleton de cada foto dura poco y no se decodifican
    // las 12 a la vez
    const worker = async () => {
      while (queue.length) {
        const [img, url] = queue.shift();
        if (token !== this._thumbToken) return; // se abrió otra ficha
        let src = url;
        try { src = await this._makeThumb(url, 150 * dpr, 210 * dpr); } catch (_) { src = url; }
        if (token !== this._thumbToken) { if (src !== url) URL.revokeObjectURL(src); return; }
        if (src !== url) (this._thumbUrls || (this._thumbUrls = [])).push(src);
        img.src = src;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  _makeThumb(url, W, H) {
    return new Promise((resolve) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';  // sin esto el canvas no se puede exportar
      im.decoding = 'async';
      im.onerror = () => resolve(url); // sin CORS → original
      im.onload = () => {
        try {
          const nw = im.naturalWidth, nh = im.naturalHeight;
          const scale = Math.max(W / nw, H / nh);
          if (!nw || !nh || scale >= 0.9) return resolve(url); // ya es chica
          // Recorte centrado tipo object-fit:cover, al tamaño de destino
          const sw = W / scale, sh = H / scale;
          const sx = (nw - sw) / 2, sy = (nh - sh) / 2;
          const c = document.createElement('canvas');
          c.width = Math.round(W); c.height = Math.round(H);
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
          c.toBlob(b => {
            c.width = c.height = 0; // libera el canvas
            resolve(b ? URL.createObjectURL(b) : url);
          }, 'image/jpeg', 0.86);
        } catch (_) { resolve(url); }
      };
      im.src = url;
    });
  }

  _revokeThumbs() {
    (this._thumbUrls || []).forEach(u => URL.revokeObjectURL(u));
    this._thumbUrls = [];
  }

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
    if (PlaceModal2.PHOTO_STACK && (this._lbPhotos || []).length) {
      this._renderPhotoStack(this._lbPhotos);
      return;
    }
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

  // Abanico de fotos (estilo cluster del mapa) en la esquina derecha del
  // hero. Hasta 3 fotos giradas una sobre otra, con el total encima; al
  // tocar abre el visor a pantalla completa. Usa las mismas posiciones,
  // giro y animación de entrada que las tarjetas de actividades, y se
  // encoge con el scroll igual que ellas. Las fotos se cargan reducidas
  // al tamaño de la tarjeta (ver _makeThumb).
  _renderPhotoStack(photos) {
    const stack = this._el.querySelector('#wp-pm2-activity-stack');
    if (!stack) return;
    stack.innerHTML = '';
    // La primera foto ya es el hero: el abanico arranca en la segunda
    // (si solo hay una, se muestra esa)
    const start = photos.length > 1 ? 1 : 0;
    const shown = photos.slice(start, start + 3);
    // La de hasta arriba (la primera) queda al frente
    const ROT = ['8deg', '-6deg', '-15deg'];
    const OFFSET = [
      { tx: '-4px', ty: '0px' },
      { tx: '2px',  ty: '-5px' },
      { tx: '7px',  ty: '4px' },
    ];
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const token = this._thumbToken;
    shown.forEach((url, i) => {
      const card = document.createElement('div');
      card.className = 'wp-pm2-activity-card wp-pm2-photo-card';
      card.style.setProperty('--rot', ROT[i]);
      card.style.setProperty('--tx', OFFSET[i].tx);
      card.style.setProperty('--ty', OFFSET[i].ty);
      card.style.setProperty('--delay', ((shown.length - 1 - i) * 0.08) + 's');
      card.style.zIndex = String(shown.length - i);
      if (i === 0 && photos.length > 1) {
        card.innerHTML = `<span class="wp-pm2-photo-count">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>
          ${photos.length}</span>`;
      }
      card.addEventListener('click', () => {
        if (Date.now() - (this._shownAt || 0) < 400) return; // clic fantasma al abrir
        this._haptic('light');
        this._openLightbox(start + i);
      });
      stack.appendChild(card);
      // Foto reducida al tamaño de la tarjeta (92×118)
      this._makeThumb(url, 92 * dpr, 118 * dpr).then(src => {
        if (token !== this._thumbToken || !card.isConnected) { if (src !== url) URL.revokeObjectURL(src); return; }
        if (src !== url) (this._thumbUrls || (this._thumbUrls = [])).push(src);
        card.style.backgroundImage = `url("${src}")`;
        card.classList.add('wp-pm2-photo-ready');
      }).catch(() => { card.style.backgroundImage = `url("${url}")`; });
    });
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

    this._googleReviews = reviews;
    this._communityReviews = [];
    this._reviewTab = null; // null = todavía no eligió el usuario → automático
    this._renderReviewsSummary(place);
    this._reviewCards = new Map();
    this._social = { util: new Map(), emoji: new Map(), replies: new Map() };
    this._buildReviewsHeader(place);
    this._renderGooglePanel(place);
    this._mod = { hidden: new Set(), myReports: new Set(), blocked: new Set() };
    this._reviewsGate = this._makeReviewsGate(place); // dibujar reseñas al acercarse
    this._modPromise = this._loadModeration(place); // reportes/bloqueos
    this._loadCommunityReviews(place); // async, comunidad (espera a _modPromise)
    this._loadReviewSocial(place);     // async, reacciones + respuestas
    this._loadMyClaim(place);          // async, "¿Es tu negocio?"
    this._loadFavorite(place);         // async, favoritos (botón + pill del hero)
  }

  // ── Calificación combinada (Google + comunidad) ──────────────────
  // total  = reseñas de Google (el total real de Google, no solo las 5
  //          guardadas) + reseñas de la comunidad
  // rating = promedio ponderado: en un lugar con 1.000 reseñas de Google
  //          las de la app casi no lo mueven; en uno chico sí pesan.
  // isNew  = sin Google y con menos de 3 reseñas de la comunidad → se
  //          muestra "Nuevo" en vez de un 5.0 con una sola reseña.
  _ratingSummary(place) {
    const gCount  = place.userRatingCount || place.user_ratings_total || (this._googleReviews || []).length || 0;
    const gRating = parseFloat(place.rating) || 0;
    const wp      = (this._communityReviews || []).filter(r => r.rating > 0);
    const wpSum   = wp.reduce((a, r) => a + Number(r.rating), 0);
    // Rating de Google sin cantidad conocida: cuenta como 1 para promediar
    const gWeight = gRating ? Math.max(gCount, 1) : 0;
    const weight  = gWeight + wp.length;
    const rating  = weight ? (gRating * gWeight + wpSum) / weight : 0;
    const total   = gCount + wp.length;
    const isNew   = !gRating && wp.length < 3;
    return { rating, total, gCount, wpCount: wp.length, isNew };
  }

  _renderRatingHero(place) {
    const el = this._el.querySelector('#wp-pm2-rating-hero');
    if (!el) return;
    const { rating, total, isNew } = this._ratingSummary(place);
    if (isNew) el.textContent = '✨ Nuevo';
    else el.textContent = rating ? '⭐ ' + rating.toFixed(1) + (total ? ` (${total})` : '') : '';
  }

  // Facepile (3 avatares + "+N") y "(N reseñas)" — comunidad primero
  _renderReviewsSummary(place) {
    const summaryEl = this._el.querySelector('#wp-pm2-reviews-summary');
    const avatarsEl = this._el.querySelector('#wp-pm2-reviews-avatars');
    const countEl   = this._el.querySelector('#wp-pm2-reviews-count');
    if (!summaryEl) return;
    const { total } = this._ratingSummary(place);
    const names = [
      ...(this._communityReviews || []).map(r => r.display_name || 'user'),
      ...(this._googleReviews || []).map(r => r.author_name || 'user'),
    ];
    // La fila siempre se ve: ahí vive el botón de favoritos. Sin reseñas
    // solo se ocultan los avatares y el contador.
    summaryEl.style.display = '';
    if (!total || !names.length) {
      avatarsEl.innerHTML = ''; avatarsEl.style.display = 'none';
      countEl.textContent = ''; countEl.style.display = 'none';
      return;
    }
    avatarsEl.style.display = ''; countEl.style.display = '';
    avatarsEl.innerHTML = '';
    const shown = names.slice(0, 3);
    shown.forEach((n, i) => {
      const av = document.createElement('img');
      av.className = 'wp-pm2-fp-avatar';
      av.style.zIndex = shown.length - i; // el primero queda arriba
      this._skelOn(av);
      av.onload  = () => this._skelOff(av);
      av.onerror = () => { this._skelOff(av); av.style.background = '#e2e8f0'; };
      av.src = getAvatarUrl(n);
      avatarsEl.appendChild(av);
    });
    const remaining = Math.max(0, total - shown.length);
    if (remaining > 0) {
      const more = document.createElement('div');
      more.className = 'wp-pm2-fp-more';
      more.textContent = '+' + (remaining > 99 ? '99' : remaining);
      more.style.zIndex = 0;
      avatarsEl.appendChild(more);
    }
    countEl.textContent = `(${total} ${total === 1 ? 'reseña' : 'reseñas'})`;
    summaryEl.style.display = '';
  }

  // Header con "Reseñas" + tabs (Comunidad / Google) + pill "Añadir reseña".
  // Pestaña por defecto: Comunidad si tiene reseñas, si no Google. Si el
  // usuario ya tocó una pestaña, se respeta (this._reviewTab).
  // La pestaña Google se oculta si el lugar no tiene reseñas de Google.
  _buildReviewsHeader(place) {
    const headerRow = this._el.querySelector('#wpr-header-row');
    if (!headerRow) return;
    const gCount = (this._googleReviews || []).length;
    const cCount = (this._communityReviews || []).length;

    let active = this._reviewTab || (cCount > 0 || gCount === 0 ? 'community' : 'google');
    if (active === 'google' && gCount === 0) active = 'community';

    headerRow.innerHTML = `
      <span class="wp-pm2-reviews-title-text">Reseñas</span>
      <div class="wpr-header-tabs-row">
        <button class="wpr-tab${active === 'community' ? ' wpr-tab-active' : ''}" data-tab="community">Comunidad <span class="wpr-tab-count">${cCount}</span></button>
        ${gCount ? `<button class="wpr-tab${active === 'google' ? ' wpr-tab-active' : ''}" data-tab="google">Google <span class="wpr-tab-count">${gCount}</span></button>` : ''}
        <button class="wpr-tab wpr-tab-add" id="wpr-add-btn">✦ Añadir reseña</button>
      </div>
    `;
    this._applyReviewTab(active);

    headerRow.querySelectorAll('.wpr-tab[data-tab]').forEach(tab => {
      tab.onclick = () => {
        this._reviewTab = tab.dataset.tab;
        headerRow.querySelectorAll('.wpr-tab[data-tab]').forEach(t => t.classList.remove('wpr-tab-active'));
        tab.classList.add('wpr-tab-active');
        this._applyReviewTab(tab.dataset.tab);
      };
    });
    const addBtn = headerRow.querySelector('#wpr-add-btn');
    if (addBtn) addBtn.onclick = () => this._pulseTap(addBtn, () => this._openReviewModal());
  }

  _applyReviewTab(tab) {
    this._el.querySelector('#wpr-panel-google').style.display    = tab === 'google'    ? '' : 'none';
    this._el.querySelector('#wpr-panel-community').style.display = tab === 'community' ? '' : 'none';
  }

  // Construye una tarjeta de reseña (misma estructura para Google y
  // WhatsPlan, solo cambian los datos de entrada)
  // ctx (opcional): { key, source:'google'|'wp', author, text, ownerId }
  // — activa Útil / reacciones / respuestas en la tarjeta.
  _buildReviewCard(name, rating, text, timeLabel, photoSeed, ctx = null) {
    const row = document.createElement('div');
    row.className = 'wp-pm2-review-row';
    const stars = rating ? '⭐'.repeat(Math.round(rating)) : '';
    // _esc: nombre y texto los escriben usuarios — sin escapar, una
    // reseña con "<img onerror=...>" se ejecutaba como HTML.
    row.innerHTML = `
      ${ctx ? `<button class="wp-pm2-rv-more" aria-label="Más opciones"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button>` : ''}
      <img class="wp-pm2-review-avatar">
      <div class="wp-pm2-review-body">
        <div class="wp-pm2-review-name">${this._esc(name)}</div>
        ${stars ? `<div class="wp-pm2-review-stars">${stars}</div>` : ''}
        <div class="wp-pm2-review-text">${this._esc(text || '')}</div>
        <button class="wp-pm2-review-more">Ver más</button>
        ${timeLabel ? `<div class="wp-pm2-review-time">${this._esc(timeLabel)}</div>` : ''}
        ${ctx ? `<div class="wp-pm2-rv-chips"></div>
        <div class="wp-pm2-rv-actions"></div>
        <div class="wp-pm2-rv-replies"></div>` : ''}
      </div>`;
    if (ctx) {
      if (!this._reviewCards) this._reviewCards = new Map();
      // Conserva el hilo abierto/cerrado si la tarjeta se vuelve a crear
      const prevCard = this._reviewCards.get(ctx.key);
      this._reviewCards.set(ctx.key, { row, ctx, repliesOpen: prevCard ? prevCard.repliesOpen : false });
      row.querySelector('.wp-pm2-rv-more').onclick = (e) => {
        e.stopPropagation();
        this._openItemMenu('review', ctx.key);
      };
      this._applyUnderReview(ctx.key, row.querySelector('.wp-pm2-review-name'), row.querySelector('.wp-pm2-review-text'));
      this._applyOwnerBadge(row.querySelector('.wp-pm2-review-name'), ctx.ownerId);
      this._wireReviewGestures(row, ctx.key);
      this._renderReviewSocial(ctx.key);
    }

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
    const gPid = place.place_id || place.id;
    reviews.slice(0, 5).forEach(r => {
      panel.appendChild(this._buildReviewCard(
        r.author_name || 'Usuario de Google',
        r.rating, r.text, r.relative_time,
        getAvatarUrl(r.author_name || 'user'),
        gPid ? {
          key: this._googleReviewKey(gPid, r),
          source: 'google',
          author: r.author_name || 'Usuario de Google',
          text: r.text || '',
        } : null
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

  // Pulse al tocar (se hunde y rebota) + acción con un pequeño retraso
  // para que el rebote se vea antes de que la hoja tape la pantalla.
  // wide=true → pulse más suave, para elementos anchos como el campo
  // "Escribe una reseña" (el mismo % de escala en algo ancho se nota
  // mucho más).
  _pulseTap(el, action, wide = false) {
    this._haptic('light');
    if (el.closest('#wp-pm2-body')) {
      // Dentro del scroll: el mismo rebote, hecho por JS (sin capas)
      this._scaleKeys(el, wide ? [1, 0.97, 1.015, 1] : [1, 0.92, 1.04, 1], 340);
      if (this._pulseActionTimer) clearTimeout(this._pulseActionTimer);
      this._pulseActionTimer = setTimeout(() => { this._pulseActionTimer = null; action(); }, 150);
      return;
    }
    const cls = wide ? 'wp-pm2-tap-pulse-wide' : 'wp-pm2-tap-pulse';
    el.classList.remove(cls);
    void el.offsetWidth; // reinicia la animación si se toca dos veces seguidas
    el.classList.add(cls);
    el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    if (this._pulseActionTimer) clearTimeout(this._pulseActionTimer);
    this._pulseActionTimer = setTimeout(() => { this._pulseActionTimer = null; action(); }, 150);
  }

  // ── Vibración (Capacitor Haptics; si no, navigator.vibrate) ─────────
  // light: toques (útil, reacción, estrellas, abrir) · medium: long-press
  // success / warning / error: resultado de una acción
  _haptic(kind = 'light') {
    const H = this._nativePlugin('Haptics');
    try {
      if (H) {
        if (kind === 'success' || kind === 'warning' || kind === 'error') {
          H.notification({ type: kind.toUpperCase() });
        } else {
          H.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });
        }
        return;
      }
      const ms = { light: 8, medium: 14, success: [10, 40, 10], warning: 20, error: [20, 40, 20] }[kind] || 8;
      navigator.vibrate?.(ms);
    } catch (_) {}
  }

  // ── Pulse sin capas ────────────────────────────────────────────────
  // Escala por puntos clave [1, 0.92, 1.04, 1] repartidos en `dur` ms,
  // escribiendo transform:scale() 2D en cada cuadro. Sin transición ni
  // animación CSS → el teléfono no crea capa: solo re-dibuja el elemento.
  _scaleKeys(el, keys, dur) {
    if (!el) return;
    if (el.__wpScaleRaf) cancelAnimationFrame(el.__wpScaleRaf);
    const seg = keys.length - 1, t0 = performance.now();
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const step = (now) => {
      if (el.__wpSwiping) { el.__wpScaleRaf = 0; return; } // el swipe manda
      const k = Math.min(1, (now - t0) / dur);
      const pos = k * seg, i = Math.min(seg - 1, Math.floor(pos));
      const v = keys[i] + (keys[i + 1] - keys[i]) * ease(pos - i);
      el.style.transform = k >= 1 && keys[seg] === 1 ? '' : `scale(${v.toFixed(4)})`;
      el.__wpScale = v;
      el.__wpScaleRaf = k < 1 ? requestAnimationFrame(step) : 0;
    };
    el.__wpScaleRaf = requestAnimationFrame(step);
  }
  _scaleTo(el, to, dur) { this._scaleKeys(el, [el.__wpScale || 1, to], dur); }

  // Squish al presionar los botones de las reseñas (chips, Útil,
  // Responder, ⋯, "Toca para ver"): se hunde al apoyar y rebota al soltar.
  _wirePressSquish(root) {
    const SEL = '.wp-pm2-rv-chip, .wp-pm2-rv-btn, .wp-pm2-rv-more, .wp-pm2-rv-reveal, .wp-pm2-rv-reply-del';
    let cur = null;
    const up = () => {
      if (!cur) return;
      const el = cur; cur = null;
      this._scaleKeys(el, [el.__wpScale || 0.9, 1.05, 1], 260);
    };
    root.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(SEL);
      if (!el || !root.contains(el)) return;
      cur = el;
      this._scaleTo(el, 0.88, 90);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => root.addEventListener(ev, up));
    root.addEventListener('pointermove', (e) => {
      if (cur && !cur.contains(document.elementFromPoint(e.clientX, e.clientY))) up();
    }, { passive: true });
  }

  // Toast simple — por encima de la ficha (z-index 1500000).
  // La vibración va según el mensaje: ✓/gracias = éxito, "No se pudo" = error.
  // action: { label, onClick } → botón dentro del aviso (p. ej. "Deshacer");
  // con acción el aviso dura más y sí recibe toques.
  _showToast(msg, action = null) {
    if (/^(✓|Recibimos|Gracias|Reseña eliminada|Reporte retirado)|bloqueado$/.test(msg)) this._haptic('success');
    else if (/^(No se pudo|Error)/.test(msg)) this._haptic('error');
    else if (/copiado/i.test(msg)) this._haptic('light');
    const prev = document.getElementById('wp-pm2-toast');
    if (prev) prev.remove();
    const t = document.createElement('div');
    t.id = 'wp-pm2-toast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top,0px));transform:translateX(-50%) translateY(-20px);z-index:1500300;background:rgba(10,10,10,0.88);color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:999px;font-family:var(--wp-font);opacity:0;transition:opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.4,0.64,1);pointer-events:none;white-space:nowrap;display:flex;align-items:center;gap:12px';
    const hide = () => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 250);
    };
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.style.cssText = 'border:none;background:rgba(255,255,255,0.18);color:#fff;font-size:12.5px;font-weight:800;font-family:var(--wp-font);padding:5px 11px;border-radius:999px;cursor:pointer;-webkit-tap-highlight-color:transparent';
      b.onclick = (e) => { e.stopPropagation(); clearTimeout(timer); hide(); action.onClick?.(); };
      t.appendChild(b);
      t.style.pointerEvents = 'auto';
      t.style.padding = '7px 8px 7px 18px';
    }
    document.body.appendChild(t);
    void t.offsetHeight;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    const timer = setTimeout(hide, action ? 4000 : 2200);
  }

  // Popup de reseña — mismo flujo que _openReviewModal de PlaceModal.js
  // (estrellas + textarea + publicar vía ReviewService.upsert), con
  // z-index por encima de la ficha fullscreen (#wp-pm2 = 1500000).
  async _openReviewModal() {
    const place = this._place;
    if (!place) return;
    const user = this.getCurrentUser?.();
    if (!user) { this._showToast('Inicia sesión para dejar una reseña'); return; }

    const prevModal = document.getElementById('wp-pm2-review-modal');
    if (prevModal) prevModal.remove();

    const displayName = user.user_metadata?.display_name
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || 'Usuario';
    const avatarUrl = user.user_metadata?.avatar_url || getAvatarUrl(displayName);

    const frag = document.createElement('div');
    frag.id = 'wp-pm2-review-modal';
    frag.innerHTML = `
      <div id="wp-pm2-rm-overlay" style="position:fixed;inset:0;z-index:1500100;background:rgba(0,0,0,0.3);opacity:0;transition:none"></div>
      <div id="wp-pm2-rm-menu" style="position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:1500200;background:#fff;border-radius:24px;padding:8px 0 4px;box-shadow:0 8px 40px rgba(0,0,0,0.18);transform:translateY(110%);transition:none;font-family:var(--wp-font)">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.15);margin:0 auto 8px"></div>
        <div id="wp-pm2-rm-header" style="display:flex;align-items:center;gap:10px;padding:4px 20px 12px">
          <img src="${avatarUrl}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0">
          <div style="min-width:0">
            <span style="display:block;font-size:16px;font-weight:700;color:#0a0a0a">Tu reseña</span>
            <span style="display:block;font-size:12px;color:#8e8e93;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(place.name || 'Comparte tu experiencia').replace(/</g,'&lt;')}</span>
          </div>
        </div>
        <div id="wp-pm2-rm-stars" style="display:flex;justify-content:center;gap:8px;padding:4px 0 4px">
          ${[1,2,3,4,5].map(v => `<span class="wp-pm2-rm-star" data-v="${v}" style="font-size:36px;line-height:1;cursor:pointer;color:#d1d5db;transition:transform 0.15s, color 0.15s;-webkit-tap-highlight-color:transparent">★</span>`).join('')}
        </div>
        <div id="wp-pm2-rm-label" style="text-align:center;font-size:12px;color:#8e8e93;margin-bottom:12px">Toca para calificar</div>
        <div style="padding:0 16px">
          <textarea id="wp-pm2-rm-textarea" maxlength="500" placeholder="Cuéntanos tu experiencia... (mínimo 10 caracteres)" style="width:100%;height:100px;border-radius:14px;border:1px solid rgba(0,0,0,0.10);background:#f9f9f9;padding:12px 14px;font-size:14px;font-family:var(--wp-font);color:#0a0a0a;resize:none;box-sizing:border-box;outline:none"></textarea>
          <div id="wp-pm2-rm-char" style="text-align:right;font-size:11px;color:#8e8e93;margin-top:4px">0 / 500</div>
        </div>
        <div style="padding:12px 16px 16px">
          <button id="wp-pm2-rm-submit" disabled style="width:100%;height:46px;border-radius:999px;border:none;background:#0a0a0a;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--wp-font);opacity:0.4;transition:opacity 0.15s, transform 0.15s;-webkit-tap-highlight-color:transparent">Publicar reseña</button>
        </div>
      </div>`;
    document.body.appendChild(frag);

    const overlay  = frag.querySelector('#wp-pm2-rm-overlay');
    const menu     = frag.querySelector('#wp-pm2-rm-menu');
    const starsEl  = frag.querySelector('#wp-pm2-rm-stars');
    const labelEl  = frag.querySelector('#wp-pm2-rm-label');
    const textarea = frag.querySelector('#wp-pm2-rm-textarea');
    const charEl   = frag.querySelector('#wp-pm2-rm-char');
    const submit   = frag.querySelector('#wp-pm2-rm-submit');
    const rmHeader = frag.querySelector('#wp-pm2-rm-header');

    const LABELS = ['', 'Muy malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];
    let rating = 0;

    const refreshSubmit = () => {
      const ok = rating > 0 && textarea.value.trim().length >= 10;
      submit.disabled = !ok;
      submit.style.opacity = ok ? '1' : '0.4';
    };
    const updateStars = (v) => {
      rating = v;
      starsEl.querySelectorAll('.wp-pm2-rm-star').forEach((s, i) => {
        s.style.color     = i < v ? '#f59e0b' : '#d1d5db';
        s.style.transform = i < v ? 'scale(1.1)' : 'scale(1)';
      });
      labelEl.textContent = LABELS[v] || 'Toca para calificar';
      refreshSubmit();
    };
    starsEl.querySelectorAll('.wp-pm2-rm-star').forEach(s => {
      s.onclick = () => { this._haptic('light'); updateStars(parseInt(s.dataset.v, 10)); };
    });
    textarea.oninput = () => {
      charEl.textContent = textarea.value.length + ' / 500';
      refreshSubmit();
    };

    const closeModal = () => {
      textarea.blur();
      const wait = this._sheetOut(menu, overlay);
      setTimeout(() => frag.remove(), wait);
    };
    overlay.onclick = closeModal;

    // Abrir con reflow forzado para que la transición dispare
    this._sheetIn(menu, overlay);

    // Si ya dejó reseña antes, se precarga para editarla
    const placeId = place.place_id || place.id || place.placeId;
    try {
      const existing = await ReviewService.getUserReview(placeId, user.id);
      if (existing && document.body.contains(frag)) {
        textarea.value = existing.text || '';
        charEl.textContent = textarea.value.length + ' / 500';
        updateStars(existing.rating || 0);
        submit.textContent = 'Actualizar reseña';
      }
    } catch (_) {}

    submit.onclick = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      submit.textContent = 'Publicando...';
      try {
        if (!placeId) throw new Error('ID del lugar no encontrado');
        await ReviewService.upsert(String(placeId), user.id, rating, textarea.value.trim(), displayName, user.user_metadata?.avatar_url || null);
        closeModal();
        this._showToast('✓ Reseña publicada');
        // Refresca el tab WhatsPlan y lo deja activo para ver la reseña
        await this._loadCommunityReviews(place);
        const headerRow = this._el.querySelector('#wpr-header-row');
        const wpTab = headerRow?.querySelector('.wpr-tab[data-tab="community"]');
        if (wpTab) wpTab.click();
      } catch (err) {
        console.error('[PM2] Error al publicar reseña:', err);
        this._showToast(err.message || 'Error al publicar');
        submit.disabled = false;
        submit.textContent = 'Publicar reseña';
      }
    };

    // Arrastrar el header hacia abajo para cerrar
    let sy = 0, dy = 0, dragging = false;
    rmHeader.addEventListener('touchstart', e => {
      sy = e.touches[0].clientY; dy = 0; dragging = true;
      menu.style.transition = 'none';
    }, { passive: true });
    rmHeader.addEventListener('touchmove', e => {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - sy);
      menu.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    rmHeader.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      menu.style.transition = 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)';
      if (dy > 80) closeModal();
      else menu.style.transform = 'translateY(0)';
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // REACCIONES Y RESPUESTAS A RESEÑAS
  //  - Útil: botón fijo en todas las reseñas (Google y WhatsPlan)
  //  - Emoji (long-press): reseñas de WhatsPlan y sus respuestas
  //  - Responder (botón o swipe a la derecha): reseñas de WhatsPlan y
  //    sus respuestas. Todo queda en UN hilo por reseña; responder a una
  //    respuesta agrega "@Nombre" y muestra "↳ Nombre", sin anidar.
  // Claves (review_key): 'wp:<id>' reseña, 'g:<pid>:<hash>' Google,
  //                      'r:<id>' respuesta (solo para emojis).
  // Estado en this._social:
  //   util:    Map(key → Set(userId))
  //   emoji:   Map(key → Map(userId → type))
  //   replies: Map(key de la reseña → [filas de review_replies])
  // ══════════════════════════════════════════════════════════════════

  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _timeAgo(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!t) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60)        return 'ahora';
    if (s < 3600)      return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400)     return `hace ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Las reseñas de Google no traen id: se arma uno estable con el autor +
  // la fecha (time, unix) — o el inicio del texto si no hay fecha.
  _googleReviewKey(placeId, r) {
    const base = (r.author_name || '') + '|' + (r.time || (r.text || '').slice(0, 60));
    let h = 5381;
    for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i)) >>> 0;
    return `g:${placeId}:${h.toString(36)}`;
  }

  // EXPERIMENTO: las fotos van en abanico (estilo cluster) en la esquina
  // derecha del hero, en lugar de las tarjetas de actividades, y se quita
  // la sección "Fotos". false = vuelve todo como estaba.
  static get PHOTO_STACK() { return true; }

  static get REACTIONS() {
    return [
      { type: 'love', emoji: '😍' },
      { type: 'haha', emoji: '😂' },
      { type: 'wow',  emoji: '😮' },
      { type: 'fire', emoji: '🔥' },
      { type: 'hmm',  emoji: '🤔' },
    ];
  }

  async _loadReviewSocial(place) {
    const pid = place.place_id || place.id;
    if (!pid) return;
    let data;
    try {
      data = await ReviewService.getSocialForPlace(pid);
    } catch (e) {
      // Si faltan las tablas/columnas (no se corrió el SQL) la ficha
      // sigue funcionando, solo sin conteos ni respuestas.
      console.warn('[PM2] Reacciones/respuestas no disponibles:', e.message || e);
      return;
    }
    try { await this._modPromise; } catch (_) {}
    try { await this._reviewsGate; } catch (_) {} // dibujar junto con las tarjetas
    if (this._place !== place) return; // se abrió otra ficha mientras cargaba
    const social = { util: new Map(), emoji: new Map(), replies: new Map() };
    (data.reactions || []).forEach(r => {
      if (r.type === 'util') {
        if (!social.util.has(r.review_key)) social.util.set(r.review_key, new Set());
        social.util.get(r.review_key).add(r.user_id);
      } else {
        if (!social.emoji.has(r.review_key)) social.emoji.set(r.review_key, new Map());
        social.emoji.get(r.review_key).set(r.user_id, r.type);
      }
    });
    (data.replies || []).forEach(r => {
      if (!social.replies.has(r.review_key)) social.replies.set(r.review_key, []);
      social.replies.get(r.review_key).push(r);
    });
    this._social = social;
    (this._reviewCards || new Map()).forEach((_, key) => this._renderReviewSocial(key));
  }

  // Chips de emoji (😍 4  😂 1) para una reseña o una respuesta.
  // reactKey: de quién son las reacciones · renderKey: qué tarjeta se
  // redibuja al cambiar (la reseña que contiene todo el hilo).
  _renderEmojiChips(container, reactKey, renderKey, pop) {
    container.innerHTML = '';
    const uid = this.getCurrentUser?.()?.id || null;
    const em = this._social.emoji.get(reactKey) || new Map();
    const mine = uid ? em.get(uid) : null;
    PlaceModal2.REACTIONS.forEach(({ type, emoji }) => {
      let n = 0;
      em.forEach((t, u) => { if (t === type && !this._isBlockedUser(u)) n++; });
      if (!n) return;
      const chip = document.createElement('button');
      chip.className = 'wp-pm2-rv-chip' + (mine === type ? ' wp-pm2-mine' : '')
        + (pop === `emoji:${reactKey}:${type}` ? ' wp-pm2-rv-pop' : '');
      chip.innerHTML = `<span class="wp-pm2-emoji">${emoji}</span>${n}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        this._setEmoji(reactKey, mine === type ? null : type, renderKey);
      };
      container.appendChild(chip);
      if (chip.classList.contains('wp-pm2-rv-pop')) this._scaleKeys(chip, [0.7, 1.12, 1], 320);
    });
  }

  // Dibuja chips + Útil/Responder + hilo de respuestas de UNA reseña.
  _renderReviewSocial(key, pop = null) {
    const card = this._reviewCards?.get(key);
    if (!card) return;
    const { row, ctx } = card;
    const uid = this.getCurrentUser?.()?.id || null;
    const isWp = ctx.source === 'wp';

    // ── Chips de emoji de la reseña ──
    const chipsEl = row.querySelector('.wp-pm2-review-body > .wp-pm2-rv-chips');
    if (isWp) this._renderEmojiChips(chipsEl, key, key, pop);
    else chipsEl.innerHTML = '';

    // ── Útil / Responder ──
    const actionsEl = row.querySelector('.wp-pm2-rv-actions');
    const utilSet = this._social.util.get(key) || new Set();
    const utilOn = !!(uid && utilSet.has(uid));
    let utilCount = 0;
    utilSet.forEach(u => { if (!this._isBlockedUser(u)) utilCount++; });
    actionsEl.innerHTML = `
      <button class="wp-pm2-rv-btn wp-pm2-rv-util${utilOn ? ' wp-pm2-on' : ''}${pop === 'util:' + key ? ' wp-pm2-rv-pop' : ''}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${utilOn ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
        Útil${utilCount ? ' · ' + utilCount : ''}
      </button>
      ${isWp ? `<button class="wp-pm2-rv-btn wp-pm2-rv-reply-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        Responder
      </button>` : ''}`;
    const utilBtn = actionsEl.querySelector('.wp-pm2-rv-util');
    if (utilBtn.classList.contains('wp-pm2-rv-pop')) this._scaleKeys(utilBtn, [0.85, 1.08, 1], 300);
    actionsEl.querySelector('.wp-pm2-rv-util').onclick = (e) => {
      e.stopPropagation();
      this._toggleUseful(key);
    };
    const replyBtn = actionsEl.querySelector('.wp-pm2-rv-reply-btn');
    if (replyBtn) replyBtn.onclick = (e) => { e.stopPropagation(); this._openReplySheet(key); };

    // ── Hilo de respuestas ──
    const repliesEl = row.querySelector('.wp-pm2-rv-replies');
    repliesEl.innerHTML = '';
    const replies = (this._social.replies.get(key) || [])
      .filter(r => this._isVisible('r:' + r.id, r.user_id));
    if (!isWp || !replies.length) return;
    const toggle = document.createElement('button');
    toggle.className = 'wp-pm2-rv-toggle';
    toggle.textContent = card.repliesOpen
      ? 'Ocultar respuestas'
      : `Ver ${replies.length} ${replies.length === 1 ? 'respuesta' : 'respuestas'}`;
    toggle.onclick = (e) => {
      e.stopPropagation();
      card.repliesOpen = !card.repliesOpen;
      this._renderReviewSocial(key);
    };
    repliesEl.appendChild(toggle);
    if (!card.repliesOpen) return;
    replies.forEach(r => repliesEl.appendChild(this._buildReplyItem(key, r, pop)));
  }

  // Una respuesta del hilo: nombre (+ "↳ a quién"), texto con la @mención
  // resaltada, chips de emoji y la fila "hace 2 h · Responder · Eliminar".
  _buildReplyItem(parentKey, r, pop) {
    const uid = this.getCurrentUser?.()?.id || null;
    const rKey = 'r:' + r.id;
    const name = r.display_name || 'Usuario';
    const target = { id: r.id, name, text: r.text || '' };

    let textHtml = this._esc(r.text);
    if (r.reply_to_name) {
      const mention = '@' + r.reply_to_name;
      if ((r.text || '').startsWith(mention)) {
        textHtml = `<span class="wp-pm2-rv-mention">${this._esc(mention)}</span>`
          + this._esc(r.text.slice(mention.length));
      }
    }

    const item = document.createElement('div');
    item.className = 'wp-pm2-rv-reply';
    item.innerHTML = `
      <button class="wp-pm2-rv-more wp-pm2-rv-more-sm" aria-label="Más opciones"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg></button>
      <img alt="">
      <div class="wp-pm2-rv-reply-body">
        <div class="wp-pm2-rv-reply-name">${this._esc(name)}${r.reply_to_name ? `<span class="wp-pm2-rv-reply-to">↳ ${this._esc(r.reply_to_name)}</span>` : ''}</div>
        <div class="wp-pm2-rv-reply-text">${textHtml}</div>
        <div class="wp-pm2-rv-chips wp-pm2-rv-chips-sm"></div>
        <div class="wp-pm2-rv-reply-meta">
          <span>${this._esc(this._timeAgo(r.created_at))}${r.edited_at ? ' · editado' : ''}</span>
          <button class="wp-pm2-rv-reply-act">Responder</button>
        </div>
      </div>`;
    item.querySelector('img').src = r.avatar_url || getAvatarUrl(name);
    this._renderEmojiChips(item.querySelector('.wp-pm2-rv-chips'), rKey, parentKey, pop);

    item.querySelector('.wp-pm2-rv-reply-act').onclick = (e) => {
      e.stopPropagation();
      this._openReplySheet(parentKey, target);
    };
    item.querySelector('.wp-pm2-rv-more').onclick = (e) => {
      e.stopPropagation();
      this._openItemMenu('reply', parentKey, r);
    };
    this._applyUnderReview(rKey, item.querySelector('.wp-pm2-rv-reply-name'), item.querySelector('.wp-pm2-rv-reply-text'));
    this._applyOwnerBadge(item.querySelector('.wp-pm2-rv-reply-name'), r.user_id);

    this._addSwipeIcon(item);
    this._wireLongPress(item, () => this._openReactionBar(rKey, item, parentKey));
    this._wireSwipeReply(item, () => this._openReplySheet(parentKey, target));
    return item;
  }

  _requireUser(msg) {
    const user = this.getCurrentUser?.();
    if (!user) { this._showToast(msg); return null; }
    return user;
  }

  async _toggleUseful(key) {
    const user = this._requireUser('Inicia sesión para marcar como útil');
    if (!user || !this._place) return;
    const card = this._reviewCards?.get(key);
    if (card?.ctx.ownerId && card.ctx.ownerId === user.id) {
      this._showToast('No puedes marcar tu propia reseña');
      return;
    }
    this._haptic('light');
    this._socialBusy = this._socialBusy || new Set();
    const busyKey = key + '|util';
    if (this._socialBusy.has(busyKey)) return;
    this._socialBusy.add(busyKey);

    const map = this._social.util;
    if (!map.has(key)) map.set(key, new Set());
    const set = map.get(key);
    const wasOn = set.has(user.id);
    if (wasOn) set.delete(user.id); else set.add(user.id);
    this._renderReviewSocial(key, wasOn ? null : 'util:' + key);
    try {
      await ReviewService.setUseful(key, this._place.place_id || this._place.id, user.id, !wasOn);
    } catch (e) {
      console.error('[PM2] Útil:', e);
      if (wasOn) set.add(user.id); else set.delete(user.id);
      this._renderReviewSocial(key);
      this._showToast('No se pudo guardar');
    } finally {
      this._socialBusy.delete(busyKey);
    }
  }

  // key: reseña ('wp:..') o respuesta ('r:..') · renderKey: reseña a
  // redibujar (la que contiene el hilo)
  async _setEmoji(key, type, renderKey = key) {
    const user = this._requireUser('Inicia sesión para reaccionar');
    if (!user || !this._place) return;
    this._haptic('light');
    this._socialBusy = this._socialBusy || new Set();
    const busyKey = key + '|emoji';
    if (this._socialBusy.has(busyKey)) return;
    this._socialBusy.add(busyKey);

    const map = this._social.emoji;
    if (!map.has(key)) map.set(key, new Map());
    const em = map.get(key);
    const prev = em.get(user.id) || null;
    if (type) em.set(user.id, type); else em.delete(user.id);
    this._renderReviewSocial(renderKey, type ? `emoji:${key}:${type}` : null);
    try {
      await ReviewService.setEmoji(key, this._place.place_id || this._place.id, user.id, type);
    } catch (e) {
      console.error('[PM2] Reacción:', e);
      if (prev) em.set(user.id, prev); else em.delete(user.id);
      this._renderReviewSocial(renderKey);
      this._showToast('No se pudo guardar la reacción');
    } finally {
      this._socialBusy.delete(busyKey);
    }
  }

  async _deleteReply(key, replyId) {
    const user = this.getCurrentUser?.();
    if (!user) return;
    const list = this._social.replies.get(key) || [];
    const idx = list.findIndex(r => r.id === replyId);
    if (idx < 0) return;
    const [removed] = list.splice(idx, 1);
    this._renderReviewSocial(key);
    try {
      await ReviewService.deleteReply(replyId, user.id);
    } catch (e) {
      console.error('[PM2] Eliminar respuesta:', e);
      list.splice(idx, 0, removed);
      this._renderReviewSocial(key);
      this._showToast('No se pudo eliminar');
    }
  }

  // Gestos de la tarjeta de una reseña de WhatsPlan. Lo que pase DENTRO
  // de una respuesta del hilo lo maneja la respuesta, no la reseña.
  _wireReviewGestures(row, key) {
    if (this._reviewCards?.get(key)?.ctx.source !== 'wp') return;
    this._addSwipeIcon(row);
    this._wireLongPress(row, () => this._openReactionBar(key, row, key), '.wp-pm2-rv-reply');
    this._wireSwipeReply(row, () => this._openReplySheet(key), '.wp-pm2-rv-reply');
  }

  _addSwipeIcon(el) {
    const icon = document.createElement('div');
    icon.className = 'wp-pm2-rv-swipe-icon';
    icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
    el.prepend(icon);
  }

  // Long-press (450 ms) → onFire. Se cancela si el dedo se mueve (scroll
  // o swipe) o se suelta antes. ignoreSel: zonas internas que no cuentan.
  _wireLongPress(el, onFire, ignoreSel = null) {
    let timer = null, visualTimer = null, sx = 0, sy = 0, fired = false;
    const cancel = (bounce = false) => {
      const wasPressing = el.classList.contains('wp-pm2-rv-pressing');
      clearTimeout(timer); clearTimeout(visualTimer);
      timer = visualTimer = null;
      el.classList.remove('wp-pm2-rv-pressing');
      if (bounce) this._scaleKeys(el, [el.__wpScale || 0.97, 1.02, 1], 280);
      else if (wasPressing) this._scaleTo(el, 1, 140);
    };
    el.addEventListener('pointerdown', (e) => {
      // Se resetea ANTES de cualquier return: si el long-press anterior
      // abrió la barra, el click de soltar nunca llega acá y 'fired'
      // quedaba en true — el siguiente toque se perdía.
      fired = false;
      if (e.button > 0) return;
      if (e.target.closest('button, a')) return;
      if (ignoreSel && e.target.closest(ignoreSel)) return;
      sx = e.clientX; sy = e.clientY;
      // El squish aparece un poco después para no parpadear en cada scroll
      visualTimer = setTimeout(() => {
        el.classList.add('wp-pm2-rv-pressing');
        this._scaleTo(el, 0.97, 220);           // se hunde mientras mantienes
      }, 140);
      timer = setTimeout(() => {
        cancel(true);                          // rebote al disparar
        fired = true;
        this._haptic('medium');
        onFire();
      }, 450);
    });
    el.addEventListener('pointermove', (e) => {
      if (!timer) return;
      if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, () => cancel()));
    // Android abre el menú contextual con el long-press — se bloquea
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // El click que llega al soltar después de un long-press no debe
    // activar "Ver más" ni nada debajo
    el.addEventListener('click', (e) => {
      if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; }
    }, true);
  }

  // Swipe a la derecha → onReply (estilo WhatsApp). Solo cuenta si el
  // movimiento es claramente horizontal (más del doble que vertical) y
  // si arranca lejos del borde izquierdo (ahí iOS usa el "volver").
  _wireSwipeReply(el, onReply, ignoreSel = null) {
    const TH = 60, EDGE = 25;
    let sx = 0, sy = 0, pid = null, mode = null, dx = 0, passed = false, suppress = false;
    const icon = el.querySelector(':scope > .wp-pm2-rv-swipe-icon');
    const ICON = 28;

    const paint = (tx, k) => {
      el.style.transform = tx ? `translateX(${tx}px)` : '';
      if (!icon) return;
      // El ícono queda quieto en el hueco que se abre a la izquierda
      const off = -tx + Math.max(4, (tx - ICON) / 2);
      icon.style.opacity = String(k);
      icon.style.transform = `translateX(${off}px) translateY(-50%) scale(${0.6 + 0.4 * k})`;
    };
    // Regreso a su lugar cuadro por cuadro con JS (translateX 2D sin
    // transición CSS): una transición de transform convierte la tarjeta
    // en capa aparte mientras dura → parpadeo en la zona de reseñas.
    let rafBack = 0;
    const release = () => {
      if (icon) icon.classList.remove('wp-pm2-on');
      const from = parseFloat((el.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0;
      const t0 = performance.now(), D = 260;
      cancelAnimationFrame(rafBack);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / D);
        const e = 1 - Math.pow(1 - k, 3);          // ease-out
        paint(k >= 1 ? 0 : from * (1 - e), (1 - e) * Math.min(1, from / TH));
        if (k < 1) rafBack = requestAnimationFrame(step);
        else el.__wpSwiping = false;
      };
      rafBack = requestAnimationFrame(step);
    };

    el.addEventListener('pointerdown', (e) => {
      suppress = false;
      if (e.button > 0) return;
      if (ignoreSel && e.target.closest(ignoreSel)) return;
      if (e.clientX < EDGE) return;
      sx = e.clientX; sy = e.clientY; pid = e.pointerId;
      mode = null; dx = 0; passed = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (pid !== e.pointerId) return;
      const mx = e.clientX - sx, my = e.clientY - sy;
      if (!mode) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        mode = (mx > 0 && mx > 2 * Math.abs(my)) ? 'h' : 'v';
        if (mode === 'v') { pid = null; mode = null; return; }
        cancelAnimationFrame(rafBack);
        el.__wpSwiping = true;
        if (el.__wpScaleRaf) { cancelAnimationFrame(el.__wpScaleRaf); el.__wpScaleRaf = 0; }
        el.__wpScale = 1;
        el.style.transition = 'none';
        if (icon) icon.style.transition = 'background-color 0.15s, color 0.15s';
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
      dx = Math.max(0, mx);
      const tx = dx <= TH ? dx : TH + (dx - TH) * 0.3; // resistencia pasado el umbral
      paint(tx, Math.min(1, dx / TH));
      if (!passed && dx >= TH) {
        passed = true;
        icon?.classList.add('wp-pm2-on');
        this._haptic('light');
      } else if (passed && dx < TH) {
        passed = false;
        icon?.classList.remove('wp-pm2-on');
      }
    });
    const end = (e) => {
      if (pid !== e.pointerId) return;
      pid = null;
      if (mode === 'h') {
        suppress = true;
        release();
        if (passed && e.type === 'pointerup') onReply();
      }
      mode = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => {
      if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; }
    }, true);
  }

  // Barra de emojis flotante. reactKey: reseña o respuesta a la que se
  // reacciona · anchorEl: elemento sobre el que aparece · renderKey:
  // reseña a redibujar.
  _openReactionBar(reactKey, anchorEl, renderKey = reactKey) {
    if (!anchorEl) return;
    if (!this._requireUser('Inicia sesión para reaccionar')) return;
    this._closeReactionBar(true);

    const uid = this.getCurrentUser().id;
    const mine = (this._social.emoji.get(reactKey) || new Map()).get(uid) || null;

    const layer = document.createElement('div');
    layer.id = 'wp-pm2-react-layer';
    layer.innerHTML = `<div id="wp-pm2-react-dim"></div><div id="wp-pm2-react-bar"></div>`;
    const bar = layer.querySelector('#wp-pm2-react-bar');
    PlaceModal2.REACTIONS.forEach(({ type, emoji }, i) => {
      const b = document.createElement('button');
      b.className = 'wp-pm2-react-opt wp-pm2-emoji' + (mine === type ? ' wp-pm2-mine' : '');
      b.textContent = emoji;
      b.style.transitionDelay = (i * 30) + 'ms';
      b.dataset.type = type;
      bar.appendChild(b);
    });
    document.body.appendChild(layer);
    this._reactLayer = layer;
    this._reactAnchor = anchorEl;
    anchorEl.classList.add('wp-pm2-rv-focus');

    // Arriba del elemento; si no hay lugar (cerca del topbar), debajo.
    const rect = anchorEl.getBoundingClientRect();
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    const left = Math.min(Math.max(12, rect.left + 40), window.innerWidth - bw - 12);
    let top = rect.top - bh - 6;
    let origin = 'bottom';
    if (top < 96) { top = Math.min(rect.top + 34, window.innerHeight - bh - 110); origin = 'top'; }
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
    bar.style.setProperty('--wp-pm2-origin', `${Math.max(20, rect.left + 56 - left)}px ${origin === 'bottom' ? '100%' : '0%'}`);

    // El dedo del long-press todavía está apoyado: el toque recién cuenta
    // cuando empieza uno NUEVO sobre la capa.
    let armed = false;
    layer.addEventListener('pointerdown', () => { armed = true; });
    layer.querySelector('#wp-pm2-react-dim').addEventListener('click', () => {
      if (armed) this._closeReactionBar();
    });
    bar.addEventListener('click', (e) => {
      const opt = e.target.closest('.wp-pm2-react-opt');
      if (!opt || !armed) return;
      const type = opt.dataset.type;
      this._closeReactionBar();
      this._setEmoji(reactKey, mine === type ? null : type, renderKey);
    });

    // Si la ficha scrollea, la barra queda desalineada → se cierra
    const body = this._el.querySelector('#wp-pm2-body');
    this._reactScrollClose = () => this._closeReactionBar();
    body?.addEventListener('scroll', this._reactScrollClose, { passive: true, once: true });

    void layer.offsetHeight;
    requestAnimationFrame(() => layer.classList.add('wp-pm2-in'));
  }

  _closeReactionBar(instant = false) {
    const layer = this._reactLayer;
    if (this._reactAnchor) this._reactAnchor.classList.remove('wp-pm2-rv-focus');
    this._reactAnchor = null;
    const body = this._el?.querySelector('#wp-pm2-body');
    if (body && this._reactScrollClose) body.removeEventListener('scroll', this._reactScrollClose);
    this._reactScrollClose = null;
    if (!layer) return;
    this._reactLayer = null;
    if (instant) { layer.remove(); return; }
    layer.classList.remove('wp-pm2-in');
    layer.style.pointerEvents = 'none';
    setTimeout(() => layer.remove(), 220);
  }

  // Hoja para responder. replyTo (opcional): { id, name, text } cuando se
  // contesta a una respuesta del hilo → arranca con "@Nombre ".
  // editing (opcional): fila de una respuesta PROPIA → modo "Editar".
  _openReplySheet(key, replyTo = null, editing = null) {
    const card = this._reviewCards?.get(key);
    if (!card || !this._place) return;
    const user = this._requireUser('Inicia sesión para responder');
    if (!user) return;

    const prev = document.getElementById('wp-pm2-reply-sheet');
    if (prev) prev.remove();

    const displayName = user.user_metadata?.display_name
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || 'Usuario';
    const avatarUrl = user.user_metadata?.avatar_url || getAvatarUrl(displayName);
    const toName = replyTo ? replyTo.name : card.ctx.author;
    const quote  = editing ? '' : (replyTo ? replyTo.text : card.ctx.text);
    const prefix = (!editing && replyTo) ? '@' + replyTo.name + ' ' : '';
    const sheetTitle = editing ? 'Editar respuesta' : `Respondiendo a ${toName}`;
    const submitLabel = editing ? 'Guardar' : 'Responder';

    const frag = document.createElement('div');
    frag.id = 'wp-pm2-reply-sheet';
    frag.innerHTML = `
      <div class="wp-pm2-rs-overlay" style="position:fixed;inset:0;z-index:1500100;background:rgba(0,0,0,0.3);opacity:0;transition:none"></div>
      <div class="wp-pm2-rs-menu" style="position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:1500200;background:#fff;border-radius:24px;padding:8px 0 4px;box-shadow:0 8px 40px rgba(0,0,0,0.18);transform:translateY(110%);transition:none;font-family:var(--wp-font)">
        <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.15);margin:0 auto 8px"></div>
        <div class="wp-pm2-rs-header" style="padding:4px 20px 10px">
          <span style="display:block;font-size:16px;font-weight:700;color:#0a0a0a">${this._esc(sheetTitle)}</span>
          <span style="display:${quote ? '-webkit-box' : 'none'};-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:12px;color:#8e8e93;margin-top:4px;padding-left:10px;border-left:2px solid #e5e7eb;line-height:1.4">${this._esc(quote)}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;padding:0 16px">
          <img src="${this._esc(avatarUrl)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;margin-top:4px">
          <div style="flex:1;min-width:0">
            <textarea class="wp-pm2-rs-textarea" maxlength="500" placeholder="Escribe tu respuesta..." style="width:100%;height:80px;border-radius:14px;border:1px solid rgba(0,0,0,0.10);background:#f9f9f9;padding:10px 12px;font-size:14px;font-family:var(--wp-font);color:#0a0a0a;resize:none;box-sizing:border-box;outline:none"></textarea>
            <div class="wp-pm2-rs-char" style="text-align:right;font-size:11px;color:#8e8e93;margin-top:4px">0 / 500</div>
          </div>
        </div>
        <div style="padding:10px 16px 16px">
          <button class="wp-pm2-rs-submit" disabled style="width:100%;height:46px;border-radius:999px;border:none;background:#0a0a0a;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--wp-font);opacity:0.4;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent">${submitLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(frag);

    const overlay  = frag.querySelector('.wp-pm2-rs-overlay');
    const menu     = frag.querySelector('.wp-pm2-rs-menu');
    const header   = frag.querySelector('.wp-pm2-rs-header');
    const textarea = frag.querySelector('.wp-pm2-rs-textarea');
    const charEl   = frag.querySelector('.wp-pm2-rs-char');
    const submit   = frag.querySelector('.wp-pm2-rs-submit');

    // Texto real sin la @mención del inicio
    const bodyText = () => {
      const v = textarea.value;
      return (prefix && v.startsWith(prefix.trim())) ? v.slice(prefix.trim().length).trim() : v.trim();
    };
    const refresh = () => {
      charEl.textContent = textarea.value.length + ' / 500';
      const ok = bodyText().length >= 1;
      submit.disabled = !ok;
      submit.style.opacity = ok ? '1' : '0.4';
    };
    textarea.value = editing ? (editing.text || '') : prefix;
    textarea.oninput = refresh;
    refresh();

    const close = () => {
      textarea.blur();
      const wait = this._sheetOut(menu, overlay);
      setTimeout(() => frag.remove(), wait);
    };
    overlay.onclick = close;

    submit.onclick = async () => {
      if (submit.disabled) return;
      submit.disabled = true;
      submit.textContent = editing ? 'Guardando...' : 'Enviando...';
      if (editing) {
        try {
          const updated = await ReviewService.updateReply(editing.id, user.id, textarea.value.trim());
          const list = this._social.replies.get(key) || [];
          const i = list.findIndex(x => x.id === editing.id);
          if (i >= 0) list[i] = { ...list[i], ...updated };
          this._renderReviewSocial(key);
          close();
          this._showToast('✓ Respuesta editada');
        } catch (e) {
          console.error('[PM2] Editar respuesta:', e);
          this._showToast('No se pudo guardar');
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }
      // Si borraron la @mención a mano, ya no es respuesta a esa persona
      const keepsMention = !!(prefix && textarea.value.startsWith(prefix.trim()));
      try {
        const row = await ReviewService.addReply(
          key, this._place.place_id || this._place.id, user.id,
          textarea.value.trim(), displayName, user.user_metadata?.avatar_url || null,
          keepsMention ? { id: replyTo.id, name: replyTo.name } : null
        );
        if (!this._social.replies.has(key)) this._social.replies.set(key, []);
        this._social.replies.get(key).push(row);
        card.repliesOpen = true;
        this._renderReviewSocial(key);
        close();
        this._showToast('✓ Respuesta publicada');
      } catch (e) {
        console.error('[PM2] Responder:', e);
        this._showToast(e.message || 'No se pudo enviar');
        submit.disabled = false;
        submit.textContent = submitLabel;
      }
    };

    // Arrastrar el encabezado hacia abajo para cerrar
    let sy = 0, dy = 0, dragging = false;
    header.addEventListener('touchstart', e => {
      sy = e.touches[0].clientY; dy = 0; dragging = true;
      menu.style.transition = 'none';
    }, { passive: true });
    header.addEventListener('touchmove', e => {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - sy);
      menu.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    header.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      menu.style.transition = 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)';
      if (dy > 80) close();
      else menu.style.transform = 'translateY(0)';
    });

    this._sheetIn(menu, overlay);
    // Teclado directo, con el cursor al final (después de la @mención)
    setTimeout(() => {
      if (!frag.isConnected) return;
      textarea.focus();
      const n = textarea.value.length;
      try { textarea.setSelectionRange(n, n); } catch (_) {}
    }, 340);
  }

  // Panel de reseñas de WhatsPlan (tabla place_reviews vía ReviewService)
  async _loadCommunityReviews(place) {
    let reviews = [];
    try {
      reviews = await ReviewService.getForPlace(place.place_id || place.id) || [];
    } catch (e) {
      reviews = [];
    }
    // Espera la moderación para no pintar algo que hay que ocultar
    try { await this._modPromise; } catch (_) {}
    if (this._place !== place) return; // llegó tarde: ya hay otra ficha abierta
    this._communityRaw = reviews;
    // Calificación y total del hero: enseguida (es solo texto, barato)
    this._communityReviews = reviews.filter(r => this._isVisible('wp:' + r.id, r.user_id));
    this._renderReviewsSummary(place);
    this._renderRatingHero(place);
    // Las TARJETAS se construyen cuando el scroll se acerca a la sección
    // (o cuando el teléfono está libre). Antes se construían al abrir la
    // ficha, justo cuando el usuario hace scroll del hero, y ese trabajo
    // en el hilo principal hacía que el parallax avanzara a saltos (el
    // primer gesto tras abrir medía 43 actualizaciones/s vs ~110 después).
    try { await this._reviewsGate; } catch (_) {}
    if (this._place !== place) return;
    this._renderCommunityPanel(place);
  }

  // Promesa que se resuelve cuando la sección de reseñas está a <600px de
  // entrar en pantalla, o cuando el navegador queda libre (máx. 3s).
  _makeReviewsGate(place) {
    if (this._reviewsGateObs) { this._reviewsGateObs.disconnect(); this._reviewsGateObs = null; }
    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (this._reviewsGateObs) { this._reviewsGateObs.disconnect(); this._reviewsGateObs = null; }
        resolve();
      };
      const section = this._el.querySelector('#wp-pm2-reviews-section');
      const body = this._el.querySelector('#wp-pm2-body');
      if (!section || !body || typeof IntersectionObserver === 'undefined') { finish(); return; }
      this._reviewsGateObs = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) finish();
      }, { root: body, rootMargin: '0px 0px 600px 0px' });
      this._reviewsGateObs.observe(section);
      // Respaldo: cuando el teléfono esté libre (o a los 3s como máximo)
      const idle = window.requestIdleCallback
        ? (cb) => window.requestIdleCallback(cb, { timeout: 3000 })
        : (cb) => setTimeout(cb, 1500);
      setTimeout(() => idle(() => { if (this._place === place) finish(); }), 1200);
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // MODERACIÓN Y MENÚ "⋯" DE RESEÑAS / RESPUESTAS
  // this._mod = { hidden, myReports, blocked } (Sets):
  //   hidden    → claves ocultas para todos (el moderador las quitó)
  //   myReports → lo que ESTE usuario reportó (pendiente): se le sigue
  //               mostrando, marcado "En revisión" y difuminado
  //   blocked   → ids de usuarios que bloqueó: no ve nada de ellos
  // El autor SIEMPRE sigue viendo lo suyo (aunque esté oculto para el
  // resto), así no parece que la app le borró algo.
  // ══════════════════════════════════════════════════════════════════

  async _loadModeration(place) {
    const pid = place.place_id || place.id;
    const uid = this.getCurrentUser?.()?.id || null;
    if (!pid) return;
    try {
      const m = await ReviewService.getModerationForPlace(pid, uid);
      if (this._place !== place) return;
      this._mod = {
        hidden:    new Set(m.hidden),
        myReports: new Set(m.myReports),
        blocked:   new Set(m.blocked),
      };
    } catch (e) {
      // Sin las tablas de moderación (falta el SQL) se muestra todo
      console.warn('[PM2] Moderación no disponible:', e.message || e);
    }
  }

  _isVisible(key, authorId) {
    const uid = this.getCurrentUser?.()?.id || null;
    if (authorId && uid && authorId === uid) return true;
    const m = this._mod;
    if (!m) return true;
    if (authorId && m.blocked.has(authorId)) return false;
    if (m.hidden.has(key)) return false;
    return true;
  }

  // Pill "Dueño" si quien escribió es el dueño verificado del lugar
  _applyOwnerBadge(nameEl, authorId) {
    const ownerId = this._place?.owner_id;
    if (!nameEl || !ownerId || !authorId || ownerId !== authorId) return;
    const b = document.createElement('span');
    b.className = 'wp-pm2-rv-owner-badge';
    b.textContent = '✓ Dueño';
    // Antes del "↳ Fulano" (si es respuesta a alguien) para que quede pegado al nombre
    const to = nameEl.querySelector('.wp-pm2-rv-reply-to');
    if (to) nameEl.insertBefore(b, to); else nameEl.appendChild(b);
  }

  _isBlockedUser(userId) {
    return !!(userId && this._mod && this._mod.blocked.has(userId));
  }

  // Si ESTE usuario reportó el contenido (y sigue pendiente): pill
  // "En revisión" junto al nombre + texto difuminado. El botón alterna
  // entre "Toca para ver" y "Ocultar" (se recuerda mientras la app esté
  // abierta). El resto de los usuarios lo ve normal hasta que el
  // moderador decida.
  _applyUnderReview(key, nameEl, textEl) {
    if (!this._mod || !this._mod.myReports.has(key) || !nameEl || !textEl) return;
    const badge = document.createElement('span');
    badge.className = 'wp-pm2-rv-review-badge';
    badge.textContent = 'En revisión';
    nameEl.appendChild(badge);
    if (!this._revealed) this._revealed = new Set();
    const toggle = document.createElement('button');
    toggle.className = 'wp-pm2-rv-reveal';
    const paint = () => {
      const shown = this._revealed.has(key);
      textEl.classList.toggle('wp-pm2-rv-blur', !shown);
      toggle.innerHTML = shown
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg> Ocultar'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Lo reportaste · Toca para ver';
    };
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (this._revealed.has(key)) this._revealed.delete(key);
      else this._revealed.add(key);
      paint();
    };
    paint();
    textEl.insertAdjacentElement('afterend', toggle);
  }

  // Pinta el panel Comunidad a partir de this._communityRaw, aplicando
  // la moderación. Se vuelve a llamar después de reportar/bloquear/borrar.
  _renderCommunityPanel(place) {
    const panel = this._el.querySelector('#wpr-panel-community');
    this._communityReviews = (this._communityRaw || [])
      .filter(r => this._isVisible('wp:' + r.id, r.user_id));
    panel.innerHTML = '';
    if (!this._communityReviews.length) {
      panel.innerHTML = '<p class="wpr-empty">Sé el primero en reseñar este lugar</p>';
    } else {
      this._communityReviews.forEach(r => {
        panel.appendChild(this._buildReviewCard(
          r.display_name || 'Usuario',
          r.rating, r.text, this._timeAgo(r.created_at),
          getAvatarUrl(r.display_name || 'user'),
          r.id != null ? {
            key: 'wp:' + r.id,
            source: 'wp',
            author: r.display_name || 'Usuario',
            text: r.text || '',
            ownerId: r.user_id || null,
          } : null
        ));
      });
    }
    this._buildReviewsHeader(place);   // conteo + pestaña por defecto
    this._renderReviewsSummary(place); // total combinado
    this._renderRatingHero(place);     // calificación combinada
  }

  // ── Hoja genérica (mismo estilo que la de reseña/responder) ─────────
  // Devuelve { body, close }. body es donde se mete el contenido.
  // Animación de entrada/salida: ver _sheetIn/_sheetOut (modo elegible).
  // instant=true → aparece y se va sin animación (formulario de reclamo)
  _openSheet(title, subtitle = '', { instant = false } = {}) {
    const prev = document.getElementById('wp-pm2-menu-sheet');
    // ¿Viene de otra hoja que se cerró dejando el fondo oscuro puesto
    // (opción de un menú que abre otra hoja)? → la nueva arranca con el
    // fondo YA oscuro, sin apagarlo y volverlo a prender (eso era el
    // parpadeo: el fondo bajaba de 0.95 a 0.05 y volvía a subir).
    const chained = !!(prev && prev.dataset.keepDim === '1');
    if (prev) prev.remove();
    const frag = document.createElement('div');
    frag.id = 'wp-pm2-menu-sheet';
    if (chained) frag.classList.add('wp-pm2-ms-chained');
    frag.innerHTML = `
      <div class="wp-pm2-ms-overlay"></div>
      <div class="wp-pm2-ms-menu">
        <div class="wp-pm2-ms-handle"></div>
        <div class="wp-pm2-ms-header">
          <span class="wp-pm2-ms-title">${this._esc(title)}</span>
          ${subtitle ? `<span class="wp-pm2-ms-sub">${this._esc(subtitle)}</span>` : ''}
        </div>
        <div class="wp-pm2-ms-body"></div>
      </div>`;
    document.body.appendChild(frag);
    const overlay = frag.querySelector('.wp-pm2-ms-overlay');
    const menu    = frag.querySelector('.wp-pm2-ms-menu');
    const header  = frag.querySelector('.wp-pm2-ms-header');

    let closed = false;
    // keepDim=true: la hoja se va pero el fondo oscuro se queda, por si la
    // opción elegida abre otra hoja (la toma sin parpadeo). Si en 450ms no
    // se abrió ninguna (p.ej. "Copiar"), el fondo se apaga normal.
    const close = (keepDim = false) => {
      if (closed) return;
      closed = true;
      this._closePopMenu?.();
      frag.classList.remove('wp-pm2-ms-tall'); // sin área de scroll durante la salida
      const keep = keepDim === true;
      const wait = this._sheetOut(menu, overlay, { keepDim: keep, instant });
      if (keep) {
        frag.dataset.keepDim = '1';
        setTimeout(() => {
          if (!frag.isConnected) return; // otra hoja ya la reemplazó
          frag.dataset.keepDim = '';
          this._sheetDimOff(overlay, instant);
          setTimeout(() => frag.remove(), 240);
        }, Math.max(450, wait));
      } else {
        setTimeout(() => frag.remove(), wait);
      }
    };
    overlay.onclick = () => close();

    let sy = 0, dy = 0, dragging = false;
    header.addEventListener('touchstart', e => {
      sy = e.touches[0].clientY; dy = 0; dragging = true;
      menu.style.transition = 'none';
    }, { passive: true });
    header.addEventListener('touchmove', e => {
      if (!dragging) return;
      dy = Math.max(0, e.touches[0].clientY - sy);
      menu.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    header.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      menu.style.transition = 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)';
      if (dy > 80) close();
      else menu.style.transform = 'translateY(0)';
    });

    this._sheetIn(menu, overlay, { dimmed: chained, instant });
    frag.classList.add('wp-pm2-in');
    return { body: frag.querySelector('.wp-pm2-ms-body'), close };
  }

  // [DIAG] temporal: memoria/DOM en cada apertura y cierre de la ficha,
  _diagMem(cuando) {
    try {
      const m = performance.memory;
      const mb = v => Math.round(v / 1048576);
      const all = document.getElementsByTagName('*').length;
      const ficha = this._el ? this._el.getElementsByTagName('*').length : 0;
      const eruda = document.getElementById('eruda');
      const erudaN = eruda ? (eruda.shadowRoot || eruda).querySelectorAll('*').length : 0;
      console.log(`[DIAG-MEM] ${cuando} heap=${m ? mb(m.usedJSHeapSize) + '/' + mb(m.jsHeapSizeLimit) + 'MB' : 'n/d'} ` +
        `nodos=${all} ficha=${ficha} eruda=${erudaN} imgs=${document.images.length} canvas=${document.getElementsByTagName('canvas').length} ` +
        `hojas=${document.querySelectorAll('#wp-pm2-menu-sheet,#wp-pm2-review-modal,.wp-pm2-rs-overlay').length} t=${Math.round(performance.now() / 1000)}s`);
    } catch (e) { console.log('[DIAG-MEM] error', e.message); }
  }

  // ── Lo de atrás de la ficha ────────────────────────────────────────
  // La ficha es opaca y cubre toda la pantalla, pero el mapa (WebGL), sus
  // pins con animaciones infinitas (pulsos, flotado, shimmer), el slide
  // de clusters "pausado" y los paneles seguían vivos detrás, gastando
  // GPU en cada cuadro. Con la GPU ocupada, el scroll de la ficha se
  // ponía pesado y al aparecer una hoja las fotos se re-dibujaban con
  // glitch (y al salir/volver a la app, Android liberaba todo → fluido).
  // Se ocultan cuando la ficha ya terminó de entrar y vuelven al cerrar.
  // Lo que se crea DESPUÉS (hojas, toast, reacciones) no se marca.
  _coverBehind(on) {
    clearTimeout(this._coverTimer);
    if (!on) {
      document.querySelectorAll('.wp-pm2-under').forEach(n => n.classList.remove('wp-pm2-under'));
      (this._pausedAnims || []).forEach(a => { try { a.play(); } catch (_) {} });
      this._pausedAnims = [];
      return;
    }
    this._coverTimer = setTimeout(() => {
      if (!this._el.classList.contains('wp-pm2-in')) return;
      [...document.body.children].forEach(n => {
        if (n === this._el) return;
        if (n.id === 'eruda') return;
        if (/^(SCRIPT|STYLE|LINK|TEMPLATE|SVG)$/i.test(n.tagName)) return;
        if (n.id && n.id.startsWith('wp-pm2-')) return; // hojas/toast de la ficha
        n.classList.add('wp-pm2-under');
      });
      // Congelar sus animaciones (con la API: también las que están en
      // style="" inline, que una regla CSS no alcanza sin !important)
      try {
        this._pausedAnims = document.getAnimations().filter(a => {
          const t = a.effect?.target;
          return t && t.closest?.('.wp-pm2-under') && a.playState === 'running';
        });
        this._pausedAnims.forEach(a => a.pause());
      } catch (_) { this._pausedAnims = []; }
    }, 450);
  }

  // ══ HOJAS NATIVAS (Capacitor) ══════════════════════════════════════
  // Plugin nativo si la app corre en Capacitor y el plugin está instalado
  // (npm i @capacitor/action-sheet @capacitor/dialog … + npx cap sync).
  // En navegador, o sin el plugin, devuelve null → se usa la hoja web.
  _nativePlugin(name) {
    const C = window.Capacitor;
    try {
      if (C?.isNativePlatform?.() && C.isPluginAvailable?.(name)) return C.Plugins?.[name] || null;
    } catch (_) {}
    return null;
  }

  // Menú de opciones: hoja NATIVA de Android/iOS (@capacitor/action-sheet),
  // con su propia animación del sistema. items: [{ label, icon, danger,
  // disabled, disabledMsg, action }]. En Android el plugin no muestra el
  // "message", así que el subtítulo va en una 2ª línea del título.
  _openOptions(title, subtitle, items) {
    const AS = this._nativePlugin('ActionSheet');
    if (!AS?.showActions) {
      const { body, close } = this._openSheet(title, subtitle);
      this._fillSheetOptions(body, items, close);
      return;
    }
    const android = window.Capacitor?.getPlatform?.() === 'android';
    const options = items.map(it => ({ title: it.label, style: it.danger ? 'DESTRUCTIVE' : 'DEFAULT' }));
    options.push({ title: 'Cancelar', style: 'CANCEL' });
    AS.showActions({
      title: android && subtitle ? `${title}\n${subtitle}` : title,
      message: !android && subtitle ? subtitle : undefined,
      options,
      cancelable: true, // tocar fuera cierra (plugin ≥ 8.1; antes lo ignora y queda "Cancelar")
    }).then(r => {
      const it = r && !r.canceled ? items[r.index] : null; // "Cancelar" = índice fuera de items
      if (!it) return;
      if (it.disabled) { if (it.disabledMsg) this._showToast(it.disabledMsg); return; }
      it.action?.();
    }).catch(e => console.warn('[PM2] ActionSheet nativo:', e));
  }

  // Filas de opciones: [{ label, icon, danger, action }]
  _fillSheetOptions(body, items, close) {
    items.forEach(it => {
      const b = document.createElement('button');
      b.className = 'wp-pm2-ms-opt' + (it.danger ? ' wp-pm2-danger' : '');
      b.innerHTML = `<span class="wp-pm2-ms-ico">${it.icon || ''}</span><span>${this._esc(it.label)}</span>`;
      if (it.disabled) { b.disabled = true; body.appendChild(b); return; }
      // La hoja baja completa (0.26s) antes de que la acción abra otra:
      // así la vieja nunca se borra a media salida.
      b.onclick = () => {
        close(true);
        const m = this._sheetMode();
        setTimeout(it.action, m === 'instant' ? 0 : (m === 'fade' ? 170 : 270));
      };
      body.appendChild(b);
    });
  }

  // Confirmación (para eliminar / bloquear). Devuelve Promise<boolean>.
  // Nativo: diálogo del sistema (@capacitor/dialog). Respaldo: hoja web.
  _confirmSheet(title, message, confirmLabel, danger = true) {
    const Dlg = this._nativePlugin('Dialog');
    if (Dlg?.confirm) {
      return Dlg.confirm({ title, message, okButtonTitle: confirmLabel, cancelButtonTitle: 'Cancelar' })
        .then(r => !!r?.value)
        .catch(e => { console.warn('[PM2] Dialog nativo:', e); return false; });
    }
    return new Promise(resolve => {
      const { body, close } = this._openSheet(title);
      let done = false;
      const finish = (v) => { if (done) return; done = true; close(); resolve(v); };
      body.innerHTML = `
        <p class="wp-pm2-ms-msg">${this._esc(message)}</p>
        <div class="wp-pm2-ms-actions">
          <button class="wp-pm2-ms-btn wp-pm2-ms-cancel">Cancelar</button>
          <button class="wp-pm2-ms-btn ${danger ? 'wp-pm2-ms-danger-btn' : 'wp-pm2-ms-primary-btn'}">${this._esc(confirmLabel)}</button>
        </div>`;
      body.querySelector('.wp-pm2-ms-cancel').onclick = () => finish(false);
      body.querySelector('.wp-pm2-ms-danger-btn, .wp-pm2-ms-primary-btn').onclick = () => finish(true);
      // Tocar fuera = cancelar
      const sheet = document.getElementById('wp-pm2-menu-sheet');
      sheet?.querySelector('.wp-pm2-ms-overlay')?.addEventListener('click', () => finish(false));
    });
  }

  _copyText(text) {
    const done = () => this._showToast('Texto copiado');
    const Clip = this._nativePlugin('Clipboard');
    if (Clip?.write) {
      Clip.write({ string: text }).then(done).catch(() => this._copyFallback(text, done));
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this._copyFallback(text, done));
    } else {
      this._copyFallback(text, done);
    }
  }
  _copyFallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    done();
  }

  // Menú "⋯". kind: 'review' (key = reseña) | 'reply' (key = reseña que
  // contiene el hilo, reply = fila de la respuesta).
  _openItemMenu(kind, key, reply = null) {
    const card = this._reviewCards?.get(key);
    if (!card) return;
    const uid = this.getCurrentUser?.()?.id || null;
    const isReply  = kind === 'reply';
    const isGoogle = !isReply && card.ctx.source === 'google';
    const text     = isReply ? (reply.text || '') : (card.ctx.text || '');
    const authorId = isReply ? reply.user_id : card.ctx.ownerId;
    const name     = isReply ? (reply.display_name || 'Usuario') : card.ctx.author;
    const reportKey = isReply ? 'r:' + reply.id : key;
    const isOwn    = !!(uid && authorId && authorId === uid);

    const ICON = {
      copy:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      edit:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      trash:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
      flag:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
      block:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
      undo:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
      google: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    };

    const items = [{ label: 'Copiar texto', icon: ICON.copy, action: () => this._copyText(text) }];
    if (isGoogle) {
      const pid = this._place?.place_id || this._place?.id;
      if (pid) items.push({ label: 'Ver en Google', icon: ICON.google, action: () => {
        window.open(`https://search.google.com/local/reviews?placeid=${pid}`, '_blank', 'noopener');
      } });
    } else if (isOwn) {
      items.push({ label: 'Editar', icon: ICON.edit, action: () => {
        if (isReply) this._openReplySheet(key, null, reply);
        else this._openReviewModal();
      } });
      items.push({ label: 'Eliminar', icon: ICON.trash, danger: true, action: () => {
        if (isReply) this._confirmDeleteReply(key, reply);
        else this._confirmDeleteReview();
      } });
    } else if (authorId) {
      if (this._mod?.myReports.has(reportKey)) {
        // Reporte pendiente → se puede retirar (vuelve a verse normal)
        items.push({ label: 'Retirar reporte', icon: ICON.undo, action: () => this._withdrawReport(reportKey, isReply ? key : null) });
      } else {
        items.push({ label: 'Reportar', icon: ICON.flag, action: () => this._openReportSheet(reportKey, isReply ? key : null) });
      }
      items.push({ label: `Bloquear a ${name}`, icon: ICON.block, danger: true, action: () => this._confirmBlock(authorId, name) });
    }

    const underReview = !!this._mod?.myReports.has(reportKey);
    this._openOptions(
      isReply ? 'Respuesta' : 'Reseña',
      underReview ? `${name} · Tu reporte está en revisión` : name,
      items
    );
  }

  // ══ ANIMACIÓN DE HOJAS WEB (solo formularios y respaldo) ══════════
  // Los menús de opciones y las confirmaciones son NATIVOS cuando la app
  // corre en Capacitor (ver _openOptions / _confirmSheet). Las hojas web
  // que quedan (escribir reseña, responder, "¿Es tu negocio?" y el
  // respaldo en navegador) suben con transform; el fondo oscurece con
  // `background-color`. _openSheet(…, { instant:true }) = sin animación.
  _sheetMode() { return 'slide'; }

  // dimmed=true → el fondo ya estaba oscuro (viene de otra hoja): no se anima
  _sheetIn(menu, overlay, { dimmed = false, instant = false } = {}) {
    const mode = instant ? 'instant' : this._sheetMode();
    const DIM = 'rgba(0,0,0,0.3)';
    const REST = 'calc(12px + env(safe-area-inset-bottom,0px))';
    overlay.style.transition = 'none';
    overlay.style.opacity = '1';
    overlay.style.background = dimmed ? DIM : 'rgba(0,0,0,0)';
    menu.style.transition = 'none';
    menu.style.visibility = '';
    menu.style.transform = 'none';
    menu.style.opacity = '1';
    menu.style.bottom = REST;
    if (mode === 'bottom') menu.style.bottom = `-${menu.offsetHeight + 40}px`;
    else if (mode === 'fade') menu.style.opacity = '0';
    else if (mode === 'slide') menu.style.transform = 'translateY(110%)';
    void menu.offsetHeight; // fija el estado inicial antes de animar
    requestAnimationFrame(() => {
      if (mode !== 'instant') {
        if (!dimmed) overlay.style.transition = 'background-color 0.25s ease';
        if (mode === 'bottom') menu.style.transition = 'bottom 0.34s cubic-bezier(0.34,1.15,0.64,1)';
        if (mode === 'fade')   menu.style.transition = 'opacity 0.2s ease';
        if (mode === 'slide')  menu.style.transition = 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)';
      }
      overlay.style.background = DIM;
      menu.style.bottom = REST;
      menu.style.opacity = '1';
      menu.style.transform = 'none';
    });
  }

  // Devuelve cuántos ms esperar antes de quitar la hoja del DOM.
  // keepDim=true → la hoja se va pero el fondo oscuro se queda (otra hoja
  // lo va a tomar sin parpadeo).
  _sheetOut(menu, overlay, { keepDim = false, instant = false } = {}) {
    const mode = instant ? 'instant' : this._sheetMode();
    let wait = 0;
    if (mode === 'instant') {
      menu.style.transition = 'none';
      menu.style.visibility = 'hidden';
    } else if (mode === 'bottom') {
      menu.style.transition = 'bottom 0.26s cubic-bezier(0.32,0.72,0,1)';
      menu.style.bottom = `-${menu.offsetHeight + 40}px`;
      wait = 270;
    } else if (mode === 'fade') {
      menu.style.transition = 'opacity 0.16s ease';
      menu.style.opacity = '0';
      wait = 170;
    } else {
      menu.style.transition = 'transform 0.26s cubic-bezier(0.32,0.72,0,1)';
      menu.style.transform = 'translateY(110%)';
      wait = 270;
    }
    if (!keepDim) this._sheetDimOff(overlay, instant);
    return wait;
  }

  _sheetDimOff(overlay, instant = false) {
    overlay.style.transition = instant || this._sheetMode() === 'instant' ? 'none' : 'background-color 0.22s ease';
    overlay.style.background = 'rgba(0,0,0,0)';
  }

  // ── LUGAR: compartir y menú "⋯" ───────────────────────────────────
  _placeInfo() {
    const p = this._place || {};
    const name = p.name || p.displayName || 'Lugar';
    const address = p.formattedAddress || p.formatted_address || p.address || '';
    const lat = p.location?.lat || p.lat;
    const lng = p.location?.lng || p.lng;
    // place_id de Google (ChIJ...) → el link abre la ficha exacta en Maps
    const gid = typeof p.place_id === 'string' && p.place_id.length > 20 ? p.place_id : null;
    let url = '';
    if (gid) url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${gid}`;
    else if (lat && lng) url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return { name, address, lat, lng, gid, url, category: p.category || p.primaryTypeDisplayName || '' };
  }

  // Compartir: hoja nativa de Capacitor (si el plugin Share está), si no
  // la Web Share API, y si tampoco existe (WebView de Android) se copia
  // al portapapeles. Se comparte un link de Google Maps: abre en
  // cualquier teléfono aunque no tenga la app.
  async _sharePlace() {
    if (!this._place) return;
    const { name, address, url } = this._placeInfo();
    const text = address ? `${name}\n${address}` : name;
    const capShare = window.Capacitor?.Plugins?.Share;
    try {
      if (capShare?.share) {
        await capShare.share({ title: name, text, url: url || undefined, dialogTitle: 'Compartir lugar' });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: name, text, url: url || undefined });
        return;
      }
    } catch (e) {
      // El usuario cerró la hoja sin compartir → no es error
      if (e?.name === 'AbortError' || /cancel/i.test(e?.message || '')) return;
      console.warn('[PM2] Compartir falló, se copia al portapapeles:', e);
    }
    const full = url ? `${text}\n${url}` : text;
    const done = () => this._showToast('Enlace copiado para compartir');
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(full).then(done).catch(() => this._copyFallback(full, done));
    } else {
      this._copyFallback(full, done);
    }
  }

  _openPlaceMenu() {
    if (!this._place) return;
    const info = this._placeInfo();
    const I = {
      share:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></svg>',
      route:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>',
      copy:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      link:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
      alert:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
      store:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/></svg>',
    };
    const items = [{ label: 'Compartir', icon: I.share, action: () => this._sharePlace() }];
    if (info.lat && info.lng) {
      items.push({ label: 'Cómo llegar', icon: I.route, action: () => {
        const dest = `${info.lat},${info.lng}`;
        const gid = info.gid ? `&destination_place_id=${info.gid}` : '';
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}${gid}`, '_blank', 'noopener');
      } });
    }
    if (info.address) items.push({ label: 'Copiar dirección', icon: I.copy, action: () => this._copyText(info.address) });
    if (info.url) items.push({ label: 'Copiar enlace', icon: I.link, action: () => this._copyText(info.url) });
    items.push({ label: 'Reportar un problema', icon: I.alert, action: () => this._openPlaceReportSheet() });

    // "¿Es tu negocio?" — según el estado
    const uid = this.getCurrentUser?.()?.id || null;
    const ownerId = this._place.owner_id || null;
    if (ownerId && uid && ownerId === uid) {
      items.push({ label: 'Administrar negocio · próximamente', icon: I.store, disabled: true, disabledMsg: 'Administrar negocio estará disponible pronto' });
    } else if (!ownerId) {
      if (this._myClaim?.status === 'pending') {
        items.push({ label: 'Solicitud enviada · en revisión', icon: I.store, disabled: true, disabledMsg: 'Tu solicitud está en revisión' });
      } else {
        items.push({ label: '¿Es tu negocio?', icon: I.store, action: () => this._openClaimSheet() });
      }
    }

    this._openOptions(info.name, info.category, items);
  }

  // ── FAVORITOS Y COLECCIONES ────────────────────────────────────────
  // Botón bajo el hero: "♡ Añadir a favoritos" → al guardarlo cambia a
  // "+ Añadir a una colección" y aparece la pill "♥ En tus favoritos" en
  // el hero. Quitar de favoritos: desde la hoja de colecciones.
  async _loadFavorite(place) {
    this._isFav = false;
    this._placeCols = [];
    this._renderFavUI(false);
    const uid = this.getCurrentUser?.()?.id || null;
    if (!uid) return;
    try {
      const pid = place.place_id || place.id;
      const fav = await FavoriteService.isFavorite(pid, uid);
      if (this._place !== place) return;
      this._isFav = fav;
      this._renderFavUI(false);
      // ¿En qué colecciones está? (solo si es favorito: es lo que muestra
      // el botón de abajo del hero)
      if (fav) {
        const cols = await FavoriteService.getCollections(uid, pid);
        if (this._place !== place) return;
        this._placeCols = cols.filter(c => c.has).map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
        this._renderFavUI(false);
      }
    } catch (e) {
      console.warn('[PM2] Favoritos no disponibles:', e.message || e);
    }
  }

  _renderFavUI(animate) {
    const btn = this._el.querySelector('#wp-pm2-add-review');
    const pill = this._el.querySelector('#wp-pm2-fav-badge');
    const HEART = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';
    const PLUS = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    const CHEV = '<svg class="wp-pm2-fav-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
    if (btn) {
      // Sin favorito → "♥ Añadir a favoritos"
      // Favorito sin colección → "+ Añadir a una colección"
      // Favorito en colección(es) → "☕ Cafés para trabajar +1 ⌄" (abre la hoja)
      const inCols = this._isFav ? (this._placeCols || []) : [];
      btn.classList.toggle('wp-pm2-fav-add', !this._isFav);
      btn.classList.toggle('wp-pm2-fav-coll', !!this._isFav && !inCols.length);
      btn.classList.toggle('wp-pm2-fav-in', inCols.length > 0);
      if (!this._isFav) btn.innerHTML = `${HEART}Añadir a favoritos`;
      else if (!inCols.length) btn.innerHTML = `${PLUS}Añadir a una colección`;
      else {
        const c = inCols[inCols.length - 1]; // la más reciente
        btn.innerHTML = `<span class="wp-pm2-fav-in-emoji">${this._esc(c.emoji || '❤️')}</span>` +
          `<span class="wp-pm2-fav-in-name">${this._esc(c.name)}</span>` +
          (inCols.length > 1 ? `<span class="wp-pm2-fav-in-more">+${inCols.length - 1}</span>` : '') + CHEV;
      }
      btn.setAttribute('aria-label', inCols.length ? `En ${inCols.length} ${inCols.length > 1 ? 'colecciones' : 'colección'}` : btn.textContent.trim());
      if (animate) this._scaleKeys(btn, [0.85, 1.08, 1], 320);
    }
    if (pill) {
      pill.style.display = this._isFav ? '' : 'none';
      const feat = this._el.querySelector('#wp-pm2-featured-badge');
      pill.style.marginLeft = feat && feat.style.display !== 'none' ? '6px' : '0';
      if (animate && this._isFav) this._scaleKeys(pill, [0.6, 1.12, 1], 360);
    }
  }

  async _setFavorite(on, { undo = false } = {}) {
    const user = this._requireUser('Inicia sesión para guardar en favoritos');
    if (!user || !this._place) return;
    if (this._favBusy) return;
    this._favBusy = true;
    const place = this._place;
    const prev = this._isFav;
    this._isFav = on;
    this._renderFavUI(true);
    if (on) this._haptic('success'); else this._haptic('light');
    try {
      if (on) await FavoriteService.add(place.place_id || place.id, user.id);
      else    await FavoriteService.remove(place.place_id || place.id, user.id);
      if (this._place === place) {
        if (!on && undo) this._showToast('Quitado de favoritos', { label: 'Deshacer', onClick: () => { if (this._place === place) this._setFavorite(true); } });
        else this._showToast(on ? '♥ Guardado en favoritos' : 'Quitado de favoritos');
      }
    } catch (e) {
      console.error('[PM2] Favoritos:', e);
      if (this._place === place) { this._isFav = prev; this._renderFavUI(false); }
      this._showToast('No se pudo guardar');
    } finally {
      this._favBusy = false;
    }
  }

  // Hoja "Añadir a una colección": favorito (con opción de quitarlo), tus
  // colecciones (tocar = meter/sacar el lugar) y, abajo, el campo para
  // crear una nueva (ícono + nombre + ✓), todo en la misma hoja.
  // ── Menú pequeño tipo iOS (el que sale de un ⋯) ────────────────────
  // Aparece pegado al botón, encima de todo; se cierra al tocar fuera,
  // al elegir algo o al hacer scroll. Entra con escala/opacidad por JS
  // (sin transición CSS ni blur → sin capas nuevas).
  _openPopMenu(anchor, items, { scrollEl = null } = {}) {
    this._closePopMenu?.();
    const ICONS = {
      edit:  '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      up:    '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
      down:  '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
      order: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
      trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    };
    const wrap = document.createElement('div');
    wrap.className = 'wp-pm2-pop';
    wrap.innerHTML = '<div class="wp-pm2-pop-catch"></div><div class="wp-pm2-pop-menu" role="menu"></div>';
    const menu = wrap.querySelector('.wp-pm2-pop-menu');
    items.forEach(it => {
      if (it.sep) { const d = document.createElement('div'); d.className = 'wp-pm2-pop-sep'; menu.appendChild(d); return; }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wp-pm2-pop-item' + (it.danger ? ' wp-pm2-danger' : '');
      b.disabled = !!it.disabled;
      b.innerHTML = `<span></span>${it.icon ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.icon] || ''}</svg>` : ''}`;
      b.firstChild.textContent = it.label;
      b.onclick = (e) => { e.stopPropagation(); close(); it.onClick?.(); };
      menu.appendChild(b);
    });
    document.body.appendChild(wrap);

    // Posición: alineado a la derecha del botón; abajo si cabe, si no arriba
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vv = window.visualViewport;
    const vTop = vv ? vv.offsetTop : 0, vH = vv ? vv.height : window.innerHeight;
    const left = Math.max(10, Math.min(window.innerWidth - mw - 10, r.right - mw));
    const below = r.bottom + 6 + mh <= vTop + vH - 10;
    const top = below ? r.bottom + 6 : Math.max(vTop + 10, r.top - 6 - mh);
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    menu.style.transformOrigin = `${Math.round(r.left + r.width / 2 - left)}px ${below ? 0 : mh}px`;

    // Entrada: escala 0.85 → 1 y opacidad, por cuadros
    const t0 = performance.now(), D = 170;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / D), k = ease(t);
      menu.style.opacity = String(k);
      menu.style.transform = t < 1 ? `scale(${0.85 + 0.15 * k})` : '';
      if (t < 1) raf = requestAnimationFrame(step);
    };
    menu.style.opacity = '0'; menu.style.transform = 'scale(0.85)';
    raf = requestAnimationFrame(step);

    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      cancelAnimationFrame(raf);
      scrollEl?.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      if (this._closePopMenu === close) this._closePopMenu = null;
      wrap.remove();
    };
    wrap.querySelector('.wp-pm2-pop-catch').addEventListener('pointerdown', (e) => { e.preventDefault(); close(); });
    scrollEl?.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    this._closePopMenu = close;
    return close;
  }

  static get COLLECTION_EMOJIS() {
    // Sin 👨‍👩‍👧 ni 📍 (pedido: nunca usarlos)
    // El primero es el ícono por defecto
    return ['❤️','⭐','💙','🤩','✌️','☕','🥐','🍔','🌮','🍕','🍰','🍦','🍻','🍷','🎉','🎵','🌳','🛍️','🎨','🏋️','🦷','🛺','🛸','👽','👻'];
  }

  async _openCollectionsSheet() {
    const user = this._requireUser('Inicia sesión para usar colecciones');
    if (!user || !this._place) return;
    const place = this._place;
    const pid = place.place_id || place.id;
    const info = this._placeInfo();
    // Si quedó un "eliminar" esperando el Deshacer, se aplica ya (si no,
    // la colección volvería a aparecer al cargar)
    if (this._colDelPending) { try { await this._colDelPending.commit(); } catch (_) {} }
    const { body, close } = this._openSheet('Añadir a una colección', info.name);
    const CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const HEART = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/></svg>';
    const DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
    const GRIP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>';
    const PEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
    const EMOJIS = PlaceModal2.COLLECTION_EMOJIS;

    // Todo en UNA hoja: arriba la lista (se redibuja sola), abajo el
    // campo para crear una colección (no se redibuja: no se pierde lo
    // escrito al marcar/desmarcar otra colección). En modo "Eliminar",
    // el campo se cambia por el botón rojo.
    body.innerHTML = `
      <div class="wp-pm2-col-list"></div>
      <div class="wp-pm2-col-composer">
        <div class="wp-pm2-col-editing" hidden>
          <span>Editando colección</span>
          <button type="button" class="wp-pm2-col-editing-x">Cancelar</button>
        </div>
        <div class="wp-pm2-col-row">
          <div class="wp-pm2-col-field">
            <button type="button" class="wp-pm2-col-pick" aria-label="Elegir ícono"><span class="wp-pm2-col-preview-emoji"></span></button>
            <input class="wp-pm2-col-input2" maxlength="60" placeholder="Nueva colección" enterkeyhint="done" autocapitalize="sentences" autocomplete="off">
            <div class="wp-pm2-col-strip" hidden><div class="wp-pm2-col-strip-track"></div></div>
          </div>
          <button type="button" class="wp-pm2-col-ok" aria-label="Crear colección" disabled>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </button>
        </div>
      </div>
      <div class="wp-pm2-col-bulk" hidden>
        <button type="button" class="wp-pm2-col-bulk-del" disabled>Eliminar</button>
      </div>`;
    const listEl   = body.querySelector('.wp-pm2-col-list');
    const composer = body.querySelector('.wp-pm2-col-composer');
    const bulk     = body.querySelector('.wp-pm2-col-bulk');
    const bulkDel  = body.querySelector('.wp-pm2-col-bulk-del');
    const pick     = body.querySelector('.wp-pm2-col-pick');
    const prevEl   = body.querySelector('.wp-pm2-col-preview-emoji');
    const input    = body.querySelector('.wp-pm2-col-input2');
    const strip    = body.querySelector('.wp-pm2-col-strip');
    const track    = body.querySelector('.wp-pm2-col-strip-track');
    const cta      = body.querySelector('.wp-pm2-col-ok');

    // ── Que la hoja quepa con el teclado abierto ──
    // La lista de colecciones tiene scroll SOLO cuando no cabe, y nunca
    // mientras la hoja sube (un área con scroll dentro de una hoja que se
    // anima es lo que daba glitch en el formulario "¿Es tu negocio?").
    // El alto disponible sale de visualViewport (lo que se ve arriba del
    // teclado); si el WebView no se encoge con el teclado, la hoja se
    // sube lo que tape el teclado.
    const sheetEl = document.getElementById('wp-pm2-menu-sheet');
    const menuEl  = sheetEl?.querySelector('.wp-pm2-ms-menu');
    const header  = sheetEl?.querySelector('.wp-pm2-ms-header');
    const titleEl = header?.querySelector('.wp-pm2-ms-title');
    const subEl   = header?.querySelector('.wp-pm2-ms-sub');
    let fitReady = false, lastDiag = '';
    // Alto de la barra de estado (y de la barra de abajo), el mismo
    // env(safe-area-inset-*) que usa el header de la ficha
    const safe = (() => {
      const pr = document.createElement('div');
      pr.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;' +
        'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(pr);
      const cs = getComputedStyle(pr);
      const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
      pr.remove();
      return r;
    })();
    const fit = () => {
      if (!sheetEl || !sheetEl.isConnected) {
        window.removeEventListener('resize', fit);
        window.visualViewport?.removeEventListener('resize', fit);
        return;
      }
      const vv = window.visualViewport;
      const visH = vv ? vv.height : window.innerHeight;
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      menuEl.style.bottom = kb ? `${kb + 8}px` : '';
      // Dónde queda el borde de abajo de la hoja y hasta dónde puede subir
      // (siempre DEBAJO de la barra de estado, con 12px de aire)
      const vTop = vv ? vv.offsetTop : 0;
      const bottomY = kb ? vTop + visH - 8 : window.innerHeight - 12 - safe.bottom;
      const topY = vTop + safe.top + 12;
      const rest = menuEl.offsetHeight - listEl.offsetHeight; // hoja sin la lista
      const room = Math.floor(bottomY - topY - rest);
      const need = listEl.scrollHeight;
      const scroll = need > room;
      // Mientras sube la hoja: solo recorta (sin área de scroll); al
      // terminar de subir ya se puede deslizar
      listEl.classList.toggle('wp-pm2-col-list-clip', scroll && !fitReady);
      listEl.classList.toggle('wp-pm2-col-list-scroll', scroll && fitReady);
      listEl.style.maxHeight = scroll ? `${Math.max(96, room)}px` : '';
      const d = `inner=${window.innerHeight} vv=${Math.round(visH)} kb=${kb} safeTop=${safe.top} lista=${need}/${room} scroll=${scroll}`;
      if (d !== lastDiag) { lastDiag = d; console.log('[DIAG-KB]', d); } // [DIAG] temporal
    };
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    setTimeout(() => {
      fitReady = true; fit();
      // El cursor ya parpadea en el campo al abrir la hoja (después de
      // subir, no durante la animación)
      if (sheetEl?.isConnected && strip.hidden && mode === 'normal') { try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); } }
    }, 380);
    input.addEventListener('focus', () => setTimeout(fit, 350));

    let cols = null;
    // 'normal' | 'order' (ordenar arrastrando) | 'delete' (elegir cuáles)
    let mode = 'normal';
    let lastAnyOn = null; // para el pulse cuando "Quitar" cambia a "Listo" y viceversa
    const selected = new Set();
    // Lo que muestra el botón de abajo del hero
    const syncBtn = () => {
      if (!cols || this._place !== place) return;
      this._placeCols = cols.filter(c => c.has).map(c => ({ id: c.id, name: c.name, emoji: c.emoji }));
      this._renderFavUI(false);
    };

    // ── Botón del header (arriba a la derecha) ──
    // Normal: ⋯ con "Ordenar" y "Eliminar". En un modo: ✓ (listo) o ✕.
    const hbtn = document.createElement('button');
    hbtn.type = 'button';
    hbtn.className = 'wp-pm2-col-hbtn';
    header?.classList.add('wp-pm2-col-header');
    header?.appendChild(hbtn);
    const paintHeader = () => {
      hbtn.classList.toggle('wp-pm2-done', mode === 'order' || mode === 'edit');
      hbtn.classList.toggle('wp-pm2-x', mode === 'delete');
      hbtn.classList.toggle('wp-pm2-pill', mode !== 'normal');
      const done = mode === 'order' || mode === 'edit';
      hbtn.innerHTML = done ? 'Listo' : mode === 'delete' ? 'Cancelar' : DOTS;
      hbtn.setAttribute('aria-label', done ? 'Listo' : mode === 'delete' ? 'Cancelar' : 'Opciones');
      hbtn.style.display = (mode === 'normal' && !(cols && cols.length)) ? 'none' : '';
      const T = {
        order:  ['Ordenar colecciones', 'Mantén presionada una y arrástrala'],
        edit:   ['Editar colecciones', 'Toca una para cambiar su nombre o ícono'],
        delete: ['Eliminar colecciones', 'Elige cuáles quieres eliminar'],
      }[mode] || ['Añadir a una colección', info.name];
      if (titleEl) titleEl.textContent = T[0];
      if (subEl) subEl.textContent = T[1];
    };
    hbtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true }); // no arrastra la hoja
    hbtn.onclick = (e) => {
      e.stopPropagation();
      this._scaleKeys(hbtn, [0.88, 1.06, 1], 240);
      if (mode !== 'normal') { setMode('normal'); return; }
      this._haptic('light');
      this._openPopMenu(hbtn, [
        { label: 'Editar colecciones', icon: 'edit', onClick: () => setMode('edit') },
        { label: 'Ordenar colecciones', icon: 'order', disabled: cols.length < 2, onClick: () => setMode('order') },
        { label: 'Eliminar colecciones', icon: 'trash', danger: true, onClick: () => setMode('delete') },
      ]);
    };
    const setMode = (m) => {
      if (m === mode) return;
      mode = m;
      selected.clear();
      openRow?.close(false);
      if (m !== 'normal') { input.blur(); if (editing) setEditing(null); if (!strip.hidden) { strip.hidden = true; input.style.visibility = ''; pick.classList.remove('wp-pm2-on'); } }
      composer.hidden = m !== 'normal'; // en "Editar" aparece al tocar una
      bulk.hidden = m !== 'delete';
      paintBulk();
      paintHeader();
      this._haptic('light');
      renderList();
      // Las colecciones "despiertan" con un pulse escalonado: se ve que
      // ahora se pueden tocar / arrastrar
      if (m !== 'normal') listEl.querySelectorAll('.wp-pm2-col-sw').forEach((el, i) =>
        setTimeout(() => el.isConnected && this._scaleKeys(el, [0.96, 1.015, 1], 240), i * 35));
    };
    const paintBulk = () => {
      const n = selected.size;
      bulkDel.disabled = !n;
      bulkDel.textContent = !n ? 'Eliminar' : n === 1 ? 'Eliminar 1 colección' : `Eliminar ${n} colecciones`;
    };
    bulkDel.onclick = () => {
      const list = cols.filter(c => selected.has(c.id));
      if (!list.length) return;
      setMode('normal');
      deleteCols(list);
    };

    // ── Swipe a la izquierda en una colección → [Editar] [Eliminar] ──
    // Una abierta a la vez. Se mueve con translate3d solo mientras el dedo
    // la arrastra o se anima; en reposo queda en translateX 2D (sin capa
    // propia, igual que la galería).
    let openRow = null;
    const animX = (el, from, to, done) => {
      const t0 = performance.now(), D = 200;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - t, 3);
        const x = from + (to - from) * k;
        el.style.transform = t < 1 ? `translate3d(${x}px,0,0)` : (to ? `translateX(${to}px)` : '');
        if (t < 1) requestAnimationFrame(step); else done?.();
      };
      requestAnimationFrame(step);
    };
    const wireSwipe = (wrap, content, acts) => {
      let id = null, x0 = 0, y0 = 0, base = 0, x = 0, horiz = null, moved = false, samples = [];
      const W = () => acts.offsetWidth + 10;
      const api = {
        open: false,
        close: (anim = true) => {
          if (!api.open) return;
          api.open = false;
          if (openRow === api) openRow = null;
          const off = () => wrap.classList.remove('wp-pm2-swiping');
          if (anim) animX(content, x, 0, off); else { content.style.transform = ''; off(); }
          x = 0;
        },
      };
      content.addEventListener('pointerdown', e => {
        if (mode !== 'normal' || (e.pointerType === 'mouse' && e.button !== 0)) return;
        id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
        base = api.open ? -W() : 0; x = base; horiz = null; moved = false;
        samples = [[e.timeStamp, e.clientX]];
      });
      content.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (horiz === null) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          horiz = Math.abs(dx) > Math.abs(dy) * 1.3;
          if (!horiz) { id = null; return; }
          moved = true;
          wrap.classList.add('wp-pm2-swiping');
          if (openRow && openRow !== api) openRow.close();
          try { content.setPointerCapture(id); } catch (_) {}
        }
        const w = W();
        let nx = base + dx;
        if (nx > 0) nx *= 0.3;                       // hacia la derecha: resistencia
        if (nx < -w) nx = -w + (nx + w) * 0.35;      // más allá de los botones: resistencia
        x = nx;
        content.style.transform = `translate3d(${x}px,0,0)`;
        samples.push([e.timeStamp, e.clientX]); if (samples.length > 5) samples.shift();
      });
      const end = e => {
        if (e.pointerId !== id) return;
        id = null;
        if (!horiz) return;
        const w = W();
        const a = samples[0], b = samples[samples.length - 1];
        const vel = b && a && b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; // px/ms
        const open = vel < -0.4 ? true : vel > 0.4 ? false : x < -w / 2;
        const wasOpen = api.open;
        animX(content, x, open ? -w : 0, open ? null : () => wrap.classList.remove('wp-pm2-swiping'));
        x = open ? -w : 0;
        api.open = open;
        if (open) {
          openRow = api;
          this._haptic('light');
          // Los botones aparecen con pulse, uno tras otro
          if (!wasOpen) acts.querySelectorAll('.wp-pm2-col-act').forEach((b, i) =>
            setTimeout(() => this._scaleKeys(b, [0.5, 1.15, 1], 260), i * 50));
          try { localStorage.setItem('wp_col_swipe_hint', '1'); } catch (_) {}
        } else if (openRow === api) openRow = null;
      };
      content.addEventListener('pointerup', end);
      content.addEventListener('pointercancel', end);
      // El "click" que llega después de deslizar no marca la colección
      content.addEventListener('click', e => {
        if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
      }, true);
      return api;
    };

    // ── Modo ordenar: mantener presionada (o tomar de ≡) y arrastrar ──
    let drag = null;
    const blockScroll = (e) => { if (drag?.active) e.preventDefault(); };
    listEl.addEventListener('touchmove', blockScroll, { passive: false });
    const wireOrder = (wrap, c) => {
      let timer = null, sx = 0, sy = 0;
      const begin = (e) => {
        const wraps = [...listEl.querySelectorAll('.wp-pm2-col-sw')];
        const from = wraps.indexOf(wrap);
        if (from < 0) return;
        const h = wrap.offsetHeight + (parseFloat(getComputedStyle(wrap).marginBottom) || 0);
        drag = { active: true, c, wrap, wraps, from, to: from, h, y0: e.clientY, s0: listEl.scrollTop, y: e.clientY, raf: 0 };
        wrap.classList.add('wp-pm2-dragging');
        wraps.forEach(w => { if (w !== wrap) w.classList.add('wp-pm2-shift'); });
        try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
        this._haptic('medium');
        place_(e.clientY);
        // Auto-scroll al acercarse a la orilla de la lista
        const tick = () => {
          if (!drag?.active) return;
          const r = listEl.getBoundingClientRect();
          const edge = 44;
          let v = 0;
          if (drag.y < r.top + edge) v = -Math.ceil((r.top + edge - drag.y) / 6);
          else if (drag.y > r.bottom - edge) v = Math.ceil((drag.y - (r.bottom - edge)) / 6);
          if (v && listEl.scrollHeight > listEl.clientHeight) { listEl.scrollTop += v; place_(drag.y); }
          drag.raf = requestAnimationFrame(tick);
        };
        drag.raf = requestAnimationFrame(tick);
      };
      const place_ = (y) => {
        drag.y = y;
        const dy = y - drag.y0 + (listEl.scrollTop - drag.s0);
        const n = drag.wraps.length;
        const to = Math.max(0, Math.min(n - 1, Math.round(drag.from + dy / drag.h)));
        drag.wrap.style.transform = `translate3d(0,${dy}px,0)`;
        if (to !== drag.to) { drag.to = to; this._haptic('light'); }
        // Los demás se recorren con "top" (no transform → sin capas)
        drag.wraps.forEach((w, i) => {
          if (w === drag.wrap) return;
          let shift = 0;
          if (drag.from < to && i > drag.from && i <= to) shift = -drag.h;
          if (drag.from > to && i >= to && i < drag.from) shift = drag.h;
          w.style.top = shift ? `${shift}px` : '';
        });
      };
      const finish = async () => {
        clearTimeout(timer); timer = null;
        if (!drag?.active || drag.wrap !== wrap) return;
        const d = drag; drag = null;
        cancelAnimationFrame(d.raf);
        if (d.to !== d.from) {
          cols.splice(d.from, 1);
          cols.splice(d.to, 0, d.c);
        }
        renderList();
        const moved = listEl.querySelectorAll('.wp-pm2-col-sw')[d.to];
        if (moved) this._scaleKeys(moved, [1.03, 0.98, 1], 240);
        if (d.to !== d.from) {
          try { await FavoriteService.reorderCollections(cols.map(x => x.id)); }
          catch (e) { console.error('[PM2] Ordenar colecciones:', e); this._showToast('No se pudo guardar el orden'); }
        }
      };
      wrap.addEventListener('pointerdown', e => {
        if (mode !== 'order' || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        sx = e.clientX; sy = e.clientY;
        // Desde ≡ arranca de una; desde la fila, después de mantener
        if (e.target.closest('.wp-pm2-col-grip')) { begin(e); return; }
        timer = setTimeout(() => { timer = null; begin(e); }, 220);
      });
      wrap.addEventListener('pointermove', e => {
        if (drag?.active && drag.wrap === wrap) { place_(e.clientY); return; }
        if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
      });
      wrap.addEventListener('pointerup', finish);
      wrap.addEventListener('pointercancel', finish);
      wrap.addEventListener('contextmenu', e => e.preventDefault());
    };

    const renderList = () => {
      openRow = null;
      listEl.innerHTML = '';
      if (mode === 'normal') {
        const favRow = document.createElement('div');
        favRow.className = 'wp-pm2-ms-opt';
        favRow.style.cursor = 'default';
        // Con alguna colección marcada el botón es "Listo" (todo ya se
        // guardó al tocar; solo cierra). Sin ninguna, "Quitar" de favoritos.
        const anyOn = !!(cols && cols.some(c => c.has));
        favRow.innerHTML = `<span class="wp-pm2-ms-ico wp-pm2-col-fav-ico">${HEART}</span><span>En tus favoritos</span>` +
          `<button class="wp-pm2-col-unfav${anyOn ? ' wp-pm2-col-done' : ''}">${anyOn ? 'Listo' : 'Quitar'}</button>`;
        const fb = favRow.querySelector('.wp-pm2-col-unfav');
        fb.onclick = () => {
          if (anyOn) { this._scaleKeys(fb, [0.88, 1.06, 1], 200); close(); return; }
          close(); this._setFavorite(false, { undo: true });
        };
        if (lastAnyOn !== null && lastAnyOn !== anyOn) this._scaleKeys(fb, [0.7, 1.12, 1], 280);
        lastAnyOn = anyOn;
        listEl.appendChild(favRow);
        const sep = document.createElement('div'); sep.className = 'wp-pm2-col-sep'; listEl.appendChild(sep);
      }
      if (cols === null) {
        const p = document.createElement('p'); p.className = 'wp-pm2-col-empty'; p.textContent = 'Cargando colecciones…';
        listEl.appendChild(p);
        paintHeader();
        return;
      }
      if (!cols.length) {
        const p = document.createElement('p'); p.className = 'wp-pm2-col-empty';
        p.textContent = 'Aún no tienes colecciones. Crea una abajo para agrupar lugares, por ejemplo "☕ Cafés para trabajar".';
        listEl.appendChild(p);
        paintHeader(); fit();
        return;
      }
      cols.forEach(c => {
        const wrap = document.createElement('div');
        wrap.className = 'wp-pm2-col-sw';
        wrap.dataset.id = c.id;
        const row = document.createElement('div');
        row.className = 'wp-pm2-ms-opt wp-pm2-col-row-item';
        row.setAttribute('role', 'button');
        if (mode === 'normal') {
          row.innerHTML = `<span class="wp-pm2-col-emoji"></span><span class="wp-pm2-col-name"></span>
            <span class="wp-pm2-col-meta"><span>${c.count}</span><span class="wp-pm2-col-check${c.has ? ' wp-pm2-on' : ''}">${CHECK}</span></span>`;
          const acts = document.createElement('div');
          acts.className = 'wp-pm2-col-acts';
          acts.innerHTML = `<button type="button" class="wp-pm2-col-act wp-pm2-col-act-edit" aria-label="Editar">${PEN}</button>
            <button type="button" class="wp-pm2-col-act wp-pm2-col-act-del" aria-label="Eliminar">${TRASH}</button>`;
          wrap.appendChild(acts);
          wrap.appendChild(row);
          const sw = wireSwipe(wrap, row, acts);
          acts.querySelector('.wp-pm2-col-act-edit').onclick = () => { sw.close(); startEdit(c); };
          acts.querySelector('.wp-pm2-col-act-del').onclick = () => deleteCols([c]);
          row.onclick = () => {
            if (sw.open) { sw.close(); return; }       // tocar la fila abierta = cerrar
            if (openRow) { openRow.close(); return; }  // otra abierta: solo se cierra
            pulseTile(c.id);
            toggle(c);
          };
        } else {
          const sel = mode === 'delete' && selected.has(c.id);
          wrap.classList.add('wp-pm2-col-tile');
          if (sel) wrap.classList.add('wp-pm2-sel');
          row.innerHTML = (mode === 'delete' ? `<span class="wp-pm2-col-selbox">${CHECK}</span>` : '') +
            `<span class="wp-pm2-col-emoji"></span><span class="wp-pm2-col-name"></span>` +
            (mode === 'order' ? `<span class="wp-pm2-col-grip" aria-hidden="true">${GRIP}</span>`
              : mode === 'edit' ? `<span class="wp-pm2-col-grip wp-pm2-col-pen" aria-hidden="true">${PEN}</span>`
              : `<span class="wp-pm2-col-meta"><span>${c.count}</span></span>`);
          if (mode === 'edit' && editing === c) wrap.classList.add('wp-pm2-editing');
          wrap.appendChild(row);
          if (mode === 'edit') {
            row.onclick = () => {
              this._haptic('light');
              startEdit(c);
              renderList();
              pulseTile(c.id);
            };
          } else if (mode === 'delete') {
            row.onclick = () => {
              if (selected.has(c.id)) selected.delete(c.id); else selected.add(c.id);
              this._haptic('light');
              wrap.classList.toggle('wp-pm2-sel', selected.has(c.id));
              this._scaleKeys(row.querySelector('.wp-pm2-col-selbox'), [0.7, 1.15, 1], 240);
              paintBulk();
            };
          } else {
            wireOrder(wrap, c);
          }
        }
        row.querySelector('.wp-pm2-col-emoji').textContent = c.emoji || '❤️';
        row.querySelector('.wp-pm2-col-name').textContent = c.name;
        listEl.appendChild(wrap);
      });
      // Pista del swipe, hasta que se use la primera vez
      let hintDone = false; try { hintDone = localStorage.getItem('wp_col_swipe_hint') === '1'; } catch (_) {}
      if (mode === 'normal' && !hintDone) {
        const p = document.createElement('p'); p.className = 'wp-pm2-col-hint';
        p.textContent = 'Desliza una colección a la izquierda para editarla o eliminarla';
        listEl.appendChild(p);
      }
      paintHeader();
      fit();
    };

    // Editar: usa el mismo campo de abajo, ya lleno con el nombre y el ícono
    let editing = null;
    const editBar = body.querySelector('.wp-pm2-col-editing');
    const setEditing = (c) => {
      const prev = editing;
      editing = c;
      editBar.hidden = !c;
      if (mode === 'edit') {
        composer.hidden = !c;
        if (prev && !c) renderList(); // se quita el resaltado
      }
      input.placeholder = c ? 'Nombre de la colección' : 'Nueva colección';
      cta.setAttribute('aria-label', c ? 'Guardar cambios' : 'Crear colección');
      if (c) {
        input.value = c.name;
        emoji = c.emoji || EMOJIS[0]; paint();
      } else {
        input.value = '';
        emoji = EMOJIS[0]; paint();
      }
      if (!strip.hidden) setPicking(false);
      cta.disabled = !input.value.trim();
      fit();
    };
    const startEdit = (c) => {
      setEditing(c);
      try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
    };
    body.querySelector('.wp-pm2-col-editing-x').onclick = () => { setEditing(null); input.blur(); };

    // ── Eliminar (una o varias) con "Deshacer" ──
    // Desaparecen de la lista al momento; se borran de verdad cuando se
    // va el aviso (≈4s). Deshacer las regresa a su lugar.
    const deleteCols = (list) => {
      if (this._colDelPending) this._colDelPending.commit();
      const snap = list.map(c => [c, cols.indexOf(c)]).sort((a, b) => a[1] - b[1]);
      const ids = new Set(list.map(c => c.id));
      cols = cols.filter(c => !ids.has(c.id));
      if (editing && ids.has(editing.id)) setEditing(null);
      this._haptic('warning');
      renderList(); syncBtn();
      const pend = {
        commit: async () => {
          if (this._colDelPending !== pend) return;
          clearTimeout(pend.timer);
          this._colDelPending = null;
          try {
            await Promise.all(list.map(c => FavoriteService.deleteCollection(c.id)));
          } catch (e) {
            console.error('[PM2] Eliminar colección:', e);
            this._showToast('No se pudo eliminar');
            if (body.isConnected) { snap.forEach(([c, i]) => cols.splice(Math.min(i, cols.length), 0, c)); renderList(); syncBtn(); }
          }
        },
      };
      pend.timer = setTimeout(() => pend.commit(), 4300);
      this._colDelPending = pend;
      const msg = list.length === 1 ? `"${list[0].name}" eliminada` : `${list.length} colecciones eliminadas`;
      this._showToast(msg, {
        label: 'Deshacer',
        onClick: () => {
          if (this._colDelPending !== pend) return;
          clearTimeout(pend.timer);
          this._colDelPending = null;
          if (body.isConnected) {
            snap.forEach(([c, i]) => cols.splice(Math.min(i, cols.length), 0, c));
            renderList(); syncBtn();
          }
        },
      });
    };

    // Pulse + gris suave en la tarjeta tocada (después de redibujar la lista)
    const pulseTile = (id) => requestAnimationFrame(() => {
      const w = listEl.querySelector(`.wp-pm2-col-sw[data-id="${CSS.escape(String(id))}"]`);
      if (!w) return;
      w.classList.add('wp-pm2-tap');
      this._scaleKeys(w, [0.96, 1.015, 1], 260);
      setTimeout(() => w.classList.remove('wp-pm2-tap'), 220);
    });

    const toggle = async (c) => {
      const was = c.has;
      c.has = !was; c.count += was ? -1 : 1;
      this._haptic('light');
      renderList(); syncBtn();
      try {
        if (was) await FavoriteService.removeFromCollection(c.id, pid);
        else     await FavoriteService.addToCollection(c.id, pid);
        this._showToast(was ? `Quitado de "${c.name}"` : `✓ Añadido a ${c.emoji || ''} ${c.name}`.replace(/\s+/g, ' '));
      } catch (e) {
        console.error('[PM2] Colección:', e);
        c.has = was; c.count += was ? 1 : -1; renderList(); syncBtn();
        this._showToast('No se pudo guardar');
      }
    };

    // ── Campo: [emoji] Nueva colección ──
    // Tocar el emoji abre los demás a su derecha (dentro del mismo campo)
    // con deslizamiento horizontal; cada uno que tocas se pone en el
    // botón con un pulse. Tocar el emoji otra vez regresa a escribir.
    let emoji = EMOJIS[0];
    const paint = () => {
      prevEl.textContent = emoji;
      track.querySelectorAll('button').forEach(b => b.classList.toggle('wp-pm2-on', b.dataset.e === emoji));
    };
    EMOJIS.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.e = e; b.textContent = e;
      b.onclick = () => {
        emoji = e; paint();
        this._haptic('light');
        this._scaleKeys(pick, [0.75, 1.15, 1], 300);
        this._scaleKeys(b, [0.7, 1.18, 1], 280);   // el elegido también late
      };
      track.appendChild(b);
    });
    paint();
    // Arrastre hecho con JS (sin scroll nativo: no crea capa → sin glitch)
    this._wireStripDrag(strip, { register: false });
    const setPicking = (on) => {
      strip.hidden = !on;
      input.style.visibility = on ? 'hidden' : '';
      pick.classList.toggle('wp-pm2-on', on);
      if (on) input.blur(); else input.focus();
    };
    pick.onclick = () => { this._haptic('light'); setPicking(strip.hidden); };
    input.oninput = () => {
      const was = cta.disabled;
      cta.disabled = !input.value.trim();
      if (was && !cta.disabled) this._scaleKeys(cta, [0.85, 1.08, 1], 260); // se "enciende"
    };
    input.onkeydown = (e) => { if (e.key === 'Enter' && !cta.disabled) cta.click(); };

    // Primera letra en mayúscula (el teclado ya la propone; esto la
    // asegura aunque se escriba o pegue en minúsculas)
    const cap = (v) => v.replace(/^(\s*)(\S)/, (m, sp, ch) => sp + ch.toLocaleUpperCase('es'));
    input.addEventListener('input', () => {
      const v = cap(input.value);
      if (v !== input.value) {
        const a = input.selectionStart, b = input.selectionEnd;
        input.value = v; try { input.setSelectionRange(a, b); } catch (_) {}
      }
    });
    cta.onclick = async () => {
      const name = cap(input.value.trim());
      if (!name) return;
      cta.disabled = true; cta.classList.add('wp-pm2-busy');
      if (editing) {
        const c = editing, before = { name: c.name, emoji: c.emoji };
        c.name = name; c.emoji = emoji;
        renderList(); syncBtn();
        try {
          await FavoriteService.updateCollection(c.id, { name, emoji });
          this._showToast('Colección actualizada');
          setEditing(null); input.blur();
        } catch (e) {
          console.error('[PM2] Editar colección:', e);
          Object.assign(c, before); renderList(); syncBtn();
          this._showToast('No se pudo guardar');
          cta.disabled = false;
        }
        cta.classList.remove('wp-pm2-busy');
        return;
      }
      try {
        const c = await FavoriteService.createCollection(user.id, name, emoji);
        await FavoriteService.addToCollection(c.id, pid);
        cols = [...(cols || []), { id: c.id, name: c.name, emoji: c.emoji || emoji, count: 1, has: true }];
        renderList(); syncBtn();
        this._showToast(`✓ Añadido a ${emoji} ${c.name}`);
        // Campo listo para otra
        input.value = ''; input.blur();
        emoji = EMOJIS[0]; paint();
        if (!strip.hidden) setPicking(false), input.blur();
        cta.classList.remove('wp-pm2-busy'); cta.disabled = true;
      } catch (e) {
        console.error('[PM2] Nueva colección:', e);
        cta.classList.remove('wp-pm2-busy'); cta.disabled = false;
        this._showToast('No se pudo crear la colección');
      }
    };

    renderList();
    try {
      cols = await FavoriteService.getCollections(user.id, pid);
    } catch (e) {
      console.error('[PM2] Colecciones:', e);
      cols = [];
      this._showToast('No se pudieron cargar tus colecciones');
    }
    if (body.isConnected) { renderList(); syncBtn(); }
  }

  // ── "¿ES TU NEGOCIO?" ──────────────────────────────────────────────
  async _loadMyClaim(place) {
    this._myClaim = null;
    const uid = this.getCurrentUser?.()?.id || null;
    if (!uid || place.owner_id) return;
    try {
      const c = await PlaceClaimService.getMyClaim(place.place_id || place.id, uid);
      if (this._place === place) this._myClaim = c;
    } catch (e) {
      console.warn('[PM2] Solicitudes de dueño no disponibles:', e.message || e);
    }
  }

  _openClaimSheet() {
    const user = this._requireUser('Inicia sesión para continuar');
    if (!user || !this._place) return;
    const place = this._place;
    const info = this._placeInfo();
    const displayName = user.user_metadata?.full_name || user.user_metadata?.display_name || '';

    // Sin animación: es la única hoja alta (formulario) y con animación el
    // teléfono la mostraba con glitch (confirmado antes con 'noanim').
    const { body, close } = this._openSheet('¿Es tu negocio?', info.name, { instant: true });
    // Scroll interno SOLO si el formulario no cabe (p.ej. con el teclado
    // abierto) y nunca durante la animación de subida: un área con scroll
    // dentro de una hoja que se anima hace que el WebView de Android la
    // dibuje con glitch (se confirmó con [DIAG-SHEET]: ningún elemento
    // tapaba la hoja, y el glitch solo quedaba en esta hoja, la única con
    // scroll). Se revisa al terminar de subir y en cada resize (teclado).
    const sheetEl = document.getElementById('wp-pm2-menu-sheet');
    const menuEl  = sheetEl?.querySelector('.wp-pm2-ms-menu');
    const fit = () => {
      if (!sheetEl || !sheetEl.isConnected) { window.removeEventListener('resize', fit); return; }
      // Alto natural de la hoja (sin el límite que pone .wp-pm2-ms-tall)
      const natural = menuEl.offsetHeight - body.clientHeight + body.scrollHeight;
      sheetEl.classList.toggle('wp-pm2-ms-tall', natural > window.innerHeight - 24);
    };
    requestAnimationFrame(fit); // sin animación: se mide ya
    window.addEventListener('resize', fit);
    body.innerHTML = `
      <div class="wp-pm2-cl">
        <p class="wp-pm2-cl-intro">Verifícalo para responder reseñas como dueño, mantener la información al día y mostrar la insignia <b>✓ Verificado</b>.</p>
        <label class="wp-pm2-cl-field">
          <span>Tu nombre completo</span>
          <input class="wp-pm2-cl-input" data-f="name" type="text" maxlength="120" autocomplete="name">
        </label>
        <div class="wp-pm2-cl-field">
          <span>Tu rol</span>
          <div class="wp-pm2-cl-roles">
            <button type="button" class="wp-pm2-cl-role" data-role="owner">Dueño</button>
            <button type="button" class="wp-pm2-cl-role" data-role="manager">Gerente</button>
            <button type="button" class="wp-pm2-cl-role" data-role="staff">Encargado</button>
          </div>
        </div>
        <label class="wp-pm2-cl-field">
          <span>Teléfono de contacto</span>
          <input class="wp-pm2-cl-input" data-f="phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel">
        </label>
        <label class="wp-pm2-cl-field">
          <span>Correo</span>
          <input class="wp-pm2-cl-input" data-f="email" type="email" maxlength="160" autocomplete="email" inputmode="email">
        </label>
        <label class="wp-pm2-cl-field">
          <span>Mensaje <em>(opcional)</em></span>
          <textarea class="wp-pm2-cl-input" data-f="msg" rows="2" maxlength="500" placeholder="Ej. Soy el dueño desde 2019"></textarea>
        </label>
        <p class="wp-pm2-cl-note">Para confirmar, te contactaremos o llamaremos al teléfono público del negocio. Tus datos solo los ve el equipo de WhatsPlan.</p>
        <button class="wp-pm2-cl-submit" disabled>Enviar solicitud</button>
      </div>`;

    const q = (sel) => body.querySelector(sel);
    const nameI = q('[data-f="name"]'), phoneI = q('[data-f="phone"]'), emailI = q('[data-f="email"]'), msgI = q('[data-f="msg"]');
    const submit = q('.wp-pm2-cl-submit');
    nameI.value = displayName;
    emailI.value = user.email || '';
    let role = null;

    const valid = () =>
      nameI.value.trim().length >= 2 &&
      !!role &&
      phoneI.value.replace(/\D/g, '').length >= 8 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailI.value.trim());
    const refresh = () => { submit.disabled = !valid(); };
    [nameI, phoneI, emailI].forEach(i => i.addEventListener('input', refresh));
    body.querySelectorAll('.wp-pm2-cl-role').forEach(b => {
      b.onclick = () => {
        role = b.dataset.role;
        body.querySelectorAll('.wp-pm2-cl-role').forEach(x => x.classList.toggle('wp-pm2-on', x === b));
        refresh();
      };
    });
    refresh();

    submit.onclick = async () => {
      if (!valid()) return;
      submit.disabled = true;
      submit.textContent = 'Enviando...';
      try {
        const row = await PlaceClaimService.submit({
          placeId:   place.place_id || place.id,
          placeName: info.name,
          userId:    user.id,
          fullName:  nameI.value.trim(),
          role,
          phone:     phoneI.value.trim(),
          email:     emailI.value.trim(),
          message:   msgI.value.trim(),
        });
        if (this._place === place) this._myClaim = row || { status: 'pending' };
        close();
        this._showToast('Recibimos tu solicitud. Te contactaremos pronto');
      } catch (e) {
        console.error('[PM2] Solicitud de dueño:', e);
        this._showToast('No se pudo enviar la solicitud');
        submit.disabled = false;
        submit.textContent = 'Enviar solicitud';
      }
    };
  }

  _openPlaceReportSheet() {
    const user = this._requireUser('Inicia sesión para reportar');
    if (!user || !this._place) return;
    const place = this._place;
    const REASONS = [
      ['closed',               'Cerró permanentemente'],
      ['wrong_info',           'Horario o datos incorrectos'],
      ['wrong_location',       'Ubicación incorrecta'],
      ['inappropriate_photos', 'Fotos inapropiadas'],
      ['other',                'Otro problema'],
    ];
    this._openOptions('¿Qué problema tiene el lugar?', 'Nos ayuda a mantener la información al día', REASONS.map(([reason, label]) => ({
      label,
      action: async () => {
        try {
          await ReviewService.reportPlace(place.place_id || place.id, user.id, reason);
          this._showToast('Gracias, lo revisaremos');
        } catch (e) {
          console.error('[PM2] Reportar lugar:', e);
          this._showToast('No se pudo enviar el reporte');
        }
      },
    })));
  }

  async _confirmDeleteReview() {
    const user = this._requireUser('Inicia sesión');
    if (!user || !this._place) return;
    const ok = await this._confirmSheet('¿Eliminar tu reseña?', 'También se borrarán sus reacciones y respuestas de la vista. No se puede deshacer.', 'Eliminar');
    if (!ok) return;
    const place = this._place;
    try {
      await ReviewService.delete(place.place_id || place.id, user.id);
      this._communityRaw = (this._communityRaw || []).filter(r => r.user_id !== user.id);
      this._renderCommunityPanel(place);
      this._showToast('Reseña eliminada');
    } catch (e) {
      console.error('[PM2] Eliminar reseña:', e);
      this._showToast('No se pudo eliminar');
    }
  }

  async _confirmDeleteReply(key, reply) {
    const ok = await this._confirmSheet('¿Eliminar tu respuesta?', 'No se puede deshacer.', 'Eliminar');
    if (ok) this._deleteReply(key, reply.id);
  }

  // parentKey: si es una respuesta, la reseña donde vive (para redibujar
  // solo ese hilo); null si se reporta una reseña.
  _openReportSheet(reportKey, parentKey) {
    const user = this._requireUser('Inicia sesión para reportar');
    if (!user || !this._place) return;
    const REASONS = [
      ['spam',       'Spam o publicidad'],
      ['offensive',  'Ofensivo o acoso'],
      ['off_topic',  'No es sobre este lugar'],
      ['false_info', 'Información falsa'],
      ['other',      'Otro motivo'],
    ];
    const place = this._place;
    this._openOptions('¿Por qué lo reportas?', 'Tu reporte es anónimo', REASONS.map(([reason, label]) => ({
      label,
      action: async () => {
        try {
          await ReviewService.report(reportKey, place.place_id || place.id, user.id, reason);
          if (this._mod) this._mod.myReports.add(reportKey);
          else this._mod = { hidden: new Set(), myReports: new Set([reportKey]), blocked: new Set() };
          if (this._place !== place) return;
          if (parentKey) this._renderReviewSocial(parentKey);
          else this._renderCommunityPanel(place);
          this._showToast('Gracias, lo revisaremos');
          // Ya no se oculta: se redibuja marcado "En revisión" (solo para
          // quien reportó; los demás lo siguen viendo normal)
        } catch (e) {
          console.error('[PM2] Reportar:', e);
          this._showToast('No se pudo enviar el reporte');
        }
      },
    })));
  }

  async _withdrawReport(reportKey, parentKey) {
    const user = this._requireUser('Inicia sesión');
    if (!user || !this._place) return;
    const place = this._place;
    const unmark = () => {
      this._mod?.myReports.delete(reportKey);
      this._revealed?.delete(reportKey);
      if (this._place !== place) return;
      if (parentKey) this._renderReviewSocial(parentKey);
      else this._renderCommunityPanel(place);
    };
    try {
      const removed = await ReviewService.withdrawReport(reportKey, user.id);
      unmark();
      this._showToast(removed ? 'Reporte retirado' : 'Ese reporte ya fue revisado');
    } catch (e) {
      console.error('[PM2] Retirar reporte:', e);
      this._showToast('No se pudo retirar el reporte');
    }
  }

  async _confirmBlock(blockedId, name) {
    const user = this._requireUser('Inicia sesión');
    if (!user || !this._place) return;
    const ok = await this._confirmSheet(
      `¿Bloquear a ${name}?`,
      'Dejarás de ver sus reseñas, respuestas y reacciones en todos los lugares. No se le notificará.',
      'Bloquear'
    );
    if (!ok) return;
    const place = this._place;
    try {
      await ReviewService.blockUser(user.id, blockedId);
      if (!this._mod) this._mod = { hidden: new Set(), myReports: new Set(), blocked: new Set() };
      this._mod.blocked.add(blockedId);
      if (this._place !== place) return;
      this._renderCommunityPanel(place);
      (this._reviewCards || new Map()).forEach((_, k) => this._renderReviewSocial(k));
      this._showToast(`${name} bloqueado`);
    } catch (e) {
      console.error('[PM2] Bloquear:', e);
      this._showToast('No se pudo bloquear');
    }
  }

  // Lightbox — carrusel de fotos a pantalla completa. Arranca en el índice
  // de la foto que se tocó, con scroll-snap para el swipe entre fotos.
  _openLightbox(startIndex) {
    const photos = this._lbPhotos || [];
    if (!photos.length) return;
    const lb    = this._lightboxEl;
    const track = this._lightboxEl.querySelector('#wp-pm2-lb-track');
    const counter = this._lightboxEl.querySelector('#wp-pm2-lb-counter');

    track.innerHTML = '';
    photos.forEach(url => {
      const slide = document.createElement('div');
      slide.className = 'wp-pm2-lb-slide';
      const img = document.createElement('img');
      img.src = url; img.alt = '';
      slide.appendChild(img);
      track.appendChild(slide);
    });

    const updateCounter = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      counter.textContent = `${Math.min(i + 1, photos.length)} / ${photos.length}`;
    };
    track.onscroll = () => {
      clearTimeout(this._lbScrollTimer);
      this._lbScrollTimer = setTimeout(updateCounter, 50);
    };

    lb.classList.add('visible');
    document.body.style.overflow = 'hidden';
    // Saltar directo al índice tocado, sin animación
    requestAnimationFrame(() => {
      track.scrollLeft = startIndex * track.clientWidth;
      updateCounter();
    });
  }

  _closeLightbox() {
    const lb = this._lightboxEl;
    lb.classList.remove('visible');
    document.body.style.overflow = '';
    const track = this._lightboxEl.querySelector('#wp-pm2-lb-track');
    track.innerHTML = ''; // libera memoria de las imágenes
  }

  isVisible() { return this._el?.classList.contains('visible'); }
}

export { PlaceModal2 as PlaceModal };