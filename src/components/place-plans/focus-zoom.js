// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/focus-zoom.js
// Capa "zoom": una tarjeta sale con un zoom desde donde tocaste hacia el
// centro del espacio libre (entre la barra de estado y el teclado) y lo
// de atrás queda borroso.
//
//   openZoom({ from, label, content, field, kbClose, count, onClose })
//     Tarjeta genérica (la usan la hora a tu gusto y el buscador de
//     seguidores). Devuelve { card, slot, place(), close() }.
//   attachFocusZoom(root)
//     Campos de texto con [data-zoom]: al tocarlos se abre la tarjeta con
//     una copia del campo y el cursor pasa a la copia (así el teclado no
//     se cierra). Lo que escribes se copia al original con un 'input'.
//
// Se cierra con "Listo", Enter (campos de una línea), tocando lo borroso
// o al bajar el teclado. Estilos: /styles/plan-steps.css (.wp-fz-*)
// ════════════════════════════════════════════════════════════════════
import { attachPulse } from '/src/components/place-plans/pulse.js';

const GAP = 14;
let kbH = 0;   // alto del teclado visto la última vez (para acomodar la tarjeta antes de que salga)

const safeArea = () => {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(p);
  const top = parseFloat(getComputedStyle(p).paddingTop) || 0;
  p.remove();
  return top;
};

export function openZoom({ from, label = '', content, field = null, kbClose = true, count = false, onClose, doneLabel = 'Listo' }) {
  const layer = document.createElement('div');
  layer.className = 'wp-fz';
  layer.innerHTML = `<div class="wp-fz-card"><div class="wp-fz-top"><span>${label}</span>${count ? '<small class="wp-fz-n"></small>' : ''}</div><div class="wp-fz-slot"></div><button type="button" class="wp-fz-done">${doneLabel}</button></div>`;
  const card = layer.querySelector('.wp-fz-card'), slot = layer.querySelector('.wp-fz-slot');
  if (typeof content === 'string') slot.innerHTML = content; else if (content) slot.appendChild(content);
  document.body.appendChild(layer);
  attachPulse(layer);
  const safeTop = safeArea();
  let kbSeen = false, closed = false, settled = !field;

  // Centrar la tarjeta en el espacio libre (barra de estado ↔ teclado).
  // Con un campo, el teclado va a subir unos ms después de abrir: la tarjeta
  // se acomoda desde el primer cuadro para el espacio que quedará con él
  // (alto del teclado de la última vez, o un cálculo) y así el zoom llega a su
  // lugar de una sola vez, en vez de ir al centro de la pantalla completa y
  // brincar hacia arriba cuando el teclado sale.
  const place = (animate = true) => {
    const vv = window.visualViewport;
    if (kbUp()) kbH = window.innerHeight - vv.height;
    const expect = !settled && !kbUp() ? (kbH || Math.round(window.innerHeight * 0.38)) : 0;
    const top = (vv?.offsetTop || 0) + safeTop + GAP;
    const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - expect - GAP;
    card.style.maxHeight = `${bottom - top}px`;
    const h = card.offsetHeight;
    card.style.transition = animate ? 'top 0.32s cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
    card.style.top = `${Math.max(top, top + (bottom - top - h) / 2)}px`;
    if (!field || !kbClose) return;
    checkKb();
  };
  // "Bajó el teclado → listo". Al abrir, el foco pasa del campo original a la
  // copia y el teclado parpadea (baja y vuelve a subir): eso cerraba la tarjeta
  // recién abierta. Ahora solo cierra si el teclado sigue abajo un momento
  // después de haberse visto, y nunca en los primeros 800 ms.
  const openedAt = performance.now();
  let kbTimer = 0;
  const kbUp = () => { const v = window.visualViewport; return !!(v && window.innerHeight - v.height > 120); };
  const checkKb = () => {
    if (kbUp()) { kbSeen = true; clearTimeout(kbTimer); kbTimer = 0; return; }
    if (!kbSeen || closed || kbTimer) return;
    const wait = Math.max(500, 800 - (performance.now() - openedAt));
    kbTimer = setTimeout(() => { kbTimer = 0; if (!closed && !kbUp()) close(); }, wait);
  };
  // Zoom desde donde estaba lo que tocaste (FLIP)
  place(false);
  if (from) {
    const to = card.getBoundingClientRect();
    const sx = Math.min(1, from.width / to.width), dy = from.top - to.top;
    card.animate([{ transform: `translateY(${dy}px) scale(${sx})`, opacity: 0.6 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  }
  requestAnimationFrame(() => layer.classList.add('in'));
  // Si el teclado no sale (teclado físico, escritorio), se recentra en el espacio completo
  if (field) setTimeout(() => { settled = true; if (!closed && !kbUp()) place(true); }, 1200);
  if (field) setTimeout(() => {   // el foco pasa después del evento de foco del original
    try { field.focus({ preventScroll: true }); } catch (_) { field.focus(); }
    try { const n = field.value.length; field.setSelectionRange(n, n); } catch (_) {}
  }, 0);

  layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); close(); } });
  layer.querySelector('.wp-fz-done').addEventListener('click', () => close());
  const onVv = () => place(true);
  window.visualViewport?.addEventListener('resize', onVv);
  window.addEventListener('resize', onVv);

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(kbTimer);
    window.visualViewport?.removeEventListener('resize', onVv);
    window.removeEventListener('resize', onVv);
    onClose?.();
    field?.blur();
    layer.classList.remove('in');
    card.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(0.92)', opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => layer.remove(), 220);
  }
  return { layer, card, slot, place, close, count: layer.querySelector('.wp-fz-n') };
}

export function attachFocusZoom(root) {
  root.addEventListener('focusin', (e) => {
    const src = e.target;
    if (!src.matches?.('input[data-zoom], textarea[data-zoom]') || src._wpZoomOpen) return;
    zoomField(src);
  });
}

function zoomField(src) {
  src._wpZoomOpen = true;
  const field = document.createElement(src.tagName.toLowerCase());
  ['type', 'placeholder', 'maxlength', 'rows', 'autocapitalize', 'autocomplete', 'enterkeyhint', 'inputmode', 'autocorrect', 'spellcheck'].forEach(a => { if (src.hasAttribute(a)) field.setAttribute(a, src.getAttribute(a)); });
  field.className = 'wp-fz-field' + (src.tagName === 'TEXTAREA' ? ' area' : '');
  field.value = src.value;
  const max = +src.getAttribute('maxlength') || 0;
  const sync = () => { src.value = field.value; src.dispatchEvent(new Event('input', { bubbles: true })); };
  const z = openZoom({
    from: src.getBoundingClientRect(), label: src.dataset.zoom || '', content: field, field, count: !!max,
    onClose: () => { sync(); setTimeout(() => { src._wpZoomOpen = false; }, 220); },
  });
  const paintCount = () => { if (z.count) z.count.textContent = `${field.value.length}/${max}`; };
  paintCount();
  field.addEventListener('input', () => { sync(); paintCount(); });
  field.addEventListener('keydown', (e) => { if (e.key === 'Enter' && field.tagName === 'INPUT') { e.preventDefault(); z.close(); } });
}
