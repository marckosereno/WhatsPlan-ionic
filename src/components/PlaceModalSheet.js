// ====================================================================
// WHATSPLAN — PlaceModalSheet.js
// Wrapper ion-modal nativo con breakpoints + drag
// ====================================================================

import { PlaceModal } from '/src/components/PlaceModal.js';

export class PlaceModalSheet {
  constructor(placeModal) {
    this._pm       = placeModal;
    this._ionModal = null;
    this._built    = false;
  }

  // ── Build — crea el ion-modal una sola vez ────────────────────────
  _build() {
    if (this._built) return Promise.resolve();
    this._built = true;

    const modal = document.createElement('ion-modal');
    modal.breakpoints       = [0, 0.50, 0.92];
    modal.initialBreakpoint = 0.50;
    modal.handle            = true;
    modal.handleBehavior    = 'cycle';
    modal.backdropBreakpoint= 0.01;
    modal.backdropDismiss   = true;
    modal.cssClass          = 'wp-pm-sheet';

    // Inyectar el wp-pm-card en el ion-modal
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;background:#fff;';

    const card = this._pm._card;
    if (card) {
      card.style.cssText = 'position:relative;width:100%;flex:1;overflow:hidden;display:flex;flex-direction:column;background:#fff;transform:none;';
      // Quitar el transform que PlaceModal aplica al card
      card.style.transform = 'none';
      wrapper.appendChild(card);
    }
    modal.appendChild(wrapper);
    document.querySelector('ion-app').appendChild(modal);
    this._ionModal = modal;

    // Cierre nativo (swipe down)
    modal.addEventListener('ionModalDidDismiss', () => {
      document.body.classList.remove('wp-pm-open');
      this._restoreTopbar();
      if (this._pm.onClose) this._pm.onClose();
    });

    // Cambio de breakpoint
    modal.addEventListener('ionBreakpointDidChange', (e) => {
      this._onBreakpoint(e.detail.breakpoint);
    });

    return Promise.resolve();
  }

  // ── Show ─────────────────────────────────────────────────────────
  show(place) {
    var self = this;
    self._build().then(function() {
      // Poblar contenido
      self._pm._place = place;
      self._pm._populate(place);

      // Ocultar topbar
      var mapTopbar = document.getElementById('topbar');
      if (mapTopbar) {
        if (window.gsap) {
          window.gsap.to(mapTopbar, {
            scale:0.85, opacity:0, duration:0.22, ease:'power2.in',
            onComplete: function() {
              mapTopbar.style.visibility = 'hidden';
              mapTopbar.style.pointerEvents = 'none';
            }
          });
        } else {
          mapTopbar.style.visibility = 'hidden';
          mapTopbar.style.pointerEvents = 'none';
        }
      }

      document.body.classList.add('wp-pm-open');
      self._ionModal.present().then(function() {
        self._onBreakpoint(0.50);
      });
    });
  }

  // ── Hide ─────────────────────────────────────────────────────────
  hide() {
    if (this._ionModal) this._ionModal.dismiss();
  }

  isVisible() {
    return this._ionModal ? this._ionModal.isOpen : false;
  }

  // ── Restaurar topbar ─────────────────────────────────────────────
  _restoreTopbar() {
    var mapTopbar = document.getElementById('topbar');
    if (!mapTopbar) return;
    mapTopbar.style.visibility = '';
    mapTopbar.style.pointerEvents = '';
    if (window.gsap) {
      window.gsap.killTweensOf(mapTopbar);
      window.gsap.fromTo(mapTopbar,
        { scale:0.85, opacity:0 },
        { scale:1, opacity:1, duration:0.32, ease:'back.out(2)' }
      );
    }
  }

  // ── Adaptar al breakpoint ────────────────────────────────────────
  _onBreakpoint(bp) {
    var hero = this._pm._el && this._pm._el.querySelector('#wp-pm-hero');
    var body = this._pm._el && this._pm._el.querySelector('#wp-pm-body');
    var fade = this._pm._el && this._pm._el.querySelector('.wp-pm-top-fade');
    if (bp <= 0.50) {
      if (hero) hero.style.height = '210px';
      if (body) body.style.top = 'calc(env(safe-area-inset-top,0px) + 278px)';
      if (fade) fade.style.top = 'calc(env(safe-area-inset-top,0px) + 278px)';
    } else {
      if (hero) hero.style.height = '180px';
      if (body) body.style.top = 'calc(env(safe-area-inset-top,0px) + 248px)';
      if (fade) fade.style.top = 'calc(env(safe-area-inset-top,0px) + 248px)';
    }
  }
}
