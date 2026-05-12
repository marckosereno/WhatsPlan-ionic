// ====================================================================
// WHATSPLAN — utils/animations.js
// Animaciones centralizadas con GSAP
// ====================================================================

const gsap = window.gsap;

// ── Configuración global ─────────────────────────────────────────────
gsap.config({ nullTargetWarn: false });

// Defaults para toda la app — feel "físico" suave
gsap.defaults({ ease: 'power3.out', duration: 0.35 });


// ════════════════════════════════════════════════════════════════════
// PANEL INFERIOR
// ════════════════════════════════════════════════════════════════════

/**
 * Entrada del panel al cargar la app.
 * Sube desde abajo con spring suave.
 */
export function animatePanelIn(el) {
  if (!el) return;
  gsap.fromTo(el,
    { y: 80, opacity: 0, scale: 0.97 },
    { y: 0,  opacity: 1, scale: 1,
      duration: 0.55,
      ease: 'back.out(1.4)',
      clearProps: 'transform,opacity' }
  );
}

/**
 * Swap de categorías dentro del panel.
 * Los chips salen a la izquierda y entran los nuevos desde la derecha.
 */
export function animateCategorySwap(container, renderFn) {
  if (!container) { renderFn?.(); return; }

  gsap.to(container, {
    opacity: 0, x: -12, duration: 0.18, ease: 'power2.in',
    onComplete: () => {
      renderFn?.();
      gsap.fromTo(container,
        { opacity: 0, x: 12 },
        { opacity: 1, x: 0, duration: 0.28, ease: 'power3.out',
          clearProps: 'transform,opacity' }
      );
    }
  });
}

/**
 * Entrada staggered de chips de categoría (skeleton → real).
 */
export function animateChipsIn(chips) {
  if (!chips?.length) return;
  gsap.fromTo(chips,
    { y: 16, opacity: 0, scale: 0.88 },
    { y: 0,  opacity: 1, scale: 1,
      duration: 0.38,
      ease: 'back.out(1.6)',
      stagger: 0.045,
      clearProps: 'transform,opacity' }
  );
}

/**
 * Feedback de tap en un chip — pequeño bounce.
 */
export function animateChipTap(chip) {
  if (!chip) return;
  gsap.timeline()
    .to(chip,  { scale: 0.92, duration: 0.1,  ease: 'power2.in' })
    .to(chip,  { scale: 1,    duration: 0.35, ease: 'back.out(2)' });
}


// ════════════════════════════════════════════════════════════════════
// SUBCATEGORÍAS
// ════════════════════════════════════════════════════════════════════

/**
 * Aparición de la fila de subcategorías.
 */
export function animateSubcatsIn(chips) {
  if (!chips?.length) return;
  gsap.fromTo(chips,
    { x: -10, opacity: 0 },
    { x: 0,   opacity: 1,
      duration: 0.25,
      ease: 'power2.out',
      stagger: 0.03,
      clearProps: 'transform,opacity' }
  );
}

/**
 * Desaparición de la fila de subcategorías.
 */
export function animateSubcatsOut(container, onComplete) {
  if (!container) { onComplete?.(); return; }
  gsap.to(container, {
    opacity: 0, y: 4, duration: 0.18, ease: 'power2.in',
    onComplete: () => {
      gsap.set(container, { clearProps: 'all' });
      onComplete?.();
    }
  });
}


// ════════════════════════════════════════════════════════════════════
// MODALES Y OVERLAYS
// ════════════════════════════════════════════════════════════════════

/**
 * Entrada de modal desde abajo (sheet style).
 */
export function animateModalIn(overlay, sheet) {
  if (!overlay || !sheet) return;

  gsap.set(overlay, { display: 'flex' });

  gsap.fromTo(overlay,
    { opacity: 0 },
    { opacity: 1, duration: 0.25 }
  );

  gsap.fromTo(sheet,
    { y: '100%', opacity: 0 },
    { y: '0%',   opacity: 1,
      duration: 0.45,
      ease: 'back.out(1.2)' }
  );
}

/**
 * Salida de modal hacia abajo.
 */
export function animateModalOut(overlay, sheet, onComplete) {
  if (!overlay || !sheet) { onComplete?.(); return; }

  gsap.to(overlay, { opacity: 0, duration: 0.2 });
  gsap.to(sheet, {
    y: '100%', opacity: 0,
    duration: 0.28, ease: 'power3.in',
    onComplete: () => {
      gsap.set(overlay, { display: 'none' });
      gsap.set(sheet, { clearProps: 'all' });
      onComplete?.();
    }
  });
}


// ════════════════════════════════════════════════════════════════════
// MAPA — PINS
// ════════════════════════════════════════════════════════════════════

/**
 * Entrada staggered de pins en el mapa al cargar una categoría.
 */
export function animatePinsIn(pinEls) {
  if (!pinEls?.length) return;
  gsap.fromTo(pinEls,
    { scale: 0, opacity: 0, transformOrigin: 'bottom center' },
    { scale: 1, opacity: 1,
      duration: 0.4,
      ease: 'back.out(2)',
      stagger: { amount: 0.35, from: 'random' },
      clearProps: 'transform,opacity' }
  );
}

/**
 * Salida de pins al cambiar categoría.
 */
export function animatePinsOut(pinEls, onComplete) {
  if (!pinEls?.length) { onComplete?.(); return; }
  gsap.to(pinEls, {
    scale: 0, opacity: 0,
    duration: 0.2, ease: 'power2.in',
    transformOrigin: 'bottom center',
    stagger: { amount: 0.15, from: 'random' },
    onComplete
  });
}

/**
 * Tap feedback en un pin — bounce up.
 */
export function animatePinTap(pinEl) {
  if (!pinEl) return;
  gsap.timeline()
    .to(pinEl, { y: -8, scale: 1.2, duration: 0.15, ease: 'power2.out' })
    .to(pinEl, { y:  0, scale: 1.0, duration: 0.3,  ease: 'elastic.out(1, 0.5)' });
}


// ════════════════════════════════════════════════════════════════════
// MINICARD (popup de pin)
// ════════════════════════════════════════════════════════════════════

/**
 * Entrada de la minicard.
 */
export function animateMinicardIn(el) {
  if (!el) return;
  gsap.fromTo(el,
    { y: 8, opacity: 0, scale: 0.95 },
    { y: 0, opacity: 1, scale: 1,
      duration: 0.3,
      ease: 'back.out(1.8)',
      clearProps: 'transform,opacity' }
  );
}

/**
 * Salida de la minicard.
 */
export function animateMinicardOut(el, onComplete) {
  if (!el) { onComplete?.(); return; }
  gsap.to(el, {
    y: 6, opacity: 0, scale: 0.95,
    duration: 0.18, ease: 'power2.in',
    onComplete
  });
}


// ════════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════════

/**
 * Muestra un toast que aparece, espera y desaparece.
 */
export function animateToast(el, duration = 2800) {
  if (!el) return;
  gsap.timeline()
    .fromTo(el,
      { y: -12, opacity: 0, scale: 0.95 },
      { y: 0,   opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }
    )
    .to(el, {
      opacity: 0, y: -8, scale: 0.97,
      duration: 0.25, ease: 'power2.in',
      delay: duration / 1000
    });
}


// ════════════════════════════════════════════════════════════════════
// BOTÓN DE PERFIL (topbar)
// ════════════════════════════════════════════════════════════════════

/**
 * Transición de avatar anónimo → foto de perfil.
 */
export function animateAvatarSwap(btn) {
  if (!btn) return;
  gsap.timeline()
    .to(btn,  { scale: 0.8, opacity: 0, duration: 0.15, ease: 'power2.in' })
    .to(btn,  { scale: 1,   opacity: 1, duration: 0.35, ease: 'back.out(2)' });
}
