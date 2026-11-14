// ════════════════════════════════════════════════════════════════════
// WHATSPLAN — place-plans/emoji-dial.js
// Selector de emoji en una curva suave: 5 a la vista, el elegido grande
// al centro y los vecinos más chicos bajando un poco por los lados. El
// elegido de inicio queda en medio de la fila (hay emojis a los dos
// lados). Se desliza con el dedo (con imán al soltar) o tocando uno; el
// que queda al centro late (crece y regresa).
//
// Uso:
//   const dial = createEmojiDial(el, { items: [{ key, emoji, label, img }], value, onChange });
//   dial.set(key)
//
// Gira como una ruleta: con 4 o más íconos da la vuelta sin fin, y al soltar
// con un empujón sigue girando con inercia (larga, se va frenando sola) hasta
// que el dedo la detiene o se agota; entonces se acomoda en el ícono más
// cercano. Un toque mientras gira la frena en seco.
// Estilos: /styles/plan-steps.css (.wp-dial-*)
// ════════════════════════════════════════════════════════════════════
import { pulse } from '/src/components/place-plans/pulse.js';

const STEP_DEG = 12.5;   // separación entre íconos sobre el arco
const RADIUS = 300;      // radio del arco (px)
const VISIBLE = 2;       // íconos a cada lado (2 + 1 + 2 = 5 a la vista)
const DRAG_PX = 58;      // px de arrastre = 1 ícono
const TAU = 780;         // ms: constante de frenado de la inercia (más alto = gira más)
const V_MIN = 0.0011;    // íconos/ms: por debajo de esto la ruleta se acomoda
const V_MAX = 0.1;       // íconos/ms: tope de velocidad
const FLING_MIN = 0.003; // íconos/ms: menos que esto al soltar = solo acomodar

// El primero (el sugerido) va al medio y los demás se reparten a los lados
const centered = (items) => items.reduce((out, x, k) => (k % 2 ? [...out, x] : [x, ...out]), []);

export function createEmojiDial(el, { items: list, value, onChange, haptic = () => {} }) {
  const items = centered(list);
  const n = items.length, loop = n >= 4;
  const wrap = (d) => d - n * Math.round(d / n);              // distancia más corta sobre la vuelta, en [-n/2, n/2]
  const mod = (k) => ((Math.round(k) % n) + n) % n;
  let pos = Math.max(0, items.findIndex(x => x.key === value));   // puede ser fraccionaria al arrastrar
  let drag = null, raf = 0, glide = 0;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  el.classList.add('wp-dial');
  el.innerHTML = `<div class="wp-dial-stage">${items.map((x, k) => `<button type="button" class="wp-dial-it" data-k="${k}" aria-label="${esc(x.label)}"><span class="wp-dial-e">${x.img
    ? `<img src="${esc(x.img)}" alt="" draggable="false" onerror="this.replaceWith(document.createTextNode('${x.emoji}'))">` : x.emoji}</span></button>`).join('')}</div>`;
  const its = [...el.querySelectorAll('.wp-dial-it')];

  const paint = () => {
    its.forEach((it, k) => {
      const d = loop ? wrap(k - pos) : k - pos, ad = Math.abs(d);
      const a = (d * STEP_DEG) * Math.PI / 180;
      const x = RADIUS * Math.sin(a), y = RADIUS * (1 - Math.cos(a));
      const s = Math.max(0.4, 1 - ad * 0.24);
      it.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      it.style.opacity = ad > VISIBLE + 0.6 ? '0' : String(Math.max(0.3, 1 - ad * 0.24));
      it.style.zIndex = String(20 - Math.round(ad));
      it.style.pointerEvents = ad > VISIBLE + 0.4 ? 'none' : '';
      it.classList.toggle('on', ad < 0.5);
    });
  };
  let shown = loop ? mod(pos) : Math.round(pos);   // ícono al centro la última vez que se avisó
  const settle = (target, notify = true) => {
    const next = loop ? Math.round(target) : Math.max(0, Math.min(n - 1, Math.round(target)));
    el.classList.add('anim');
    pos = next; paint();
    const k = loop ? mod(next) : next;
    pulse(its[k].firstElementChild, 'wp-dial-pop');
    if (notify && k !== shown) { haptic('light'); onChange?.(items[k].key); }
    shown = k;
    clearTimeout(raf); raf = setTimeout(() => { el.classList.remove('anim'); if (loop) pos = mod(pos); paint(); }, 420);
  };
  const stopGlide = () => { const g = glide; cancelAnimationFrame(glide); glide = 0; return !!g; };
  const tick = (idx) => { const k = loop ? mod(idx) : Math.round(idx); if (k !== tick.last) { tick.last = k; haptic('light'); } };

  // Inercia: sigue girando con la velocidad con que se soltó
  const fling = (v0) => {
    let v = Math.max(-V_MAX, Math.min(V_MAX, v0)), t0 = performance.now();
    el.classList.remove('anim');
    tick.last = -1;
    const step = (t) => {
      const dt = Math.min(48, t - t0); t0 = t;
      pos += v * dt;
      v *= Math.exp(-dt / TAU);
      if (!loop && (pos < 0 || pos > n - 1)) { pos = Math.max(0, Math.min(n - 1, pos)); paint(); glide = 0; settle(pos); return; }
      tick(pos); paint();
      if (Math.abs(v) < V_MIN) { glide = 0; settle(pos); return; }
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  };

  // Arrastrar
  const samples = [];
  el.addEventListener('pointerdown', (e) => {
    const gliding = stopGlide();
    drag = { x: e.clientX, start: pos, moved: false, id: e.pointerId, gliding };
    samples.length = 0; samples.push([performance.now(), pos]);
    el.classList.remove('anim');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6 && !drag.moved) { drag.moved = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    if (!drag.moved) return;
    const before = Math.round(pos);
    pos = loop ? drag.start - dx / DRAG_PX : Math.max(-0.4, Math.min(n - 0.6, drag.start - dx / DRAG_PX));
    if (Math.round(pos) !== before) haptic('light');
    const t = performance.now(); samples.push([t, pos]);
    while (samples.length > 2 && t - samples[0][0] > 90) samples.shift();
    paint();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (d.moved) {
      const a = samples[0], b = samples[samples.length - 1], dt = b[0] - a[0];
      const v = dt > 8 && performance.now() - b[0] < 120 ? (b[1] - a[1]) / dt : 0;
      if (Math.abs(v) > FLING_MIN) fling(v); else settle(pos);
      return;
    }
    if (d.gliding) { settle(pos); return; }   // un toque la frena
    const it = e.target.closest?.('.wp-dial-it');
    if (it) { const k = +it.dataset.k; settle(loop ? pos + wrap(k - pos) : k); }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  paint();
  return { set(key) { const k = items.findIndex(x => x.key === key); if (k >= 0) { stopGlide(); settle(loop ? pos + wrap(k - pos) : k, false); } } };
}
