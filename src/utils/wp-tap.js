// ====================================================================
// WHATSPLAN — src/utils/wp-tap.js
// Pulse spring universal para elementos táctiles
// ====================================================================

const SELECTORS = [
  '.subcategory-footer-chip',
  '.category-footer-chip',
  '#map-gps-btn',
  '.wps-cat-chip',
  '.wps-card',
  '.hm-live-chip',
  '#topbar-activity-btn',
  '#topbar-right-chip',
  '#topbar-search-btn',
  '#topbar-messages-btn',
  '#topbar-auth-btn',
];

function applyPulse(el) {
  if (el._wpTapAttached) return;
  el._wpTapAttached = true;
  el.classList.add("wp-tap");

  const gsap = window.gsap;

  el.addEventListener("pointerdown", () => {
    if (gsap) gsap.to(el, { scale: 0.91, duration: 0.1, ease: "power2.out", overwrite: true });
  }, { passive: true });

  el.addEventListener("pointerup", () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.3, ease: "back.out(2)", overwrite: true });
  }, { passive: true });

  el.addEventListener("pointercancel", () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.15, ease: "power2.out", overwrite: true });
  }, { passive: true });
}

function scanAndApply() {
  SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach(applyPulse);
  });
}

function watchDynamic() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        SELECTORS.forEach(sel => {
          if (node.matches && node.matches(sel)) applyPulse(node);
          node.querySelectorAll && node.querySelectorAll(sel).forEach(applyPulse);
        });
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function initWpTap() {
  scanAndApply();
  watchDynamic();

  // Entrance del panel flotante
  const panel = document.getElementById("map-results-panel");
  if (panel && window.gsap) {
    window.gsap.fromTo(panel,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.5)", delay: 0.2 }
    );
  }

  // Entrance del topbar
  const actBtn = document.getElementById("topbar-activity-btn");
  const rightChip = document.getElementById("topbar-right-chip");
  if (actBtn && rightChip && window.gsap) {
    window.gsap.fromTo([actBtn, rightChip],
      { y: -16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.8)", stagger: 0.08, delay: 0.1 }
    );
  }
}
