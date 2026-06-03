// ====================================================================
// WHATSPLAN — PlaceModalSheet.js
// Ion-modal sheet que envuelve PlaceModal sin modificarlo.
// El ion-modal provee handle nativo + drag + breakpoints.
// El PlaceModal original vive en body y se clipea al breakpoint.
// ====================================================================

export class PlaceModalSheet {
  constructor(placeModal) {
    this._pm      = placeModal;
    this._modal   = null;
    this._built   = false;

    // Breakpoints en fracción de pantalla
    // 0.00 → cerrado
    // 0.50 → medio  — fotos + info básica
    // 0.92 → full   — todo el contenido
    this.BREAKPOINTS     = [0, 0.50, 0.92];
    this.INIT_BREAKPOINT = 0.50;
    this._currentBp      = 0;
  }

  // ── Build — una sola vez ─────────────────────────────────────────
  _build() {
    if (this._built) return;
    this._built = true;

    var modal = document.createElement('ion-modal');
    modal.breakpoints        = this.BREAKPOINTS;
    modal.initialBreakpoint  = this.INIT_BREAKPOINT;
    modal.handle             = true;
    modal.handleBehavior     = 'cycle';
    modal.backdropBreakpoint = 0.01;
    modal.backdropDismiss    = true;
    modal.cssClass           = 'wp-pm-sheet';

    // El contenido del ion-modal es solo un div vacío transparente
    // El PlaceModal real vive en body — el sheet solo controla el clip
    var inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:100%;background:transparent;pointer-events:none;';
    modal.appendChild(inner);
    document.querySelector('ion-app').appendChild(modal);
    this._modal = modal;

    var self = this;

    // Cierre nativo (swipe down)
    modal.addEventListener('ionModalDidDismiss', function() {
      self._pm.hide();
    });

    // Cambio de breakpoint → clipear el PlaceModal
    modal.addEventListener('ionBreakpointDidChange', function(e) {
      self._currentBp = e.detail.breakpoint;
      self._syncClip(e.detail.breakpoint);
    });
  }

  // ── Sincronizar la altura visible del PlaceModal al breakpoint ──
  _syncClip(bp) {
    var card = this._pm._card;
    if (!card) return;
    var vh = window.innerHeight;

    if (bp === 0) {
      // Oculto — PlaceModal se cierra solo vía ionModalDidDismiss
      return;
    }

    // La carta del PlaceModal ya está en translateY(0) — solo
    // necesitamos que el body del modal tenga la altura correcta.
    // El ion-modal maneja el clip via su propio height.
    // Solo ajustar el padding-bottom del body scroll para que no
    // quede contenido tapado por el CTA.
    var body = this._pm._el && this._pm._el.querySelector('#wp-pm-body');
    if (body) {
      var ctaH = 80;
      body.style.paddingBottom = (ctaH + 20) + 'px';
    }
  }

  // ── Show ─────────────────────────────────────────────────────────
  show(place) {
    var self = this;
    this._build();

    // 1. Poblar el PlaceModal
    this._pm._place = place;
    this._pm._populate(place);

    // 2. Mostrar el PlaceModal (animación propia, oculta el topbar)
    this._pm.show(place);

    // 3. Presentar el ion-modal encima (transparente, solo para el drag)
    //    Pequeño delay para que PlaceModal termine su animación
    setTimeout(function() {
      self._modal.present().then(function() {
        self._syncClip(self.INIT_BREAKPOINT);
      });
    }, 380);
  }

  // ── Hide ─────────────────────────────────────────────────────────
  hide() {
    if (this._modal) this._modal.dismiss();
    this._pm.hide();
  }

  isVisible() {
    return this._modal ? this._modal.isOpen : false;
  }
}
