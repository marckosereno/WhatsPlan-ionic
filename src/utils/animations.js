// ====================================================================
// WHATSPLAN — src/utils/animations.js
// ====================================================================

function g() { return window.gsap; }

// ── Panel ────────────────────────────────────────────────────────────
export function animatePanelIn(el) {
  if (!el || !g()) { if (el) el.style.opacity = '1'; return; }
  g().fromTo(el,
    { opacity: 0 },
    { opacity: 1, duration: 0.25, ease: 'power2.out', clearProps: 'opacity' }
  );
}

// ── Categorías ───────────────────────────────────────────────────────
// SIN scale — el panel tiene overflow:hidden que corta cualquier scale
export function animateChipsIn(chips) {
  if (!chips || !chips.length) return;
  if (!g()) {
    // Fallback sin GSAP — mostrar directamente
    chips.forEach(function(c) { c.style.opacity = '1'; });
    return;
  }
  // Sin y — evita que el panel salte al animar chips
  g().fromTo(chips,
    { opacity: 0 },
    { opacity: 1,
      duration: 0.25, ease: 'power2.out',
      stagger: 0.04, clearProps: 'all' }
  );
}

export function animateChipTap(chip) {
  if (!chip || !g()) return;
  // Solo scale — el tap feedback no está dentro del overflow:hidden del panel
  g().timeline()
    .to(chip, { scale: 0.92, duration: 0.1,  ease: 'power2.in' })
    .to(chip, { scale: 1,    duration: 0.3,  ease: 'back.out(2)', clearProps: 'all' });
}

// ── Subcategorías ────────────────────────────────────────────────────
export function animateSubcatsIn(chips) {
  if (!chips || !chips.length) return;
  if (!g()) {
    chips.forEach(function(c) { c.style.opacity = '1'; });
    return;
  }
  g().fromTo(chips,
    { opacity: 0, x: -8 },
    { opacity: 1, x: 0,
      duration: 0.2, ease: 'power2.out',
      stagger: 0.025, clearProps: 'all' }
  );
}

export function animateSubcatsOut(container, onComplete) {
  if (!container || !g()) { if (onComplete) onComplete(); return; }
  g().to(container, {
    opacity: 0, duration: 0.12, ease: 'power2.in',
    onComplete: function() {
      g().set(container, { clearProps: 'all' });
      if (onComplete) onComplete();
    }
  });
}

// ── Minicard ─────────────────────────────────────────────────────────
export function animateMinicardIn(el) {
  if (!el || !g()) { if (el) el.style.opacity = '1'; return; }
  g().fromTo(el,
    { opacity: 0 },
    { opacity: 1, duration: 0.15, ease: 'power2.out', clearProps: 'opacity' }
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
  g().set(btn, { clearProps: 'all' });
  g().timeline()
    .to(btn, { scale: 0.85, duration: 0.12, ease: 'power2.in' })
    .to(btn, { scale: 1,    duration: 0.4,  ease: 'back.out(2.5)', clearProps: 'all' });
}
