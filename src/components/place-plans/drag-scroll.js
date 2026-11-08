// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/drag-scroll.js
// Scroll vertical de las hojas grandes movido por nosotros de principio a
// fin (como drag-strip.js en lo horizontal): arrastre, inercia y rebote
// elástico. Antes el scroll era del teléfono y el rebote nuestro, y en el
// relevo (al llegar arriba o abajo) se veía un saltito.
//  · El contenedor sigue siendo un scroll normal (overflow auto): la
//    posición es su scrollTop, así enfocar un campo, scrollIntoView o la
//    rueda del mouse siguen funcionando. Solo tomamos el dedo: al
//    decidir que el gesto es vertical (6 px) cancelamos el scroll del
//    teléfono (preventDefault) y movemos scrollTop nosotros.
//  · Pasando la orilla se estira con resistencia (transform del
//    contenedor); al soltar regresa con resorte.
//  · Soltar rápido: inercia que se frena; si choca con la orilla, la
//    velocidad que queda se vuelve rebote.
//  · Un scroll de adentro que se puede mover (lista de personas, tira de
//    días) se queda su gesto (e._wpElastic) y aquí no se toca.
//  · Si arrastraste, el toque no cuenta como clic.
//
// Uso: addDragScroll(el)   (step-sheet.js, step-screen.js)
// ════════════════════════════════════════════════════════════════════

const MAX = 110, FEEL = 0.55;            // goma (igual que elastic.js)
const FRICTION = 325;                    // ms: qué tan rápido se frena la inercia
const K = 210, DAMP = 21;                // resorte del rebote
const MAX_KICK = 1400;                   // px/s: tope de la velocidad que se vuelve rebote
const band = (o) => Math.sign(o) * MAX * (1 - Math.exp(-Math.abs(o) * FEEL / MAX));
const unband = (y) => -Math.sign(y) * MAX / FEEL * Math.log(1 - Math.min(0.99, Math.abs(y) / MAX));

export function addDragScroll(el) {
  if (!el || el._wpDrag) return;
  el._wpDrag = true;
  el.style.overscrollBehaviorY = 'none';
  let str = 0, virt = 0, room = 0, raf = 0;
  let start = null, locked = null, last = 0, samples = [], moved = false;

  const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
  const paint = () => { el.style.transform = str ? `translate3d(0, ${str.toFixed(2)}px, 0)` : ''; };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const spring = (vel = 0) => {
    stop();
    let t0 = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(0.032, (now - t0) / 1000)); t0 = Math.max(t0, now);
      vel += (-K * str - DAMP * vel) * dt;
      str += vel * dt;
      if (Math.abs(str) < 0.3 && Math.abs(vel) < 8) { str = 0; paint(); raf = 0; return; }
      paint(); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  // Inercia (v en px/ms; positivo = el dedo iba hacia abajo)
  const glide = (v) => {
    stop();
    let t0 = performance.now(), pos = el.scrollTop;
    const step = (now) => {
      const dt = Math.max(0, Math.min(32, now - t0)); t0 = Math.max(t0, now);   // el primer cuadro puede traer una hora de antes
      pos -= v * dt;
      v *= Math.exp(-dt / FRICTION);
      if (pos < 0 || pos > room) {
        el.scrollTop = pos < 0 ? 0 : room;
        return spring(Math.max(-MAX_KICK, Math.min(MAX_KICK, v * 1000)));
      }
      el.scrollTop = pos;
      raf = Math.abs(v) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  };

  el.addEventListener('touchstart', (e) => {
    stop();
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    last = t.clientY; locked = null; moved = false; samples = [];
    room = maxScroll();
    virt = el.scrollTop - unband(str);   // si lo agarras a medio rebote, sigue desde ahí
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!start || e._wpElastic) return;   // un scroll de adentro ya se quedó el gesto
    const t = e.touches[0];
    if (!locked) {
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      last = t.clientY;
    }
    if (locked !== 'y') return;
    if (e.cancelable) e.preventDefault();   // el scroll lo movemos nosotros
    e._wpElastic = true;
    moved = true;
    const d = t.clientY - last; last = t.clientY;
    const now = performance.now();
    samples.push([now, d]); while (samples.length && now - samples[0][0] > 90) samples.shift();
    virt -= d;
    const pos = Math.min(room, Math.max(0, virt));
    el.scrollTop = pos;
    str = band(pos - virt);
    paint();
  }, { passive: false });

  const end = () => {
    if (!start) return;
    start = null;
    if (locked !== 'y') return;
    if (str) return spring();
    const span = samples.length > 1 ? samples[samples.length - 1][0] - samples[0][0] : 0;
    const v = span ? samples.reduce((s, x) => s + x[1], 0) / span : 0;
    if (Math.abs(v) > 0.15) glide(v);
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });

  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
