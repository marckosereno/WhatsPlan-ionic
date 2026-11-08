// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/drag-strip.js
// Tira horizontal que movemos nosotros de principio a fin: arrastre,
// inercia y rebote elástico en las orillas, todo con transform en una
// sola capa (la GPU). Así no hay "relevo" entre el scroll del teléfono y
// nuestro rebote, que era lo que daba el saltito al llegar a la orilla.
//  · Arrastrar: 1:1; pasando la orilla, estira con resistencia (goma).
//  · Soltar rápido: sigue con inercia y se va frenando; si choca con la
//    orilla, la velocidad que le queda se vuelve un rebote de resorte.
//  · Soltar estirado: regresa con resorte (se pasa un poquito).
//  · Lo vertical sigue siendo del teléfono (touch-action: pan-y), así
//    deslizar arriba/abajo sobre la tira mueve la hoja.
//  · Si arrastraste, el toque no cuenta como clic (no abre nada).
//
// Uso: addDragStrip(el) — el tiene UN hijo (la pista) con las tarjetas.
// Estilos: el { overflow: hidden; touch-action: pan-y } y la pista
// { display: flex; width: max-content } (my-plan.css .wp-mp-who).
// ════════════════════════════════════════════════════════════════════

const MAX = 110, FEEL = 0.55;            // goma: estiramiento máximo y dureza
const FRICTION = 325;                    // ms: qué tan rápido se frena la inercia
const K = 210, DAMP = 21;                // resorte del rebote (se pasa un poquito)
const MAX_KICK = 1100;                   // px/s: tope de la velocidad que se vuelve rebote
const band = (o) => Math.sign(o) * MAX * (1 - Math.exp(-Math.abs(o) * FEEL / MAX));
const unband = (y) => -Math.sign(y) * MAX / FEEL * Math.log(1 - Math.min(0.99, Math.abs(y) / MAX));   // al revés: estirón → cuánto se jaló

export function addDragStrip(el) {
  const track = el?.firstElementChild;
  if (!track || el._wpDrag) return;
  el._wpDrag = true;
  let pos = 0, str = 0, virt = 0, raf = 0;          // pos: scroll [0, room]; str: estirón visible; virt: posición sin límites del dedo
  let start = null, locked = null, last = 0, samples = [], moved = false;

  const room = () => Math.max(0, track.scrollWidth - el.clientWidth);
  const paint = () => { track.style.transform = `translate3d(${(-pos + str).toFixed(2)}px, 0, 0)`; };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  // Resorte del estirón hacia 0 (con velocidad inicial en px/s)
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

  // Inercia (v en px/ms, positivo = hacia la derecha del contenido)
  const glide = (v) => {
    stop();
    let t0 = performance.now();
    const step = (now) => {
      const dt = Math.max(0, Math.min(32, now - t0)); t0 = Math.max(t0, now);   // el primer cuadro puede traer una hora de antes
      pos -= v * dt;
      v *= Math.exp(-dt / FRICTION);
      const r = room();
      if (pos < 0 || pos > r) {                       // chocó con la orilla → rebote
        pos = pos < 0 ? 0 : r; paint();
        return spring(Math.max(-MAX_KICK, Math.min(MAX_KICK, v * 1000)));
      }
      paint();
      raf = Math.abs(v) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  };

  el.addEventListener('touchstart', (e) => {
    stop();
    const t = e.touches[0];
    start = { x: t.clientX, y: t.clientY };
    last = t.clientX; locked = null; moved = false; samples = [];
    virt = pos - unband(str);   // si lo agarras a medio rebote, sigue desde ahí
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.touches[0];
    if (!locked) {
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      last = t.clientX;   // arranca desde aquí (sin brincar los px de tolerancia)
      return;
    }
    if (locked !== 'x') return;
    e._wpElastic = true;   // la hoja (vertical) no se mueve con este gesto
    moved = true;
    const d = t.clientX - last; last = t.clientX;
    const now = performance.now();
    samples.push([now, d]); while (samples.length && now - samples[0][0] > 90) samples.shift();
    virt -= d;
    pos = Math.min(room(), Math.max(0, virt));
    str = band(pos - virt);   // lo que pasa de la orilla, con resistencia
    paint();
  }, { passive: true });

  const end = () => {
    if (!start) return;
    start = null;
    if (locked !== 'x') return;
    if (str) return spring();
    const span = samples.length > 1 ? samples[samples.length - 1][0] - samples[0][0] : 0;
    const v = span ? samples.reduce((s, x) => s + x[1], 0) / span : 0;
    if (Math.abs(v) > 0.15) glide(v);
  };
  el.addEventListener('touchend', end, { passive: true });
  el.addEventListener('touchcancel', end, { passive: true });

  // Un arrastre no es un toque: que no abra la tarjeta que quedó abajo
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
