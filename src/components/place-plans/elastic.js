// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/elastic.js
// Rebote elástico en los scrolls (verticales y horizontales):
//  · Jalar: al llegar al borde, lo que sigas arrastrando estira el
//    contenido con resistencia (cada vez cuesta más) y al soltar
//    regresa con un resorte que se pasa un poquito.
//  · Inercia: si el scroll va rápido y choca con el borde, rebota.
// Desactiva el rebote nativo en ese contenedor para no tener dos, SOLO
// en su eje: una tira horizontal tiene que seguir pasándole el scroll
// vertical a la hoja (si se bloquea en los dos ejes, deslizar hacia
// arriba o abajo con el dedo sobre la tira no hace nada).
// Un scroll de adentro que sí se puede mover "se queda" el gesto, para
// que el de afuera no se estire a la vez.
//
// En las tiras horizontales se mueve lo de adentro (no la tira): si se
// mueve la tira, su borde recorta las tarjetas y se ven cortadas.
// Y si la tira SÍ se desliza (tiene más de lo que cabe), el rebote lo
// pone el teléfono (overscroll nativo, contenido en la tira): el nuestro
// arrancaba justo cuando el scroll nativo llegaba a la orilla y al soltar
// "se acomodaba" → saltito. El nuestro queda para las tiras que caben
// completas (no se deslizan, solo rebotan).
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
  const Y = axis === 'y';
  el.style[Y ? 'overscrollBehaviorY' : 'overscrollBehaviorX'] = Y ? 'none' : 'contain';
  let start = null, last = 0, raw = 0, locked = null, touching = false;

  const scroll = () => (Y ? el.scrollTop : el.scrollLeft);
  const room = () => (Y ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth);
  const atStart = () => scroll() <= 0;
  const atEnd = () => scroll() >= room() - 1;
  const tr = (v) => (Y ? `translate3d(0, ${v}px, 0)` : `translate3d(${v}px, 0, 0)`);
  const parts = () => (Y ? [el] : [...el.children]);   // lo que se estira
  const show = (v) => parts().forEach(c => { c.style.transform = v ? tr(v) : ''; });
  const ease = (t) => parts().forEach(c => { c.style.transition = t; });

  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    last = Y ? t.clientY : t.clientX;
    raw = 0; locked = null; touching = true;
    if (Y) el.style.transition = 'none';
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
    if (room() > 1) {
      e._wpElastic = true;   // este scroll se queda el gesto
      if (!Y) return;        // tira que se desliza: el rebote es el nativo
    }
    const p = Y ? t.clientY : t.clientX, d = p - last;
    last = p;
    if (!raw && !((d > 0 && atStart()) || (d < 0 && atEnd()))) return;
    const next = raw + d;
    raw = raw && Math.sign(next) !== Math.sign(raw) ? 0 : next;   // regresó al borde → deja de estirar
    e._wpElastic = true;
    if (!Y) ease('none');
    show(band(raw));
  }, { passive: true });

  const release = () => {
    start = null; touching = false;
    if (!raw) return;
    raw = 0;
    ease(SPRING);
    show(0);
    if (!Y) setTimeout(() => { if (!raw) ease(''); }, 620);   // las tarjetas recuperan su propia transición
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
    if (!Y || jump || touching || Math.abs(v) < 0.6 || !(s <= 0 || s >= room() - 1)) return;
    const k = -Math.sign(v) * Math.min(48, Math.abs(v) * KICK * 16);
    parts().forEach(c => c.animate([{ transform: 'none' }, { transform: tr(k), offset: 0.3 }, { transform: 'none' }],
      { duration: 520, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }));
    v = 0;
  }, { passive: true });
}
