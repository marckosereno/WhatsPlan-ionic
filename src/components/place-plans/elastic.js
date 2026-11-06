// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/elastic.js
// Rebote elástico al llegar al final de un scroll (arriba/abajo o a los
// lados): el contenido se estira con resistencia y al soltar regresa
// con un resorte. Desactiva el rebote nativo del navegador en ese
// contenedor para que no haya dos efectos a la vez.
//
// Uso: addElastic(el, 'y' | 'x')
// ════════════════════════════════════════════════════════════════════

const RESIST = 0.38;      // cuánto se estira por cada px que arrastras
const MAX = 90;           // estiramiento máximo (px)
const SPRING = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';

export function addElastic(el, axis = 'y') {
  if (!el || el._wpElastic) return;
  el._wpElastic = true;
  el.style.overscrollBehavior = 'none';
  const target = el;   // se estira el contenedor completo
  let start = null, pull = 0, locked = null;

  const atStart = () => (axis === 'y' ? el.scrollTop <= 0 : el.scrollLeft <= 0);
  const atEnd = () => (axis === 'y'
    ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
    : el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  const setPull = (v) => {
    pull = v;
    target.style.transform = v ? (axis === 'y' ? `translate3d(0, ${v}px, 0)` : `translate3d(${v}px, 0, 0)`) : '';
  };

  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY, s: axis === 'y' ? el.scrollTop : el.scrollLeft };
    locked = null;
    target.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (!locked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (locked !== axis) return;
    const d = axis === 'y' ? dy : dx;
    let over = 0;
    if (d > 0 && atStart()) over = d;           // jalando más allá del inicio
    else if (d < 0 && atEnd()) over = d;        // jalando más allá del final
    if (!over && !pull) return;
    const v = Math.sign(over) * Math.min(MAX, Math.abs(over) * RESIST);
    setPull(v);
  }, { passive: true });

  const release = () => {
    start = null;
    if (!pull) return;
    target.style.transition = SPRING;
    setPull(0);
  };
  el.addEventListener('touchend', release, { passive: true });
  el.addEventListener('touchcancel', release, { passive: true });
}
