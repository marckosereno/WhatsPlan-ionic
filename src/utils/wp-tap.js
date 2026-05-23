// ====================================================================
// WHATSPLAN — src/utils/wp-tap.js
// Pulse spring universal para todos los elementos táctiles
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
  el.classList.add('wp-tap');

  const gsap = window.gsap;

  el.addEventListener('pointerdown', () => {
    if (gsap) {
      gsap.killTweensOf(el, 'scale');
      gsap.to(el, { scale: 0.91, duration: 0.08, ease: 'power2.out', overwrite: 'auto' });
    }
  }, { passive: true });

  el.addEventListener('pointerup', () => {
    if (gsap) {
      gsap.to(el, {
        scale: 1.06, duration: 0.18,
        ease: 'power2.out', overwrite: 'auto',
        onComplete: () => {
          gsap.to(el, { scale: 1, duration: 0.28, ease: 'elastic.out(1, 0.5)' });
        }
      });
    }
  }, { passive: true });

  el.addEventListener('pointercancel', () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' });
  }, { passive: true });

  el.addEventListener('pointerleave', () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' });
  }, { passive: true });
}

// Pines del mapa — pulse inverso (crece al tocar)
function applyPinPulse(el) {
  if (el._wpTapAttached) return;
  el._wpTapAttached = true;

  const gsap = window.gsap;

  el.addEventListener('pointerdown', () => {
    if (gsap) gsap.to(el, { scale: 1.2, duration: 0.12, ease: 'back.out(2)', overwrite: 'auto' });
  }, { passive: true });

  el.addEventListener('pointerup', () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.3, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  }, { passive: true });

  el.addEventListener('pointercancel', () => {
    if (gsap) gsap.to(el, { scale: 1, duration: 0.2, ease: 'power2.out' });
  }, { passive: true });
}

// Entrance animation para pines
function animatePinEntrance(el) {
  if (el._wpEntered) return;
  el._wpEntered = true;
  const gsap = window.gsap;
  if (!gsap) return;
  gsap.fromTo(el,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.35,
      ease: 'back.out(2)',
      delay: Math.random() * 0.15
    }
  );
}

function scanAndApply() {
  // Elementos estáticos
  SELECTORS.forEach(sel => {
    document.querySelectorAll(sel).forEach(applyPulse);
  });

  // Pines del mapa
  document.querySelectorAll('.place-marker-el').forEach(el => {
    applyPinPulse(el);
    animatePinEntrance(el);
  });
}

// Observer para elementos que aparecen dinámicamente
function watchDynamic() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        // Verificar si el nodo mismo es un elemento táctil
        SELECTORS.forEach(sel => {
          if (node.matches && node.matches(sel)) applyPulse(node);
        });

        // Verificar hijos
        SELECTORS.forEach(sel => {
          node.querySelectorAll && node.querySelectorAll(sel).forEach(applyPulse);
        });

        // Pines
        if (node.matches && node.matches('.place-marker-el')) {
          applyPinPulse(node);
          animatePinEntrance(node);
        }
        node.querySelectorAll && node.querySelectorAll('.place-marker-el').forEach(el => {
          applyPinPulse(el);
          animatePinEntrance(el);
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
  const panel = document.getElementById('map-results-panel');
  if (panel && window.gsap) {
    window.gsap.fromTo(panel,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.5)', delay: 0.2 }
    );
  }

  // Entrance del topbar
  const topbar = document.getElementById('topbar');
  if (topbar && window.gsap) {
    const actBtn = document.getElementById('topbar-activity-btn');
    const rightChip = document.getElementById('topbar-right-chip');
    window.gsap.fromTo([actBtn, rightChip],
      { y: -16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)', stagger: 0.08, delay: 0.1 }
    );
  }
}
