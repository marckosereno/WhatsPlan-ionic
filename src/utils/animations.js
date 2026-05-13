// ====================================================================
// WHATSPLAN — src/utils/animations.js
// GSAP se carga como script global en index.html ANTES que los módulos
// ====================================================================

const gsap = window.gsap;

gsap.config({ nullTargetWarn: false });
gsap.defaults({ ease: 'power3.out', duration: 0.35 });

// ── Panel ────────────────────────────────────────────────────────────
export function animatePanelIn(el) {
  if (!el) return;
  gsap.fromTo(el,
    { opacity: 0 },
    { opacity: 1, duration: 0.5, ease: 'power2.out', clearProps: 'opacity' }
  );
}

export function animateChipsIn(chips) {
  if (!chips || !chips.length) return;
  gsap.fromTo(chips,
    { y: 14, opacity: 0, scale: 0.9 },
    { y: 0,  opacity: 1, scale: 1,
      duration: 0.38, ease: 'back.out(1.6)',
      stagger: 0.045, clearProps: 'transform,opacity' }
  );
}

export function animateChipTap(chip) {
  if (!chip) return;
  gsap.timeline()
    .to(chip, { scale: 0.92, duration: 0.1,  ease: 'power2.in' })
    .to(chip, { scale: 1,    duration: 0.35, ease: 'back.out(2)' });
}

// ── Subcategorías ────────────────────────────────────────────────────
export function animateSubcatsIn(chips) {
  if (!chips || !chips.length) return;
  gsap.fromTo(chips,
    { x: -10, opacity: 0 },
    { x: 0,   opacity: 1,
      duration: 0.25, ease: 'power2.out',
      stagger: 0.03,  clearProps: 'transform,opacity' }
  );
}

export function animateSubcatsOut(container, onComplete) {
  if (!container) { if (onComplete) onComplete(); return; }
  gsap.to(container, {
    opacity: 0, y: 4, duration: 0.18, ease: 'power2.in',
    onComplete: function() {
      gsap.set(container, { clearProps: 'all' });
      if (onComplete) onComplete();
    }
  });
}

// ── Minicard ─────────────────────────────────────────────────────────
export function animateMinicardIn(el) {
  if (!el) return;
  gsap.fromTo(el,
    { y: 8, opacity: 0, scale: 0.95 },
    { y: 0, opacity: 1, scale: 1,
      duration: 0.3, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }
  );
}

export function animateMinicardOut(el, onComplete) {
  if (!el) { if (onComplete) onComplete(); return; }
  gsap.to(el, {
    y: 6, opacity: 0, scale: 0.95,
    duration: 0.18, ease: 'power2.in',
    onComplete: onComplete
  });
}

// ── Avatar ───────────────────────────────────────────────────────────
export function animateAvatarSwap(btn) {
  if (!btn) return;
  gsap.timeline()
    .to(btn, { scale: 0.8, opacity: 0, duration: 0.15, ease: 'power2.in' })
    .to(btn, { scale: 1,   opacity: 1, duration: 0.35, ease: 'back.out(2)' });
}
