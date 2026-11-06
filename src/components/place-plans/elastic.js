// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/elastic.js
// Rebote elástico en los scrolls (verticales y horizontales):
//  · Jalar: al llegar al borde, lo que sigas arrastrando estira el
//    contenido con resistencia (cada vez cuesta más) y al soltar
//    regresa con un resorte que se pasa un poquito.
//  · Inercia: si el scroll va rápido y choca con el borde, rebota.
// Desactiva el rebote nativo en ese contenedor para no tener dos.
// Un scroll de adentro que sí se puede mover "se queda" el gesto, para
// que el de afuera no se estire a la vez.
//
// Uso: addElastic(el, 'y' | 'x')
// ════════════════════════════════════════════════════════════════════

const MAX = 110;          // estiramiento máximo (px)
const FEEL = 0.55;        // qué tan rápido se acerca al máximo
const SPRING = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
const KICK = 0.9;         // px de rebote por cada px/ms de velocidad

// Curva de goma: casi 1:1 al principio, cada vez más dura
const band = (raw) => Math.sign(raw) * MAX * (1 - Math.exp(-Math.abs(raw) * FEEL / MAX));

export function addElastic(el, axis = 'y') {
  if (!el || el._wpElastic) return;
  el._wpElastic = true;
  el.style.overscrollBehavior = 'none';
  const Y = axis === 'y';
  let start = null, last = 0, raw = 0, locked = null, touching = false;

  const scroll = () => (Y ? el.scrollTop : el.scrollLeft);
  const room = () => (Y ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth);
  const atStart = () => scroll() <= 0;
  const atEnd = () => scroll() >= room() - 1;
  const show = (v) => { el.style.transform = v ? (Y ? `translate3d(0, ${v}px, 0)` : `translate3d(${v}px, 0, 0)`) : ''; };

  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    last = Y ? t.clientY : t.clientX;
    raw = 0; locked = null; touching = true;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!start || e._wpElastic) return;
    const t = e.touches[0];
    if (!locked) {
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (locked !== axis) return;
    if (room() > 1) e._wpElastic = true;   // este scroll se queda el gesto
    const p = Y ? t.clientY : t.clientX, d = p - last;
    last = p;
    if (!raw && !((d > 0 && atStart()) || (d < 0 && atEnd()))) return;
    const next = raw + d;
    raw = raw && Math.sign(next) !== Math.sign(raw) ? 0 : next;   // regresó al borde → deja de estirar
    e._wpElastic = true;
    show(band(raw));
  }, { passive: true });

  const release = () => {
    start = null; touching = false;
    if (!raw) return;
    raw = 0;
    el.style.transition = SPRING;
    show(0);
  };
  el.addEventListener('touchend', release, { passive: true });
  el.addEventListener('touchcancel', release, { passive: true });

  // Inercia que choca con el borde → pequeño rebote
  let prev = scroll(), prevT = performance.now(), v = 0;
  el.addEventListener('scroll', () => {
    const now = performance.now(), s = scroll();
    const jump = Math.abs(s - prev) > 300;   // salto por código (cambio de paso), no inercia
    v = (s - prev) / Math.max(1, now - prevT);
    prev = s; prevT = now;
    if (jump || touching || Math.abs(v) < 0.6 || !(s <= 0 || s >= room() - 1)) return;
    const k = -Math.sign(v) * Math.min(48, Math.abs(v) * KICK * 16);
    el.animate([{ transform: 'none' }, { transform: Y ? `translate3d(0, ${k}px, 0)` : `translate3d(${k}px, 0, 0)`, offset: 0.3 }, { transform: 'none' }],
      { duration: 520, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
    v = 0;
  }, { passive: true });
}
