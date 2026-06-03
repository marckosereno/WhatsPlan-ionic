// ====================================================================
// WHATSPLAN — PlaceModalSheet.js
// Wrapper que convierte PlaceModal en ion-modal nativo con breakpoints
// ====================================================================

export class PlaceModalSheet {
  constructor(placeModal) {
    this._pm      = placeModal;   // instancia de PlaceModal existente
    this._ionModal= null;
    this._place   = null;
  }

  // ── Crear el ion-modal una sola vez ──────────────────────────────
  async _build() {
    if (this._ionModal) return;

    // Mover el contenido del PlaceModal dentro de un ion-modal
    const modal = document.createElement('ion-modal');

    // Breakpoints:
    // 0    → cerrado
    // 0.50 → compact  — fotos + stats + nombre + botones
    // 0.92 → expanded — todo el contenido, reseñas, horarios
    modal.breakpoints        = [0, 0.50, 0.92];
    modal.initialBreakpoint  = 0.50;
    modal.handle             = true;
    modal.handleBehavior     = 'cycle';   // toca el handle → cicla entre breakpoints
    modal.backdropBreakpoint = 0.01;      // backdrop desde el primer pixel
    modal.backdropDismiss    = true;

    // Inyectar el contenido del PlaceModal en el ion-modal
    const content = document.createElement('ion-content');
    content.setAttribute('scroll-y', 'false'); // nosotros manejamos el scroll
    content.style.cssText = '--background:transparent; --padding-top:0; overflow:visible;';

    // Clonar el wp-pm-card dentro del ion-modal
    const card = this._pm._card;
    card.style.cssText = `
      position:relative; width:100%; height:100%;
      background:#fff; overflow:hidden;
      display:flex; flex-direction:column;
    `;
    content.appendChild(card);
    modal.appendChild(content);

    document.querySelector('ion-app').appendChild(modal);
    this._ionModal = modal;

    // Escuchar cierre nativo (swipe down)
    modal.addEventListener('ionModalDidDismiss', () => {
      this._pm.onClose?.();
      // Restaurar topbar
      const mapTopbar = document.getElementById('topbar');
      if (mapTopbar) {
        mapTopbar.style.visibility = '';
        mapTopbar.style.pointerEvents = '';
        const gsap = window.gsap;
        if (gsap) {
          gsap.killTweensOf(mapTopbar);
          gsap.fromTo(mapTopbar,
            { scale:0.85, opacity:0 },
            { scale:1, opacity:1, duration:0.32, ease:'back.out(2)' }
          );
        }
      }
      document.body.classList.remove('wp-pm-open');
    });

    // Cambio de breakpoint → ajustar contenido
    modal.addEventListener('ionBreakpointDidChange', (e) => {
      this._onBreakpointChange(e.detail.breakpoint);
    });
  }

  // ── Show ─────────────────────────────────────────────────────────
  async show(place) {
    this._place = place;
    await this._build();

    // Poblar contenido via PlaceModal existente
    this._pm._place = place;
    this._pm._populate(place);

    // Ocultar topbar del mapa
    const mapTopbar = document.getElementById('topbar');
    if (mapTopbar && window.gsap) {
      window.gsap.to(mapTopbar, {
        scale:0.85, opacity:0, duration:0.22, ease:'power2.in',
        onComplete: () => {
          mapTopbar.style.visibility = 'hidden';
          mapTopbar.style.pointerEvents = 'none';
        }
      });
    }

    document.body.classList.add('wp-pm-open');
    await this._ionModal.present();

    // Breakpoint inicial → compact
    this._onBreakpointChange(0.50);
  }

  // ── Hide ─────────────────────────────────────────────────────────
  async hide() {
    if (this._ionModal) await this._ionModal.dismiss();
  }

  isVisible() {
    return this._ionModal?.isOpen ?? false;
  }

  // ── Adaptar UI al breakpoint ──────────────────────────────────────
  _onBreakpointChange(bp) {
    const hero   = this._pm._el?.querySelector('#wp-pm-hero');
    const topbar = this._pm._el?.querySelector('#wp-pm-topbar');
    const body   = this._pm._el?.querySelector('#wp-pm-body');

    if (bp <= 0.50) {
      // Compact: fotos grandes, stats visibles, poco scroll
      if (hero)   { hero.style.height = '200px'; }
      if (body)   { body.style.top    = 'calc(env(safe-area-inset-top,0px) + 268px)'; }
    } else {
      // Expanded: fotos más pequeñas, todo el contenido
      if (hero)   { hero.style.height = '180px'; }
      if (body)   { body.style.top    = 'calc(env(safe-area-inset-top,0px) + 248px)'; }
    }
  }
}
