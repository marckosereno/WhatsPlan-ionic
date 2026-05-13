// ====================================================================
// WHATSPLAN — src/utils/animations.js
// GSAP se carga como script global en index.html ANTES que los módulos.
// Usamos función lazy para asegurar que window.gsap esté disponible.
// ====================================================================

function g() { return window.gsap; }

// ── Panel ────────────────────────────────────────────────────────────
export function animatePanelIn(el) {
  if (!el || !g()) return;
  g().fromTo(el,
    { opacity: 0 },
    { opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'opacity' }
  );
}

// ── Categorías ───────────────────────────────────────────────────────
export function animateChipsIn(chips) {
  if (!chips || !chips.length || !g()) return;
  // Asegurar visibilidad antes de animar — por si GSAP dejó algo pendiente
  chips.forEach(function(c) { c.style.opacity = ''; c.style.transform = ''; });
  g().fromTo(chips,
    { y: 12, opacity: 0 },
    { y: 0,  opacity: 1,
      duration: 0.32, ease: 'power3.out',
      stagger: 0.04,  clearProps: 'all' }
  );
}

export function animateChipTap(chip) {
  if (!chip || !g()) return;
  g().timeline()
    .to(chip, { scale: 0.92, duration: 0.1,  ease: 'power2.in' })
    .to(chip, { scale: 1,    duration: 0.3,  ease: 'back.out(2)', clearProps: 'all' });
}

// ── Subcategorías ────────────────────────────────────────────────────
export function animateSubcatsIn(chips) {
  if (!chips || !chips.length || !g()) return;
  g().fromTo(chips,
    { x: -10, opacity: 0 },
    { x: 0,   opacity: 1,
      duration: 0.22, ease: 'power2.out',
      stagger: 0.03,  clearProps: 'all' }
  );
}

export function animateSubcatsOut(container, onComplete) {
  if (!container || !g()) { if (onComplete) onComplete(); return; }
  g().to(container, {
    opacity: 0, y: 4, duration: 0.15, ease: 'power2.in',
    onComplete: function() {
      g().set(container, { clearProps: 'all' });
      if (onComplete) onComplete();
    }
  });
}

// ── Minicard ─────────────────────────────────────────────────────────
export function animateMinicardIn(el) {
  if (!el || !g()) return;
  g().fromTo(el,
    { opacity: 0, y: 4 },
    { opacity: 1, y: 0, duration: 0.15, ease: 'power2.out', clearProps: 'all' }
  );
}

export function animateMinicardOut(el, onComplete) {
  if (!el || !g()) { if (onComplete) onComplete(); return; }
  g().to(el, {
    opacity: 0, duration: 0.1, ease: 'power2.in',
    onComplete: onComplete
  });
}

// ── Avatar ───────────────────────────────────────────────────────────
export function animateAvatarSwap(btn) {
  if (!btn || !g()) return;
  // Resetear estado previo antes de animar
  g().set(btn, { clearProps: 'all' });
  g().timeline()
    .to(btn, { scale: 0.85, duration: 0.12, ease: 'power2.in' })
    .to(btn, { scale: 1,    duration: 0.4,  ease: 'back.out(2.5)', clearProps: 'all' });
}
