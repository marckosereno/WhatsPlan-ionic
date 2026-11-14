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
// Reglas aprendidas con las hojas de la ficha (Android WebView dibuja con glitch una
// tarjeta que se anima con transform + esquinas redondas + overflow oculto si tiene un
// área con scroll): mientras se anima, lo que se desliza va recortado (sin scroll) y solo
// al terminar (.ready) se puede deslizar; el campo toma el foco DESPUÉS de la animación
// (el teclado no sube a la vez que el zoom); y la pantalla de atrás no se re-acomoda
// mientras hay un zoom abierto (body.wp-fz-open).
//
// Se cierra con "Listo", Enter (campos de una línea), tocando lo borroso
// o al bajar el teclado. Estilos: /styles/plan-steps.css (.wp-fz-*)
// ════════════════════════════════════════════════════════════════════
import { attachPulse } from '/src/components/place-plans/pulse.js';

const GAP = 14;
const ANIM_MS = 400;   // lo que dura el zoom de entrada (380 ms) + un respiro
let kbH = 0;   // alto del teclado visto la última vez (para acomodar la tarjeta antes de que salga)

// [DIAG-FZ] temporal: línea de tiempo del zoom (ms desde que abre) para ver en Eruda dónde parpadea
const dlog = (t0, ev, extra = '') => console.log('[DIAG-FZ]', Math.round(performance.now() - t0) + 'ms', ev, extra);

const safeArea = () => {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
  document.body.appendChild(p);
  const top = parseFloat(getComputedStyle(p).paddingTop) || 0;
  p.remove();
  return top;
};

// Velo: el contenido que se desliza se desvanece contra la barra de arriba y el botón de abajo
// en vez de cortarse de golpe. Solo en el borde que tiene más contenido más allá (arriba al haber
// deslizado, abajo si falta por ver); sin desborde no hace nada. Devuelve la función que lo repinta.
export function fadeEdges(el, size = 18) {
  const upd = () => {
    const over = el.scrollHeight > el.clientHeight + 1;
    el.classList.toggle('wp-fz-fade', over);
    el.style.setProperty('--ft', over && el.scrollTop > 2 ? `${size}px` : '0px');
    el.style.setProperty('--fb', over && el.scrollTop + el.clientHeight < el.scrollHeight - 2 ? `${size}px` : '0px');
  };
  el.addEventListener('scroll', upd, { passive: true });
  try { new ResizeObserver(upd).observe(el); } catch (_) {}
  upd();
  return upd;
}

export function openZoom({ from, label = '', content, field = null, kbClose = true, count = false, onClose, doneLabel = 'Listo' }) {
  const layer = document.createElement('div');
  layer.className = 'wp-fz';
  layer.innerHTML = `<div class="wp-fz-bg"></div><div class="wp-fz-card"><div class="wp-fz-top"><span>${label}</span>${count ? '<small class="wp-fz-n"></small>' : ''}</div><div class="wp-fz-slot"></div><button type="button" class="wp-fz-done">${doneLabel}</button></div>`;
  const card = layer.querySelector('.wp-fz-card'), slot = layer.querySelector('.wp-fz-slot');
  if (typeof content === 'string') slot.innerHTML = content; else if (content) slot.appendChild(content);
  document.body.appendChild(layer);
  document.body.classList.add('wp-fz-open');
  attachPulse(layer);
  fadeEdges(slot);
  const safeTop = safeArea();
  const H0 = Math.max(window.innerHeight, window.visualViewport?.height || 0);
  let kbSeen = false, closed = false, settled = !field;

  // Centrar la tarjeta en el espacio libre (barra de estado ↔ teclado).
  // Con un campo, el teclado va a subir unos ms después de abrir: la tarjeta
  // se acomoda desde el primer cuadro para el espacio que quedará con él
  // (alto del teclado de la última vez, o un cálculo) y así el zoom llega a su
  // lugar de una sola vez, en vez de ir al centro de la pantalla completa y
  // brincar hacia arriba cuando el teclado sale.
  const place = (animate = true) => {
    const vv = window.visualViewport, H = H0;   // alto SIN teclado (sirve igual si el WebView se encoge o no con él)
    const kbNow = vv ? Math.max(0, H - (vv.offsetTop + vv.height)) : 0;
    if (kbNow > 120) kbH = kbNow;
    // Teclado que se reserva: el real, o —mientras sale— el esperado. Nunca los dos
    // sumados (el teclado a medio subir encogía la tarjeta y luego se estiraba: parpadeo).
    const reserved = settled ? kbNow : Math.max(kbNow, kbH || Math.round(H * 0.38));
    const top = (vv?.offsetTop || 0) + safeTop + GAP;
    const bottom = H - reserved - GAP;
    card.style.maxHeight = `${bottom - top}px`;
    const h = card.offsetHeight;
    // Sin transición de `top` (reflujo + repintado de lo borroso en cada cuadro): se pone el
    // nuevo lugar de una vez y el movimiento se hace con transform (compositor), sumado al zoom
    const prev = parseFloat(card.style.top), next = Math.max(top, top + (bottom - top - h) / 2);
    card.style.top = `${next}px`;
    if (animate && !isNaN(prev) && Math.abs(prev - next) > 1) {
      card.animate([{ transform: `translateY(${prev - next}px)` }, { transform: 'translateY(0)' }],
        { duration: 260, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', composite: 'add' });
    }
    if (!field || !kbClose) return;
    checkKb();
  };
  // "Bajó el teclado → listo". Al abrir, el foco pasa del campo original a la
  // copia y el teclado parpadea (baja y vuelve a subir): eso cerraba la tarjeta
  // recién abierta. Ahora solo cierra si el teclado sigue abajo un momento
  // después de haberse visto, y nunca en los primeros 800 ms.
  const openedAt = performance.now();
  dlog(openedAt, 'abre', `field=${!!field} kbH=${kbH} H0=${H0}`);
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
    // La tarjeta nace transparente y se opaca en el primer cuarto: así no aparece blanca
    // sobre la pantalla todavía nítida (ese era el destello al abrir)
    card.animate([{ transform: `translateY(${dy}px) scale(${sx})`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
  }
  card.style.willChange = 'transform, opacity';   // capa propia mientras se anima
  // El desenfoque arranca en el mismo cuadro que la tarjeta (antes iba un cuadro después)
  void layer.offsetWidth;
  layer.classList.add('in');
  // Si el teclado no sale (teclado físico, escritorio), se recentra en el espacio completo
  if (field) setTimeout(() => { settled = true; if (!closed && !kbUp()) place(true); }, 1200);
  // Listo para deslizar: al terminar de entrar (antes, recortado)
  setTimeout(() => { if (!closed) { layer.classList.add('ready'); card.style.willChange = ''; dlog(openedAt, 'ready'); } }, ANIM_MS);
  // El foco (y con él el teclado) llega después de la animación, no durante
  if (field) setTimeout(() => {
    if (closed) return;
    dlog(openedAt, 'foco');
    try { field.focus({ preventScroll: true }); } catch (_) { field.focus(); }
    try { const n = field.value.length; field.setSelectionRange(n, n); } catch (_) {}
  }, ANIM_MS - 20);

  layer.addEventListener('pointerdown', (e) => { if (e.target === layer || e.target.classList.contains('wp-fz-bg')) { e.preventDefault(); close(); } });
  layer.querySelector('.wp-fz-done').addEventListener('click', () => close());
  let vvRaf = 0;
  const onVv = () => { if (vvRaf) return; vvRaf = requestAnimationFrame(() => { vvRaf = 0; if (closed) return; const v = window.visualViewport; dlog(openedAt, 'teclado', `vv=${Math.round(v?.height || 0)} inner=${window.innerHeight}`); place(true); }); };
  window.visualViewport?.addEventListener('resize', onVv);
  window.addEventListener('resize', onVv);

  function close() {
    if (closed) return;
    closed = true;
    dlog(openedAt, 'cierra');
    clearTimeout(kbTimer);
    window.visualViewport?.removeEventListener('resize', onVv);
    window.removeEventListener('resize', onVv);
    onClose?.();
    field?.blur();
    layer.classList.remove('in', 'ready');   // al salir también recortado (sin scroll)
    // Salida liviana: solo se desvanece (sin escala ni movimiento)
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => {
      layer.remove();
      if (!document.querySelector('.wp-fz')) { document.body.classList.remove('wp-fz-open'); document.dispatchEvent(new Event('wp:zoom-end')); }
    }, 150);
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
